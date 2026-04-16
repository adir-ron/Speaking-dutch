-- The curriculum (seeded, CEFR-agnostic)
CREATE TABLE IF NOT EXISTS curriculum_items (
  id TEXT PRIMARY KEY,
  cefr_level TEXT NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  prereq_ids TEXT,
  seed_order INTEGER NOT NULL
);

-- What the learner has done
CREATE TABLE IF NOT EXISTS learner_items (
  item_id TEXT PRIMARY KEY REFERENCES curriculum_items(id),
  attempts INTEGER DEFAULT 0,
  successes INTEGER DEFAULT 0,
  last_seen_at TEXT,
  confidence REAL DEFAULT 0,
  error_notes TEXT
);

-- Session transcripts
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  started_at TEXT,
  ended_at TEXT,
  target_item_id TEXT,
  transcript_json TEXT,
  analysis_json TEXT,
  prompt_log_json TEXT
);

-- Anti-repetition: one row per buddy phrase uttered
CREATE TABLE IF NOT EXISTS buddy_phrases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  phrase_normalized TEXT NOT NULL,
  ts TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_buddy_phrases_ts ON buddy_phrases(ts DESC);
