import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Resend from "next-auth/providers/resend";
import { TursoAdapter } from "./auth-adapter";

const allowedEmails = (process.env.ALLOWED_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const authConfig: NextAuthConfig = {
  adapter: TursoAdapter(),
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: "Speaking Dutch <onboarding@resend.dev>",
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // For email/resend provider, check allowlist
      if (account?.provider === "resend") {
        const email = user.email?.toLowerCase();
        if (!email || !allowedEmails.includes(email)) {
          console.log(`[auth] Rejected sign-in for: ${email}, allowed: ${allowedEmails.join(", ")}`);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.email) {
        session.user.email = token.email as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/login?sent=true",
  },
  session: {
    strategy: "jwt",
  },
  debug: process.env.NODE_ENV === "development",
  trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
