import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Temporary debug endpoint. Tests the Claude call directly.
export async function GET() {
  const hasKey = !!process.env.ANTHROPIC_API_KEY;

  if (!hasKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" });
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 50,
      messages: [{ role: "user", content: "Zeg hallo in het Nederlands." }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return NextResponse.json({ ok: true, model: response.model, reply: text });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: String(err),
      name: (err as Error)?.name,
      message: (err as Error)?.message,
    });
  }
}
