import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-5-20250929";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

/**
 * Stream a conversation turn, yielding text chunks as they arrive from Claude.
 * The caller can progressively pipe these chunks to TTS for lower latency.
 */
export async function* streamConversationTurn(
  systemPrompt: string,
  userMessage: string,
): AsyncGenerator<string, void, unknown> {
  const anthropic = getClient();

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 150,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

/**
 * Non-streaming convenience wrapper. Buffers the full response into a string.
 */
export async function conversationTurn(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  let fullText = "";
  for await (const chunk of streamConversationTurn(systemPrompt, userMessage)) {
    fullText += chunk;
  }
  return fullText;
}

/**
 * Run the post-session analyzer.
 */
export async function analyzeSession(
  targetItemId: string,
  targetLabel: string,
  targetDescription: string,
  transcript: Array<{ role: string; text: string }>,
): Promise<{
  item_id: string;
  turn_count: number;
  successes: number;
  attempts: number;
  errors: Array<{ turn_index: number; error_type: string; note: string }>;
  vocab_used_correctly: string[];
  vocab_struggled: string[];
  summary_note: string;
}> {
  const anthropic = getClient();

  const transcriptText = transcript
    .map((t, i) => `Turn ${i + 1} (${t.role}): ${t.text}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system: `You are a Dutch language learning analyst. Analyze the conversation transcript and evaluate the learner's performance on the target curriculum item.

Return ONLY valid JSON matching this schema:
{
  "item_id": string,
  "turn_count": number,
  "successes": number (times learner correctly used the target concept),
  "attempts": number (times learner attempted the target concept),
  "errors": [{"turn_index": number, "error_type": string, "note": string}],
  "vocab_used_correctly": [string],
  "vocab_struggled": [string],
  "summary_note": string (one-sentence summary for error_notes, in English)
}

Count an "attempt" as any time the learner tried to use the target grammar concept or topic vocabulary. Count a "success" as an attempt that was correct or close enough to be understood. Be generous but honest.`,
    messages: [
      {
        role: "user",
        content: `Target item: ${targetLabel} (ID: ${targetItemId})
Description: ${targetDescription}

Transcript:
${transcriptText}

Analyze the learner's performance on "${targetLabel}". Return JSON only.`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Analyzer returned no valid JSON");
  }

  return JSON.parse(jsonMatch[0]);
}
