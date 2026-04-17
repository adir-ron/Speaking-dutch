import type { CurriculumItem } from "./learner-model";
import { getDb } from "./db";
import { getErrorNotes } from "./learner-model";
import curriculum from "../seeds/curriculum.json";

export interface Turn {
  role: "buddy" | "user";
  text: string;
}

const PERSONA = `You are Buddy, a patient Dutch conversation partner for an A1 learner.

Rules:
- Reply with ONE short Dutch sentence, then ONE concrete question with a clear answer (name, number, place, yes/no).
- NEVER ask open-ended questions like "vertel me over jezelf" or "wat vind je leuk". Ask specific questions: "Wat is je naam?", "Waar woon je?", "Hoeveel kinderen heb je?", "Heb je honger?", "Ga je vaak naar de markt?"
- Use jij/je (informal), never u.
- High-frequency vocabulary only. Present tense mostly, perfectum if the topic calls for it.
- If the learner makes an error, model the correct form naturally in your reply. No lectures.
- If they reply in English, respond in Dutch anyway.
- Keep the total reply under 20 words.`;

/**
 * Get opening lines for a curriculum item from the seed data.
 */
export function getOpeningLines(itemId: string): string[] {
  const item = curriculum.find((c) => c.id === itemId);
  return item?.opening_lines ?? [];
}

/**
 * Compose the full system prompt for a conversation turn.
 */
export async function composeSystemPrompt(
  target: CurriculumItem,
  recentTurns: Turn[],
  sessionId: string,
): Promise<string> {
  const [errorNotes, antiRepetition] = await Promise.all([
    getErrorNotes(target.id),
    getRecentBuddyPhrases(),
  ]);

  const parts: string[] = [PERSONA];

  // Today's target
  parts.push(`\n## Today's Focus\nItem: ${target.label} (${target.cefr_level}, ${target.kind})\n${target.description || ""}`);

  // Error notes from previous sessions
  if (errorNotes.length > 0) {
    parts.push(`\n## Learner's Recent Struggles with This Topic\n${errorNotes.map((n) => `- ${n}`).join("\n")}\nWeave corrections for these into the conversation naturally.`);
  }

  // Recent conversation (sliding window of last 6 turns = 3 exchanges)
  if (recentTurns.length > 0) {
    const window = recentTurns.slice(-4);
    const formatted = window
      .map((t) => `${t.role === "buddy" ? "Buddy" : "Learner"}: ${t.text}`)
      .join("\n");
    parts.push(`\n## Recent Conversation\n${formatted}`);
  }

  // Anti-repetition
  if (antiRepetition.length > 0) {
    parts.push(`\n## Phrases You've Already Used (do NOT repeat these)\n${antiRepetition.map((p) => `- "${p}"`).join("\n")}`);
  }

  return parts.join("\n");
}

/**
 * Get the last 20 buddy phrases for anti-repetition.
 */
async function getRecentBuddyPhrases(): Promise<string[]> {
  const db = getDb();
  const result = await db.execute(
    "SELECT phrase_normalized FROM buddy_phrases ORDER BY ts DESC LIMIT 8",
  );
  return result.rows.map((r) => r.phrase_normalized as string);
}
