import type { CurriculumItem } from "./learner-model";
import { getDb } from "./db";
import { getErrorNotes } from "./learner-model";
import curriculum from "../seeds/curriculum.json";

export interface Turn {
  role: "buddy" | "user";
  text: string;
}

const PERSONA = `You are Buddy, a patient and warm Dutch conversation partner for an A1-level learner pushing toward A2.

Rules:
- Speak Dutch at A1/A2 level: short sentences, high-frequency vocabulary, mostly present tense and perfectum.
- Use simple word order. Avoid bijzin (subordinate clauses) unless the learner handles main-clause word order well.
- When the learner makes an error, gently model the correct form in your reply. Never interrupt or lecture mid-sentence.
- Stay in character as a friendly neighbor or acquaintance. Keep the conversation natural and flowing.
- If the learner switches to English, respond in Dutch but acknowledge what they said.
- Match the learner's pace. If they give short answers, ask follow-up questions. If they elaborate, keep the conversation going.
- Never use complex grammar the learner hasn't encountered yet.
- Always use the jij/je form (informal), not u.`;

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
  const errorNotes = await getErrorNotes(target.id);
  const antiRepetition = await getRecentBuddyPhrases();

  const parts: string[] = [PERSONA];

  // Today's target
  parts.push(`\n## Today's Focus\nItem: ${target.label} (${target.cefr_level}, ${target.kind})\n${target.description || ""}`);

  // Error notes from previous sessions
  if (errorNotes.length > 0) {
    parts.push(`\n## Learner's Recent Struggles with This Topic\n${errorNotes.map((n) => `- ${n}`).join("\n")}\nWeave corrections for these into the conversation naturally.`);
  }

  // Recent conversation (sliding window of last 6 turns = 3 exchanges)
  if (recentTurns.length > 0) {
    const window = recentTurns.slice(-6);
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
    "SELECT phrase_normalized FROM buddy_phrases ORDER BY ts DESC LIMIT 20",
  );
  return result.rows.map((r) => r.phrase_normalized as string);
}
