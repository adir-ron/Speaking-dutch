import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { pickTarget, getErrorNotes } from "@/lib/learner-model";
import { composeSystemPrompt, type Turn } from "@/lib/prompt-composer";
import { streamConversationTurn } from "@/lib/claude";

export async function POST(req: NextRequest) {
  const { session_id, user_message, turn_index } = await req.json();

  if (!session_id || !user_message) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const db = getDb();

  // Get session and target
  const sessionRow = await db.execute({
    sql: "SELECT target_item_id, transcript_json, prompt_log_json FROM sessions WHERE id = ?",
    args: [session_id],
  });

  if (sessionRow.rows.length === 0) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const targetItemId = sessionRow.rows[0].target_item_id as string;

  // Get target curriculum item
  const targetRow = await db.execute({
    sql: "SELECT * FROM curriculum_items WHERE id = ?",
    args: [targetItemId],
  });

  const target = targetRow.rows[0] as unknown as {
    id: string;
    cefr_level: string;
    kind: string;
    label: string;
    description: string | null;
    prereq_ids: string;
    seed_order: number;
  };

  // Parse existing transcript
  let transcript: Turn[] = [];
  try {
    transcript = JSON.parse(sessionRow.rows[0].transcript_json as string || "[]");
  } catch {
    transcript = [];
  }

  // Add user message to transcript
  transcript.push({ role: "user", text: user_message });

  // Compose system prompt and call Claude
  const systemPrompt = await composeSystemPrompt(target, transcript, session_id);

  const { stream, getFullText } = await streamConversationTurn(systemPrompt, user_message);

  // Read the full response from the stream
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buddyText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buddyText += decoder.decode(value, { stream: true });
  }

  buddyText = buddyText.trim() || getFullText();

  // Add buddy reply to transcript
  transcript.push({ role: "buddy", text: buddyText });

  // Parse existing prompt log
  let promptLog: Array<{ turn_index: number; system_prompt: string; response: string }> = [];
  try {
    promptLog = JSON.parse(sessionRow.rows[0].prompt_log_json as string || "[]");
  } catch {
    promptLog = [];
  }

  promptLog.push({
    turn_index: turn_index || transcript.length,
    system_prompt: systemPrompt,
    response: buddyText,
  });

  // Update session
  await db.execute({
    sql: "UPDATE sessions SET transcript_json = ?, prompt_log_json = ? WHERE id = ?",
    args: [JSON.stringify(transcript), JSON.stringify(promptLog), session_id],
  });

  // Record buddy phrase for anti-repetition
  const normalized = buddyText.toLowerCase().replace(/\s+/g, " ").trim();
  await db.execute({
    sql: "INSERT INTO buddy_phrases (session_id, phrase_normalized, ts) VALUES (?, ?, datetime('now'))",
    args: [session_id, normalized],
  });

  return NextResponse.json({ buddy_text: buddyText });
}
