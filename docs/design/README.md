# docs/design

Planning artifacts from the /office-hours → /plan-eng-review → /plan-design-review pipeline (2026-04-15). Read these in order when picking up this branch.

## Files

| File | Purpose |
|---|---|
| [plan.md](plan.md) | The full design doc. Source of truth for WHAT to build. Covers problem, premises, architecture decisions, data model, session loop, cost budget, latency budget, error handling, curriculum seed, approved mockups, parallelization lanes, failure modes, and the pre-build assignment. Status: APPROVED (eng-reviewed + design-reviewed). |
| [test-plan.md](test-plan.md) | Test plan artifact from /plan-eng-review. Affected routes, key interactions, edge cases, critical paths, and LLM eval suites. Consumed by `/qa` during QA passes. |
| [mockups/variant-C-dutch-modern.html](mockups/variant-C-dutch-modern.html) | **APPROVED** visual reference — home screen (idle state). |
| [mockups/states.html](mockups/states.html) | All 5 mic states (idle, recording, transcribing, thinking, speaking) with motion + spec table. |
| [mockups/variant-A-notebook.html](mockups/variant-A-notebook.html) | Rejected alternative — kept for reference. |
| [mockups/variant-B-quiet.html](mockups/variant-B-quiet.html) | Rejected alternative — kept for reference. |
| [mockups/approved.json](mockups/approved.json) | Metadata: which variant was chosen, direction description, date, branch. |

## Companion files in the repo root

- **[CLAUDE.md](../../CLAUDE.md)** — project conventions + gstack skill routing.
- **[DESIGN.md](../../DESIGN.md)** — design system tokens, type, color, spacing, motion, voice, components, a11y. Implementation reads from here.
- **[TODOS.md](../../TODOS.md)** — deferred work (buddy_phrases prune, B1+ content, Eavesdropping V2), each with full context.

## Order of operations for the cloud handoff

1. Read `docs/design/plan.md` end-to-end. It's the whole story.
2. Read `DESIGN.md` to understand visual tokens.
3. Open `docs/design/mockups/variant-C-dutch-modern.html` and `states.html` in a browser to see the target UI.
4. Read the "The Assignment" section at the bottom of plan.md — three pre-build spikes to run (~75 min) before any code.
5. After spikes, start Lane A from the "Worktree Parallelization Strategy" section of plan.md.
