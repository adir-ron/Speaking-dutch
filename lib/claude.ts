import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

/**
 * Stream a conversation turn with Claude.
 * Returns the full response text and a ReadableStream for the client.
 */
export async function streamConversationTurn(
  systemPrompt: string,
  userMessage: string,
): Promise<{ stream: ReadableStream<Uint8Array>; getFullText: () => string }> {
  const anthropic = getClient();
  let fullText = "";

  const messageStream = anthropic.messages.stream({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 300,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      for await (const event of messageStream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          const text = event.delta.text;
          fullText += text;
          controller.enqueue(encoder.encode(text));
        }
      }
      controller.close();
    },
  });

  return {
    stream: readable,
    getFullText: () => fullText,
  };
}

/**
 * Run the post-session analyzer.
 * Returns structured JSON analysis of the session.
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
    model: "claude-sonnet-4-6-20250514",
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

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Analyzer returned no valid JSON");
  }

  return JSON.parse(jsonMatch[0]);
}
