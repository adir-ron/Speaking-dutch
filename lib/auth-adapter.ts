import type { Adapter, AdapterUser, VerificationToken } from "@auth/core/adapters";
import { getDb } from "./db";
import { runMigrations } from "./migrate";

/**
 * Minimal Auth.js adapter backed by Turso/libSQL.
 * Only implements what the email provider needs: users + verification tokens.
 */
export function TursoAdapter(): Adapter {
  return {
    async createUser(user) {
      const db = getDb();
      await runMigrations();
      const id = crypto.randomUUID();
      await db.execute({
        sql: "INSERT INTO auth_users (id, name, email, emailVerified, image) VALUES (?, ?, ?, ?, ?)",
        args: [id, user.name || null, user.email, user.emailVerified?.toISOString() || null, user.image || null],
      });
      return { ...user, id } as AdapterUser;
    },

    async getUser(id) {
      const db = getDb();
      const result = await db.execute({ sql: "SELECT * FROM auth_users WHERE id = ?", args: [id] });
      if (result.rows.length === 0) return null;
      return rowToUser(result.rows[0]);
    },

    async getUserByEmail(email) {
      const db = getDb();
      await runMigrations();
      const result = await db.execute({ sql: "SELECT * FROM auth_users WHERE email = ?", args: [email] });
      if (result.rows.length === 0) return null;
      return rowToUser(result.rows[0]);
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const db = getDb();
      const result = await db.execute({
        sql: `SELECT u.* FROM auth_users u
              JOIN auth_accounts a ON a.userId = u.id
              WHERE a.provider = ? AND a.providerAccountId = ?`,
        args: [provider, providerAccountId],
      });
      if (result.rows.length === 0) return null;
      return rowToUser(result.rows[0]);
    },

    async updateUser(user) {
      const db = getDb();
      await db.execute({
        sql: "UPDATE auth_users SET name = ?, email = ?, emailVerified = ?, image = ? WHERE id = ?",
        args: [user.name || null, user.email || null, user.emailVerified?.toISOString() || null, user.image || null, user.id!],
      });
      return user as AdapterUser;
    },

    async linkAccount(account) {
      const db = getDb();
      await db.execute({
        sql: "INSERT INTO auth_accounts (id, userId, type, provider, providerAccountId) VALUES (?, ?, ?, ?, ?)",
        args: [crypto.randomUUID(), account.userId, account.type, account.provider, account.providerAccountId],
      });
    },

    async createVerificationToken(token) {
      const db = getDb();
      await runMigrations();
      await db.execute({
        sql: "INSERT INTO verification_tokens (identifier, token, expires) VALUES (?, ?, ?)",
        args: [token.identifier, token.token, token.expires.toISOString()],
      });
      return token;
    },

    async useVerificationToken({ identifier, token }) {
      const db = getDb();
      const result = await db.execute({
        sql: "SELECT * FROM verification_tokens WHERE identifier = ? AND token = ?",
        args: [identifier, token],
      });
      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      await db.execute({
        sql: "DELETE FROM verification_tokens WHERE identifier = ? AND token = ?",
        args: [identifier, token],
      });

      return {
        identifier: row.identifier as string,
        token: row.token as string,
        expires: new Date(row.expires as string),
      };
    },

    async createSession(session) {
      const db = getDb();
      await db.execute({
        sql: "INSERT INTO auth_sessions (sessionToken, userId, expires) VALUES (?, ?, ?)",
        args: [session.sessionToken, session.userId, session.expires.toISOString()],
      });
      return session;
    },

    async getSessionAndUser(sessionToken) {
      const db = getDb();
      const result = await db.execute({
        sql: `SELECT s.*, u.* FROM auth_sessions s
              JOIN auth_users u ON u.id = s.userId
              WHERE s.sessionToken = ?`,
        args: [sessionToken],
      });
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        session: {
          sessionToken: row.sessionToken as string,
          userId: row.userId as string,
          expires: new Date(row.expires as string),
        },
        user: rowToUser(row),
      };
    },

    async updateSession(session) {
      const db = getDb();
      await db.execute({
        sql: "UPDATE auth_sessions SET expires = ? WHERE sessionToken = ?",
        args: [session.expires?.toISOString() || null, session.sessionToken],
      });
      return session as { sessionToken: string; userId: string; expires: Date };
    },

    async deleteSession(sessionToken) {
      const db = getDb();
      await db.execute({
        sql: "DELETE FROM auth_sessions WHERE sessionToken = ?",
        args: [sessionToken],
      });
    },

    async deleteUser(id) {
      const db = getDb();
      await db.execute({ sql: "DELETE FROM auth_users WHERE id = ?", args: [id] });
    },

    async unlinkAccount({ provider, providerAccountId }) {
      const db = getDb();
      await db.execute({
        sql: "DELETE FROM auth_accounts WHERE provider = ? AND providerAccountId = ?",
        args: [provider, providerAccountId],
      });
    },
  };
}

function rowToUser(row: Record<string, unknown>): AdapterUser {
  return {
    id: row.id as string,
    name: row.name as string | null,
    email: row.email as string,
    emailVerified: row.emailVerified ? new Date(row.emailVerified as string) : null,
    image: row.image as string | null,
  };
}
