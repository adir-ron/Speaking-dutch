import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { pickTarget } from "@/lib/learner-model";
import { getOpeningLines } from "@/lib/prompt-composer";
import { runMigrations } from "@/lib/migrate";

export async function POST() {
  await runMigrations();

  const db = getDb();
  const target = await pickTarget();
  const sessionId = uuid();
  const openingLines = getOpeningLines(target.id);

  // Create session row
  await db.execute({
    sql: `INSERT INTO sessions (id, started_at, target_item_id, transcript_json, prompt_log_json)
          VALUES (?, datetime('now'), ?, '[]', '[]')`,
    args: [sessionId, target.id],
  });

  return NextResponse.json({
    session_id: sessionId,
    target_item: {
      id: target.id,
      label: target.label,
      opening_lines: openingLines,
    },
  });
}
