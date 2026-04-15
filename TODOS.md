# TODOS

Captured during /plan-eng-review on 2026-04-15. Each item has enough context to pick up cold.

---

## buddy_phrases monthly prune job

**What:** A weekly Vercel cron that deletes rows from `buddy_phrases` older than 30 days.

**Why:** Anti-repetition only needs the last 20 rows (current + last 2 sessions' worth). The table grows unbounded at ~200 rows/month. Fine for a year, wasteful forever.

**Pros:** Keeps the table bounded. Faster index scans as a side effect.

**Cons:** Adds a cron job (minor infra). Introduces a new failure surface (cron that silently fails to run).

**Context:** Added in V1 per eng-review Issue 1D (dedicated anti-repetition table instead of parsing `transcript_json`). The prune isn't urgent because SQLite handles 100K rows trivially, so V1 ships without it. Revisit when `SELECT COUNT(*) FROM buddy_phrases` exceeds ~5,000.

**Depends on / blocked by:** V1 ship.

**Implementation sketch:**
```
// vercel.json → crons
{ "path": "/api/cron/prune-phrases", "schedule": "0 3 * * 0" }

// app/api/cron/prune-phrases/route.ts
export async function GET(req: Request) {
  // Verify Vercel cron secret header
  await db.execute(
    "DELETE FROM buddy_phrases WHERE ts < datetime('now', '-30 days')"
  );
  return Response.json({ ok: true });
}
```

---

## B1+ curriculum content drop

**What:** Extend `seeds/curriculum.json` with ~15 new B1 grammar concepts and topic clusters, adjust CEFR gating thresholds, write opening-line templates for each.

**Why:** V1 seeds A1→A2 because that's where the user is now. The schema is CEFR-agnostic and gating is confidence-based, so B1 content is additive — not a rewrite. As the user's confidence on A2 core items crosses the threshold, the app needs B1 items to surface or progression stalls.

**Pros:** Unlocks the user's full progression path. Demonstrates the curriculum-as-content-drop thesis in practice.

**Cons:** Real content work (not just code). Each item needs: CEFR tag, teaching notes, 3-5 opening-line templates, prereq_ids. ~15 items × ~20 min each ≈ 5 hours.

**Context:** Premise #2 of the design doc commits to "adding B1 content is a content-loading session, not a rewrite." This TODO is that session. Trigger: when ≥4 A2 items hit confidence ≥ 0.7 AND user reports feeling ready to stretch.

**Depends on / blocked by:** V1 has shipped and been used for ~2-4 weeks with measurable confidence growth on the A2 core.

**Implementation sketch:**
- B1 grammar candidates: word order in bijzinnen (subordinate clauses), relative pronouns (die/dat/wie/welke), passive voice (wordt + voltooid deelwoord), conditional (als ik zou...), adverbial phrases, reported speech.
- B1 topic candidates: giving opinions on current events, describing a past experience in detail, handling a complaint, work/professional small talk, making plans with a friend, explaining a preference with reasons.
- Re-run /office-hours before starting to revisit the plan in light of what V1 usage taught us.

---

## Eavesdropping mode (V2 flagship feature)

**What:** The app generates a 15-30 second Dutch dialogue between two speakers (two neighbors gossiping, shopkeeper + customer, doctor + patient), plays it with distinct TTS voices, then asks comprehension questions in Dutch that the user answers in Dutch.

**Why:** Directly attacks the listening gap. Real Dutch-in-the-wild is overhearing fast native speech between two locals at Albert Heijn, not someone talking slowly TO you. The cross-model subagent in /office-hours called this the single coolest thing the user hadn't considered. The conversational V1 builds user comfort SPEAKING; eavesdropping builds comfort LISTENING to native-pace Dutch.

**Pros:** Differentiates sharply from every competitor. Uses the same learner model (track what vocab/grammar user comprehended vs missed). Lower performance anxiety than conversation (user is listening, not performing on command). Scales the curriculum — one dialogue template = many variations.

**Cons:** Real scope. Needs: (a) dialogue-generation prompts with good two-voice coherence, (b) two-voice TTS orchestration (probably different `openai.tts.voice` values per speaker), (c) comprehension-check UI (plays clip → stops → waits for answer), (d) a new learner-model dimension (comprehension score, not production score). Estimated 20-30h CC time.

**Context:** Premise of V2 per the design doc. Trigger: V1 success criteria all met after 7+ days, user is hungry for more. Don't start this if V1 hasn't earned it — it's a significant expansion that only pays off if the user already loves the conversational loop.

**Depends on / blocked by:**
1. V1 shipped and meeting its success criteria.
2. At least one more /office-hours session to define the V2 shape (should comprehension mode be a toggle on the home screen, or a separate button, or alternate days?).
3. Possibly a /plan-design-review pass on the comprehension-check UI.

**Implementation sketch:**
- New route: `app/api/eavesdrop/generate` — asks Claude to produce a dialogue given a scenario + user's current CEFR level + target grammar/vocab items from learner model.
- New route: `app/api/eavesdrop/check` — post-listening comprehension Q&A turn, same pipeline as session/turn.
- New table: `eavesdrop_sessions` (parallel to `sessions` but with `dialogue_script_json` instead of user turns).
- TTS: use two distinct voice IDs (e.g., `nova` + `shimmer` from OpenAI). Could upgrade to ElevenLabs here for voice diversity if needed.

---

## Notes on format

Each TODO above includes: what, why, pros, cons, context, depends-on, implementation sketch. This is the standard required by /plan-eng-review — a TODO without context is worse than no TODO because it creates false confidence that the idea was captured while actually losing the reasoning.
