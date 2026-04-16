# LLM Eval Suites

Manual evaluation suites for the Speaking Dutch conversation quality.
Run these by hand (not in CI) after the core loop is working.

## Eval 1: Buddy Register (10 prompts)

Feed 10 A1/A2 conversational situations into the prompt composer + Claude.
For each, hand-judge:

- Does the reply use A1/A2 vocabulary?
- Short sentences (under 15 words)?
- Avoids bijzin (subordinate clause) word order?
- Corrects previous error (if any) gently in the reply without interrupting?
- Uses the jij/je form (informal), not u?

**Pass criteria:** 8/10 prompts score "good" on all dimensions.

### Sample prompts

1. Cold start greeting for `topic_greetings`
2. User says: "Ik heet Adir. Ik kom uit Israel."
3. User says: "Ik wil een koffie" (missing alstublieft)
4. User says: "Gisteren ik heb gewerkt" (wrong word order for perfectum)
5. User says nothing (empty transcript)
6. User mixes English: "I don't know how to say 'appointment' in Dutch"
7. User gives a one-word answer: "Ja"
8. User produces a correct complex sentence (should acknowledge)
9. Mid-session with 3 prior turns about weather
10. Last turn of a 7-turn session about groceries

## Eval 2: Analyzer Accuracy (10 hand-labeled transcripts)

Create 10 mock transcripts with known ground truth:
- How many times did the learner attempt the target concept?
- How many were successful?
- What specific errors occurred?

Run the analyzer on each. Score:

- **Attempt detection precision/recall:** Did it find all attempts? Did it hallucinate extras?
- **Success detection accuracy:** Does the success count match ground truth +/- 1?
- **Error categorization:** Are the noted errors real and actionable?

**Pass criteria:** Precision >= 0.8, Recall >= 0.7 on attempt detection across 10 transcripts.
