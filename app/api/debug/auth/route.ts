import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

// Temporary debug endpoint to check auth table state
export async function GET() {
  try {
    const db = getDb();

    // Check if tables exist
    const tables = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );

    // Check verification tokens
    let tokens: unknown[] = [];
    try {
      const result = await db.execute("SELECT identifier, expires FROM verification_tokens");
      tokens = result.rows;
    } catch {
      tokens = [{ error: "table not found" }];
    }

    // Check users
    let users: unknown[] = [];
    try {
      const result = await db.execute("SELECT id, email, emailVerified FROM auth_users");
      users = result.rows;
    } catch {
      users = [{ error: "table not found" }];
    }

    return NextResponse.json({
      tables: tables.rows.map((r) => r.name),
      verification_tokens: tokens,
      users,
      env: {
        has_auth_secret: !!process.env.AUTH_SECRET,
        has_resend_key: !!process.env.AUTH_RESEND_KEY,
        allowed_emails: process.env.ALLOWED_EMAILS,
        nextauth_url: process.env.NEXTAUTH_URL,
        auth_url: process.env.AUTH_URL,
        vercel_url: process.env.VERCEL_URL,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
