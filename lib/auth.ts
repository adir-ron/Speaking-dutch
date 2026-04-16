import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { Resend } from "resend";
import { getDb } from "./db";

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret");
const COOKIE_NAME = "sd-session";
const CODE_EXPIRY_MINUTES = 10;

const allowedEmails = (process.env.ALLOWED_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOTP(email: string): Promise<{ ok: boolean; error?: string }> {
  const normalized = email.toLowerCase().trim();
  if (!allowedEmails.includes(normalized)) {
    // Don't reveal whether the email is in the allowlist
    return { ok: true };
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

  const db = getDb();

  // Ensure table exists
  await db.execute(`CREATE TABLE IF NOT EXISTS otp_codes (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    attempts INTEGER DEFAULT 0
  )`);

  // Upsert code
  await db.execute({
    sql: `INSERT INTO otp_codes (email, code, expires_at, attempts)
          VALUES (?, ?, ?, 0)
          ON CONFLICT(email) DO UPDATE SET code = ?, expires_at = ?, attempts = 0`,
    args: [normalized, code, expiresAt, code, expiresAt],
  });

  // Send email
  const resend = new Resend(process.env.AUTH_RESEND_KEY);
  try {
    await resend.emails.send({
      from: "Speaking Dutch <onboarding@resend.dev>",
      to: normalized,
      subject: `${code} is your Speaking Dutch code`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
          <p style="font-size: 18px; color: #141414;">Your sign-in code:</p>
          <p style="font-size: 36px; font-weight: bold; color: #DC5B2B; letter-spacing: 0.1em; margin: 16px 0;">${code}</p>
          <p style="font-size: 13px; color: #8A8271;">Expires in ${CODE_EXPIRY_MINUTES} minutes.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[auth] Failed to send OTP email:", err);
    return { ok: false, error: "Failed to send email" };
  }

  return { ok: true };
}

export async function verifyOTP(email: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const normalized = email.toLowerCase().trim();
  const db = getDb();

  const result = await db.execute({
    sql: "SELECT code, expires_at, attempts FROM otp_codes WHERE email = ?",
    args: [normalized],
  });

  if (result.rows.length === 0) {
    return { ok: false, error: "No code found. Request a new one." };
  }

  const row = result.rows[0];
  const attempts = (row.attempts as number) + 1;

  // Rate limit: max 5 attempts per code
  if (attempts > 5) {
    await db.execute({ sql: "DELETE FROM otp_codes WHERE email = ?", args: [normalized] });
    return { ok: false, error: "Too many attempts. Request a new code." };
  }

  // Update attempt count
  await db.execute({
    sql: "UPDATE otp_codes SET attempts = ? WHERE email = ?",
    args: [attempts, normalized],
  });

  // Check expiry
  if (new Date(row.expires_at as string) < new Date()) {
    await db.execute({ sql: "DELETE FROM otp_codes WHERE email = ?", args: [normalized] });
    return { ok: false, error: "Code expired. Request a new one." };
  }

  // Check code
  if (row.code !== code) {
    return { ok: false, error: "Wrong code." };
  }

  // Success: delete the code and set a session cookie
  await db.execute({ sql: "DELETE FROM otp_codes WHERE email = ?", args: [normalized] });

  const token = await new SignJWT({ email: normalized })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: "/",
  });

  return { ok: true };
}

export async function getSession(): Promise<{ email: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, SECRET);
    if (!payload.email || typeof payload.email !== "string") return null;

    return { email: payload.email };
  } catch {
    return null;
  }
}
