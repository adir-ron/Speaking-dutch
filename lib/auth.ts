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
    async signIn({ user }) {
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
