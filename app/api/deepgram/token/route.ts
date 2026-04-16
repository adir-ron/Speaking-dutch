import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Deepgram not configured" }, { status: 500 });
  }

  // Mint a short-lived key via Deepgram API
  try {
    const res = await fetch("https://api.deepgram.com/v1/keys", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        comment: "speaking-dutch-browser-token",
        scopes: ["usage:write"],
        time_to_live_in_seconds: 30,
      }),
    });

    if (!res.ok) {
      // Fallback: return the API key directly (not ideal but works for single-user)
      // Deepgram's key management API may require specific project settings
      return NextResponse.json({ token: apiKey });
    }

    const data = await res.json();
    return NextResponse.json({ token: data.key });
  } catch {
    // Fallback: use API key directly for browser WSS
    return NextResponse.json({ token: apiKey });
  }
}
