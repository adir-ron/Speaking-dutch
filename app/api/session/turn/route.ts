import { NextRequest } from "next/server";
import { after } from "next/server";
import { getDb } from "@/lib/db";
import { composeSystemPrompt, type Turn } from "@/lib/prompt-composer";
import { streamConversationTurn } from "@/lib/claude";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { session_id, user_message, turn_index } = await req.json();

  if (!session_id || !user_message) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  const db = getDb();

  const sessionRow = await db.execute({
    sql: "SELECT target_item_id, transcript_json, prompt_log_json FROM sessions WHERE id = ?",
    args: [session_id],
  });

  if (sessionRow.rows.length === 0) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  const targetItemId = sessionRow.rows[0].target_item_id as string;

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

  let transcript: Turn[] = [];
  try {
    transcript = JSON.parse((sessionRow.rows[0].transcript_json as string) || "[]");
  } catch {
    transcript = [];
  }
  transcript.push({ role: "user", text: user_message });

  const existingPromptLogJson = (sessionRow.rows[0].prompt_log_json as string) || "[]";
  const systemPrompt = await composeSystemPrompt(target, transcript, session_id);

  const encoder = new TextEncoder();
  let buddyText = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamConversationTurn(systemPrompt, user_message)) {
          buddyText += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (err) {
        console.error("[turn] Claude stream error:", err);
        controller.error(err);
      }
    },
  });

  // Persist after the stream closes. waitUntil / after keeps the function alive.
  after(async () => {
    try {
      if (!buddyText.trim()) return;

      transcript.push({ role: "buddy", text: buddyText });

      let promptLog: Array<{ turn_index: number; system_prompt: string; response: string }> = [];
      try {
        promptLog = JSON.parse(existingPromptLogJson);
      } catch {
        promptLog = [];
      }
      promptLog.push({
        turn_index: turn_index || transcript.length,
        system_prompt: systemPrompt,
        response: buddyText,
      });

      await db.execute({
        sql: "UPDATE sessions SET transcript_json = ?, prompt_log_json = ? WHERE id = ?",
        args: [JSON.stringify(transcript), JSON.stringify(promptLog), session_id],
      });

      const normalized = buddyText.toLowerCase().replace(/\s+/g, " ").trim();
      await db.execute({
        sql: "INSERT INTO buddy_phrases (session_id, phrase_normalized, ts) VALUES (?, ?, datetime('now'))",
        args: [session_id, normalized],
      });
    } catch (err) {
      console.error("[turn] Background persist error:", err);
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
