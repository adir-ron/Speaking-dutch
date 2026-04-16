import { NextRequest, NextResponse } from "next/server";

// Temporary debug endpoint. Tests models directly via fetch.
export async function GET(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" });
  }

  // First, list available models
  let models: string[] = [];
  try {
    const modelsRes = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });
    if (modelsRes.ok) {
      const data = await modelsRes.json();
      models = (data.data || []).map((m: { id: string }) => m.id).slice(0, 20);
    } else {
      models = [`list failed: ${modelsRes.status}`];
    }
  } catch (err) {
    models = [`list error: ${String(err)}`];
  }

  // Try the first sonnet model we find, or a fallback list
  const tryModels = [
    "claude-sonnet-4-5-20241022",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-sonnet-latest",
    "claude-3-haiku-20240307",
  ];

  const results: Record<string, string> = {};

  for (const model of tryModels) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 20,
          messages: [{ role: "user", content: "Zeg hallo" }],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        results[model] = `OK: ${data.content?.[0]?.text || "no text"}`;
        break; // found a working model, stop
      } else {
        results[model] = `${res.status}: ${data.error?.message || "unknown"}`;
      }
    } catch (err) {
      results[model] = `error: ${String(err)}`;
    }
  }

  return NextResponse.json({ available_models: models, test_results: results });
}
