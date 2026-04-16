import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  const db = getDb();

  const result = await db.execute({
    sql: "SELECT analysis_json FROM sessions WHERE id = ?",
    args: [sessionId],
  });

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const analysisRaw = result.rows[0].analysis_json as string | null;

  if (!analysisRaw) {
    return NextResponse.json({ analysis: null, status: "pending" });
  }

  try {
    const analysis = JSON.parse(analysisRaw);
    return NextResponse.json({ analysis, status: "complete" });
  } catch {
    return NextResponse.json({ analysis: null, status: "pending" });
  }
}
