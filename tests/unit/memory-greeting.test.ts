import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the learner-model module
vi.mock("@/lib/learner-model", () => ({
  getLastSessionContext: vi.fn(),
}));

import { composeGreeting } from "@/lib/memory-greeting";
import { getLastSessionContext } from "@/lib/learner-model";

const mockGetLastSession = vi.mocked(getLastSessionContext);

describe("composeGreeting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns cold-start greeting for first session", async () => {
    mockGetLastSession.mockResolvedValue(null);

    const result = await composeGreeting("Greetings & introductions");

    expect(result.isFirstSession).toBe(true);
    expect(result.eyebrow).toBe("LET'S BEGIN");
    expect(result.memory).toContain("Hallo");
    expect(result.today).toContain("greetings & introductions");
    // Day label should be time-of-day, not "Day 1"
    expect(["Morning", "Afternoon", "Evening"]).toContain(result.dayLabel);
  });

  it("returns memory greeting for returning user", async () => {
    mockGetLastSession.mockResolvedValue({
      targetLabel: "Modal verbs",
      confidence: 0.5,
      sessionNumber: 3,
      errorNotes: ["Mixed up word order with kunnen"],
    });

    const result = await composeGreeting("Separable verbs");

    expect(result.isFirstSession).toBe(false);
    expect(result.eyebrow).toBe("YESTERDAY");
    expect(result.dayLabel).toBe("Day 4"); // sessionNumber + 1
    expect(result.memory).toContain("modal verbs");
    expect(result.memory).toContain("Mixed up word order");
    expect(result.today).toContain("separable verbs");
  });

  it("shows confidence-based message when no errors", async () => {
    mockGetLastSession.mockResolvedValue({
      targetLabel: "Present tense",
      confidence: 0.8,
      sessionNumber: 5,
      errorNotes: [],
    });

    const result = await composeGreeting("Perfectum");

    expect(result.memory).toContain("nailed");
    expect(result.memory).toContain("present tense");
  });

  it("shows neutral message for mid-range confidence with no errors", async () => {
    mockGetLastSession.mockResolvedValue({
      targetLabel: "Weather chat",
      confidence: 0.4,
      sessionNumber: 2,
      errorNotes: [],
    });

    const result = await composeGreeting("Grocery shopping");

    expect(result.memory).toContain("Getting there");
  });
});
