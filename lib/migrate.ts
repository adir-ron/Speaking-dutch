import { getDb } from "./db";

/**
 * Inline migrations for Vercel serverless (no filesystem access).
 * Each migration is a named entry with SQL statements.
 */
const MIGRATIONS: Array<{ name: string; statements: string[] }> = [
  {
    name: "001_init.sql",
    statements: [
      `CREATE TABLE IF NOT EXISTS curriculum_items (
        id TEXT PRIMARY KEY,
        cefr_level TEXT NOT NULL,
        kind TEXT NOT NULL,
        label TEXT NOT NULL,
        description TEXT,
        prereq_ids TEXT,
        seed_order INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS learner_items (
        item_id TEXT PRIMARY KEY REFERENCES curriculum_items(id),
        attempts INTEGER DEFAULT 0,
        successes INTEGER DEFAULT 0,
        last_seen_at TEXT,
        confidence REAL DEFAULT 0,
        error_notes TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        started_at TEXT,
        ended_at TEXT,
        target_item_id TEXT,
        transcript_json TEXT,
        analysis_json TEXT,
        prompt_log_json TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS buddy_phrases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        phrase_normalized TEXT NOT NULL,
        ts TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_buddy_phrases_ts ON buddy_phrases(ts DESC)`,
    ],
  },
  {
    name: "002_auth_tables.sql",
    statements: [
      `CREATE TABLE IF NOT EXISTS verification_tokens (
        identifier TEXT NOT NULL,
        token TEXT NOT NULL,
        expires TEXT NOT NULL,
        PRIMARY KEY (identifier, token)
      )`,
      `CREATE TABLE IF NOT EXISTS auth_users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        emailVerified TEXT,
        image TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS auth_accounts (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        provider TEXT NOT NULL,
        providerAccountId TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS auth_sessions (
        sessionToken TEXT PRIMARY KEY,
        userId TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        expires TEXT NOT NULL
      )`,
    ],
  },
];

export async function runMigrations(): Promise<void> {
  const db = getDb();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = await db.execute("SELECT name FROM _migrations");
  const appliedSet = new Set(applied.rows.map((r) => r.name as string));

  for (const migration of MIGRATIONS) {
    if (appliedSet.has(migration.name)) continue;

    for (const statement of migration.statements) {
      await db.execute(statement);
    }

    await db.execute({
      sql: "INSERT INTO _migrations (name) VALUES (?)",
      args: [migration.name],
    });
  }
}
