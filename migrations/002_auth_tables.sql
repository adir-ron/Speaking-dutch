-- Auth.js requires these tables for the email provider (verification tokens)
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TEXT NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  emailVerified TEXT,
  image TEXT
);

CREATE TABLE IF NOT EXISTS auth_accounts (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  providerAccountId TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  sessionToken TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  expires TEXT NOT NULL
);
