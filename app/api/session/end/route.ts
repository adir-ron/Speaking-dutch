import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { analyzeSession } from "@/lib/claude";
import { updateLearnerItem } from "@/lib/learner-model";
// waitUntil is available in Vercel's edge/serverless runtime
import { after } from "next/server";

export async function POST(req: NextRequest) {
  const { session_id } = await req.json();

  if (!session_id) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  const db = getDb();

  // Mark session as ended
  await db.execute({
    sql: "UPDATE sessions SET ended_at = datetime('now') WHERE id = ?",
    args: [session_id],
  });

  // Get session data for the analyzer
  const sessionRow = await db.execute({
    sql: `SELECT s.target_item_id, s.transcript_json, c.label, c.description
          FROM sessions s
          JOIN curriculum_items c ON c.id = s.target_item_id
          WHERE s.id = ?`,
    args: [session_id],
  });

  if (sessionRow.rows.length === 0) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const row = sessionRow.rows[0];
  const targetItemId = row.target_item_id as string;
  const targetLabel = row.label as string;
  const targetDescription = row.description as string || "";

  let transcript: Array<{ role: string; text: string }> = [];
  try {
    transcript = JSON.parse(row.transcript_json as string || "[]");
  } catch {
    transcript = [];
  }

  // Run analyzer asynchronously (after response is sent)
  after(async () => {
    try {
      const analysis = await analyzeSession(
        targetItemId,
        targetLabel,
        targetDescription,
        transcript,
      );

      // Save analysis to session
      await db.execute({
        sql: "UPDATE sessions SET analysis_json = ? WHERE id = ?",
        args: [JSON.stringify(analysis), session_id],
      });

      // Update learner model
      await updateLearnerItem(
        targetItemId,
        analysis.attempts,
        analysis.successes,
        analysis.summary_note || null,
        session_id,
      );
    } catch (err) {
      // Retry once with a note about the failure
      console.error("Analyzer failed:", err);
      try {
        const retryAnalysis = await analyzeSession(
          targetItemId,
          targetLabel,
          targetDescription,
          transcript,
        );

        await db.execute({
          sql: "UPDATE sessions SET analysis_json = ? WHERE id = ?",
          args: [JSON.stringify(retryAnalysis), session_id],
        });

        await updateLearnerItem(
          targetItemId,
          retryAnalysis.attempts,
          retryAnalysis.successes,
          retryAnalysis.summary_note || null,
          session_id,
        );
      } catch {
        // Second failure: skip analyzer for this session
        console.error("Analyzer retry failed, skipping analysis for session:", session_id);
      }
    }
  });

  // Return immediately with approximate data
  const turnCount = transcript.filter((t) => t.role === "user").length;

  return NextResponse.json({
    ok: true,
    approximate: {
      turn_count: turnCount,
      target_label: targetLabel,
    },
  });
}
