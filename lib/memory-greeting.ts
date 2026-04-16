import { getLastSessionContext } from "./learner-model";

export interface MemoryGreeting {
  dayLabel: string; // "Morning" | "Day N" | null (hide pill)
  eyebrow: string; // "YESTERDAY" | "LET'S BEGIN"
  memory: string; // main greeting text (HTML allowed for styling)
  today: string; // what we'll work on today
  isFirstSession: boolean;
}

function getTimeOfDay(): "Morning" | "Afternoon" | "Evening" {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

export async function composeGreeting(
  targetLabel: string,
): Promise<MemoryGreeting> {
  const lastSession = await getLastSessionContext();

  // Cold start: first-ever session
  if (!lastSession) {
    return {
      dayLabel: getTimeOfDay(),
      eyebrow: "LET'S BEGIN",
      memory: '<span class="font-serif" style="font-style: italic; color: var(--accent-deep)">Hallo.</span> Let\'s get to know each other.',
      today: `We'll start with ${targetLabel.toLowerCase()}. Short session, about 5 minutes.`,
      isFirstSession: true,
    };
  }

  const sessionNumber = lastSession.sessionNumber + 1; // upcoming session number

  // Build memory text based on last session outcome
  let memoryText: string;
  if (lastSession.errorNotes.length > 0) {
    memoryText = `Last time you worked on ${lastSession.targetLabel.toLowerCase()}. ${lastSession.errorNotes[0]}`;
  } else if (lastSession.confidence >= 0.7) {
    memoryText = `Last time you nailed ${lastSession.targetLabel.toLowerCase()}. Solid.`;
  } else {
    memoryText = `Last time you practiced ${lastSession.targetLabel.toLowerCase()}. Getting there.`;
  }

  return {
    dayLabel: `Day ${sessionNumber}`,
    eyebrow: "YESTERDAY",
    memory: memoryText,
    today: `Today: ${targetLabel.toLowerCase()}, in a new conversation.`,
    isFirstSession: false,
  };
}
