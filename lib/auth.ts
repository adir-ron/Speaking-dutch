import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { Resend } from "resend";
import { TursoAdapter } from "./auth-adapter";

const resend = new Resend(process.env.AUTH_RESEND_KEY);

const allowedEmails = (process.env.ALLOWED_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const authConfig: NextAuthConfig = {
  adapter: TursoAdapter(),
  providers: [
    {
      id: "email",
      type: "email",
      name: "Email",
      from: "Speaking Dutch <noreply@ronron.nl>",
      maxAge: 60 * 10, // 10 minutes
      async sendVerificationRequest({ identifier: email, url }) {
        await resend.emails.send({
          from: "Speaking Dutch <noreply@ronron.nl>",
          to: email,
          subject: "Sign in to Speaking Dutch",
          html: `
            <div style="font-family: Georgia, serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
              <p style="font-size: 18px; color: #141414;">
                Click below to sign in to Speaking Dutch.
              </p>
              <a href="${url}" style="
                display: inline-block;
                margin-top: 16px;
                padding: 12px 24px;
                background: #DC5B2B;
                color: white;
                text-decoration: none;
                border-radius: 8px;
                font-family: -apple-system, sans-serif;
                font-size: 14px;
                font-weight: 500;
              ">
                Sign in
              </a>
              <p style="margin-top: 24px; font-size: 13px; color: #8A8271;">
                This link expires in 10 minutes.
              </p>
            </div>
          `,
        });
      },
    },
  ],
  callbacks: {
    async signIn({ user }) {
      // Only allow emails in the allowlist
      const email = user.email?.toLowerCase();
      if (!email || !allowedEmails.includes(email)) {
        return false;
      }
      return true;
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/login?sent=true",
  },
  session: {
    strategy: "jwt",
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
