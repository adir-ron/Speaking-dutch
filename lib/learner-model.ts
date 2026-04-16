import { getDb } from "./db";
import { updateConfidence } from "./confidence";

export interface CurriculumItem {
  id: string;
  cefr_level: string;
  kind: string;
  label: string;
  description: string | null;
  prereq_ids: string;
  seed_order: number;
}

export interface LearnerItem {
  item_id: string;
  attempts: number;
  successes: number;
  last_seen_at: string | null;
  confidence: number;
  error_notes: string | null;
}

/**
 * Pick today's target curriculum item.
 *
 * Cold start (no learner_items): pick first by seed_order.
 * Warm path: find items with confidence < 0.7 not seen in last 12h.
 * If nothing qualifies: pick next unseen item respecting prereqs and CEFR gating.
 */
export async function pickTarget(): Promise<CurriculumItem> {
  const db = getDb();

  // Check if we have any learner data
  const countResult = await db.execute("SELECT COUNT(*) as cnt FROM learner_items");
  const hasLearnerData = (countResult.rows[0].cnt as number) > 0;

  if (!hasLearnerData) {
    // Cold start: first item by seed_order
    const result = await db.execute(
      "SELECT * FROM curriculum_items ORDER BY seed_order ASC LIMIT 1",
    );
    return result.rows[0] as unknown as CurriculumItem;
  }

  // Warm path: items needing review (low confidence, not seen recently)
  const reviewResult = await db.execute(`
    SELECT c.* FROM learner_items l
    JOIN curriculum_items c ON c.id = l.item_id
    WHERE l.confidence < 0.7
      AND (l.last_seen_at IS NULL OR l.last_seen_at < datetime('now', '-12 hours'))
    ORDER BY l.last_seen_at ASC NULLS FIRST, l.confidence ASC
    LIMIT 1
  `);

  if (reviewResult.rows.length > 0) {
    return reviewResult.rows[0] as unknown as CurriculumItem;
  }

  // Nothing to review: pick next unseen item respecting CEFR gating
  const target = await pickNextUnseen();
  if (target) return target;

  // Fallback: pick lowest-confidence item overall
  const fallback = await db.execute(`
    SELECT c.* FROM learner_items l
    JOIN curriculum_items c ON c.id = l.item_id
    ORDER BY l.confidence ASC
    LIMIT 1
  `);

  return fallback.rows[0] as unknown as CurriculumItem;
}

async function pickNextUnseen(): Promise<CurriculumItem | null> {
  const db = getDb();

  // Check CEFR gating: A2 items require >= 4 A1 items with confidence >= 0.6
  const a1Mastered = await db.execute(`
    SELECT COUNT(*) as cnt FROM learner_items l
    JOIN curriculum_items c ON c.id = l.item_id
    WHERE c.cefr_level = 'A1' AND l.confidence >= 0.6
  `);
  const a2Unlocked = (a1Mastered.rows[0].cnt as number) >= 4;

  // Find unseen items (not in learner_items)
  const cefrFilter = a2Unlocked ? "" : "AND c.cefr_level = 'A1'";
  const result = await db.execute(`
    SELECT c.* FROM curriculum_items c
    LEFT JOIN learner_items l ON l.item_id = c.id
    WHERE l.item_id IS NULL ${cefrFilter}
    ORDER BY c.seed_order ASC
    LIMIT 1
  `);

  if (result.rows.length === 0) return null;
  return result.rows[0] as unknown as CurriculumItem;
}

/**
 * Get the most recent session's target and outcome for the memory greeting.
 */
export async function getLastSessionContext(): Promise<{
  targetLabel: string;
  confidence: number;
  sessionNumber: number;
  errorNotes: string[];
} | null> {
  const db = getDb();

  const sessionResult = await db.execute(`
    SELECT s.target_item_id, s.analysis_json, c.label
    FROM sessions s
    JOIN curriculum_items c ON c.id = s.target_item_id
    WHERE s.ended_at IS NOT NULL
    ORDER BY s.ended_at DESC
    LIMIT 1
  `);

  if (sessionResult.rows.length === 0) return null;

  const row = sessionResult.rows[0];
  const targetItemId = row.target_item_id as string;

  // Get current confidence for this item
  const learnerResult = await db.execute({
    sql: "SELECT confidence, error_notes FROM learner_items WHERE item_id = ?",
    args: [targetItemId],
  });

  // Count total sessions
  const countResult = await db.execute(
    "SELECT COUNT(*) as cnt FROM sessions WHERE ended_at IS NOT NULL",
  );

  const confidence = learnerResult.rows.length > 0
    ? (learnerResult.rows[0].confidence as number)
    : 0;

  const errorNotesRaw = learnerResult.rows.length > 0
    ? (learnerResult.rows[0].error_notes as string | null)
    : null;

  let errorNotes: string[] = [];
  if (errorNotesRaw) {
    try {
      const parsed = JSON.parse(errorNotesRaw) as Array<{ note: string }>;
      errorNotes = parsed.slice(0, 3).map((e) => e.note);
    } catch {
      // ignore malformed
    }
  }

  return {
    targetLabel: row.label as string,
    confidence,
    sessionNumber: countResult.rows[0].cnt as number,
    errorNotes,
  };
}

/**
 * Get error notes for a specific curriculum item (for prompt composer).
 */
export async function getErrorNotes(itemId: string): Promise<string[]> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT error_notes FROM learner_items WHERE item_id = ?",
    args: [itemId],
  });

  if (result.rows.length === 0 || !result.rows[0].error_notes) return [];

  try {
    const parsed = JSON.parse(result.rows[0].error_notes as string) as Array<{ note: string }>;
    return parsed.slice(0, 3).map((e) => e.note);
  } catch {
    return [];
  }
}

/**
 * Update a learner item after post-session analysis.
 * Only updates confidence when attempts > 0.
 */
export async function updateLearnerItem(
  itemId: string,
  newAttempts: number,
  newSuccesses: number,
  errorNote: string | null,
  sessionId: string,
): Promise<void> {
  const db = getDb();

  // Upsert: create if not exists
  await db.execute({
    sql: `INSERT INTO learner_items (item_id, attempts, successes, last_seen_at, confidence, error_notes)
          VALUES (?, 0, 0, datetime('now'), 0, '[]')
          ON CONFLICT(item_id) DO UPDATE SET last_seen_at = datetime('now')`,
    args: [itemId],
  });

  // Get current values
  const current = await db.execute({
    sql: "SELECT attempts, successes, confidence, error_notes FROM learner_items WHERE item_id = ?",
    args: [itemId],
  });

  const row = current.rows[0];
  const totalAttempts = (row.attempts as number) + newAttempts;
  const totalSuccesses = (row.successes as number) + newSuccesses;
  const oldConfidence = row.confidence as number;

  // Only update confidence if there were actual attempts this session
  const newConfidence = newAttempts > 0
    ? updateConfidence(oldConfidence, newSuccesses, newAttempts)
    : oldConfidence;

  // Append error note (FIFO cap 10)
  let errorNotes: Array<{ session_id: string; note: string; ts: string }> = [];
  if (row.error_notes) {
    try {
      errorNotes = JSON.parse(row.error_notes as string);
    } catch {
      errorNotes = [];
    }
  }

  if (errorNote) {
    errorNotes.unshift({
      session_id: sessionId,
      note: errorNote,
      ts: new Date().toISOString(),
    });
    if (errorNotes.length > 10) {
      errorNotes = errorNotes.slice(0, 10);
    }
  }

  await db.execute({
    sql: `UPDATE learner_items
          SET attempts = ?, successes = ?, confidence = ?, error_notes = ?
          WHERE item_id = ?`,
    args: [totalAttempts, totalSuccesses, newConfidence, JSON.stringify(errorNotes), itemId],
  });
}
