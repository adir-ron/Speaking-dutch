# Speaking Dutch

A personal mobile web app that helps Adir practice Dutch A1 → A2 → B1 through voice
conversation with an AI "patient friend." The product thesis is: **memory is the
product.** Every session makes the next sharper. Consumer AI voice tools fail at
this because an LLM context window isn't durable structured memory. This app owns
the memory model and treats the LLM as a voice-driver.

## Status

- **Planning complete.** Triple-gated: `/office-hours` + `/plan-eng-review` + `/plan-design-review` all CLEAR.
- **Pre-V1.** No app code written yet. The existing `server.js` / `public/index.html` / `words_data.json` are the forked Hebrew-vocab-quiz that this project is replacing — do not extend them.
- **Design system approved.** Variant C "Dutch Modern" — see [DESIGN.md](DESIGN.md) and [docs/design/mockups/](docs/design/mockups/).

## Read these first (fresh Claude / cloud handoff)

1. **[docs/design/README.md](docs/design/README.md)** — index of planning artifacts.
2. **[docs/design/plan.md](docs/design/plan.md)** — the full design doc. Problem, premises, architecture decisions, data model, session loop, cost/latency budgets, curriculum seed, failure modes, parallelization lanes, pre-build assignment.
3. **[DESIGN.md](DESIGN.md)** — design system (typography, color, spacing, motion, voice, components, responsive, a11y).
4. **[TODOS.md](TODOS.md)** — 3 deferred items with full context.
5. **[docs/design/test-plan.md](docs/design/test-plan.md)** — test plan for `/qa`.

If you have those read, you have the full context.

## User (Adir)

- Based in Amsterdam. Fractional CMO + demand-gen consultant.
- Currently A1 Dutch, pushing toward A2 first, then B1.
- 750-day Duolingo streak. Reading is fine; listening and speaking are weak.
- Tried ChatGPT/Claude voice mode and a custom GPT for Dutch practice. Both failed on memory, structure, and habit-formation. That failure motivated this project.
- Technical enough to build this with Claude Code. Prefers explicit > clever, minimal diff, edge cases over speed, DRY aggressively, well-tested code.
- Never uses em-dashes in writing. Authentic voice, not performative.

## Architecture (committed in the plan)

- **Framework:** Next.js 15 on Vercel, App Router. Route Handlers (NOT Server Actions) for streaming. Vercel Fluid Compute + 7am cron warmup for cold-start mitigation.
- **Auth:** passwordless magic link via Auth.js (NextAuth v5) + Resend email. Hardcoded allowlist of Adir's email. Auth is the API-cost gate, not multi-user.
- **DB:** SQLite via Turso (`@libsql/client`). Required (not optional) — Vercel is stateless.
- **STT:** Deepgram Nova-2 Dutch, streamed browser-direct via WSS with a 30s JWT from `/api/deepgram/token`.
- **TTS:** OpenAI TTS `nova` voice with streaming enabled, proxied via a `ReadableStream` Route Handler.
- **LLM:** Claude Sonnet 4.6 as both conversation brain and post-session analyzer. Pre-build spike required to verify Dutch register quality.
- **Budget:** ~$3.77/month. Cost breakdown in plan.md.
- **Latency target:** <3s first-audio after user finishes speaking.

## Data model (in plan.md §Data Model)

- `curriculum_items` — seeded A1/A2 content, CEFR-agnostic schema extensible to B2+.
- `learner_items` — attempts/successes/last_seen/confidence/error_notes per item.
- `sessions` — transcript + analysis + **prompt_log_json** (assembled system prompts per turn, for replay/debug).
- `buddy_phrases` — append-only anti-repetition log, last 20 surface to each new turn.
- Beta-prior smoothing on confidence: `(successes + 2) / (attempts + 4)` — avoids 1/1 = mastery bug.

## Session loop (in plan.md §Session Loop)

1. Middleware validates cookie → magic-link login if missing.
2. Cold start: pick `topic_small_talk_greetings` by `seed_order ASC LIMIT 1`. Warm: confidence < 0.7 AND last_seen > 12h.
3. Memory greeting composed in code from a template (not LLM — latency + determinism).
4. Tap-to-talk: first gesture unlocks iOS AudioContext + requests mic. Browser → Deepgram direct WSS.
5. Turn loop: app assembles system prompt (persona + target + error notes + last 6 turns + anti-repetition), calls Claude streaming, plays via TTS streaming. Logs prompt + response to `sessions.prompt_log_json`.
6. End after **7 turns OR 5 minutes, whichever first** (hard cap).
7. Post-session analyzer runs **async via Vercel `waitUntil()`** — panel shows approximate summary immediately, full analysis arrives ~3-5s later.

## Pre-build spikes (MUST run before any code — plan.md §The Assignment)

1. **STT reality check** — 30 min in Deepgram playground with 10 A1/A2 Dutch sentences in Adir's own voice. If WER > 25%, pause and redesign voice stack.
2. **Competitor field trip** — 30 min talking Dutch to Talkpal (or similar) on his phone. Log the 3 most concrete things missing.
3. **LLM register spike** — 15 min in Claude console verifying Sonnet 4.6 Dutch output lands at A1/A2 level.

Total pre-build: ~75 min. Saves potentially 16-24h of building on a voice stack that doesn't understand his Dutch.

## Build order (plan.md §Worktree Parallelization)

Lane A (sequential): pre-build spikes → project scaffolding + Turso + migrations → curriculum seed.
Then in parallel: Lane B (auth) + Lane C (learner model + prompt composer) + Lane D (voice UI).
Then: Lane E (session routes) + Lane F (analyzer) in parallel.
Then: Lane G (unit tests + E2E smoke + 2 manual eval suites).

## Out of scope for V1 (explicitly deferred)

Never build these without re-opening /office-hours:
- SRS math (stubbed as "resurface if last_seen > 1 session ago and confidence < 0.7")
- English escape-hatch button
- Topic switching / "buddy proposes, you confirm" home flow
- Eavesdropping mode (V2 flagship — see TODOS.md)
- Session-length options
- Multi-user
- PWA manifest (V1.1)
- ElevenLabs TTS A/B (only if nova proves annoying)
- Shadowing / pronunciation scoring
- B1+ content (future content drop — see TODOS.md)
- Progress heatmaps, streak counters, gamification of any kind

## Project conventions

- **Package manager:** npm (the fork uses package-lock.json). If starting fresh for V1, reach for pnpm or bun only if there's a real reason.
- **Testing:** Vitest for unit, Playwright for the one E2E smoke test, manual markdown-based eval suites for LLM quality (see `docs/design/test-plan.md`).
- **Commits:** conventional style, focus on *why* over *what*. Always include `Co-Authored-By: Claude ...` trailer. Small atomic commits preferred.
- **PRs:** use `/ship` at the end of each work session. Don't batch multiple features into one PR.
- **Design drift prevention:** when DESIGN.md and a mockup disagree, update the mockup. DESIGN.md is the source of truth for visual tokens.
- **Writing style in project docs:** short paragraphs, concrete file paths + line numbers, no em-dashes, no AI vocabulary ("delve", "robust", "comprehensive", etc.), no banned phrases ("here's the thing", "let me break this down"), direct about quality.
- **Security:** never commit `.env`, API keys, or `.claude/settings.local.json` (gitignored). Never check secrets into the repo. All API keys live in Vercel env vars.

## Deployment

- **Primary:** Vercel hobby tier on a personal subdomain (e.g., `dutch.ronron.nl`).
- **Staging:** none — Vercel preview deploys cover this for a single-user tool.
- **CI/CD:** Vercel auto-deploy on push to `master`. Feature work happens on branches, PR to master, merge triggers deploy.

## gstack

gstack is **vendored directly into this repo** and tracked in git. Each skill lives at `.claude/skills/<command>/` (flattened layout so the Claude Code harness discovers it without any host-level install) and shared helpers live at `.claude/skills/gstack/` (`bin/`, `lib/`, `scripts/`, `agents/`, `hosts/`, `model-overlays/`, `openclaw/`, `supabase/`, `test/`, `extension/`, `contrib/`, `setup/`, `docs/`). Every environment (local Mac, Claude Code on the web, mobile, Conductor workspaces) picks gstack up automatically on checkout.

Use `/browse` from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available commands: `/autoplan`, `/benchmark`, `/benchmark-models`, `/browse`, `/canary`, `/careful`, `/codex`, `/context-restore`, `/context-save`, `/cso`, `/design-consultation`, `/design-html`, `/design-review`, `/design-shotgun`, `/devex-review`, `/document-release`, `/freeze`, `/gstack-upgrade`, `/guard`, `/health`, `/investigate`, `/land-and-deploy`, `/learn`, `/make-pdf`, `/office-hours`, `/open-gstack-browser`, `/pair-agent`, `/plan-ceo-review`, `/plan-design-review`, `/plan-devex-review`, `/plan-eng-review`, `/plan-tune`, `/qa`, `/qa-only`, `/retro`, `/review`, `/setup-browser-cookies`, `/setup-deploy`, `/ship`, `/unfreeze`.

### Skill routing

When a request matches an available skill, ALWAYS invoke it via the Skill tool as your FIRST action.

- Product ideas, scope brainstorming → `/office-hours`
- Bugs, 500 errors, "why is this broken" → `/investigate`
- Ship / deploy / push / create PR → `/ship`
- QA / test the site / find bugs → `/qa`
- Code review / check my diff → `/review`
- Update docs after shipping → `/document-release`
- Weekly retro → `/retro`
- Design system / brand → `/design-consultation`
- Visual audit / design polish → `/design-review`
- Architecture review → `/plan-eng-review`
- Save progress → `/context-save`; resume / "where was I" → `/context-restore`

## Current review status

| Review | Status | Findings |
|---|---|---|
| CEO Review | not run | not needed — office-hours covered scope |
| Eng Review | **CLEAR** (2026-04-15) | 11 issues, 9 decisions applied, 1 regression test flagged |
| Design Review | **CLEAR** (2026-04-15) | score 4/10 → 9/10, 8 decisions applied, variant C approved |
| Outside Voice | issues_found (2026-04-15) | 2 cross-model tensions held by user with data-over-debate rationale |

**Verdict:** ENG + DESIGN CLEARED — ready to implement. Run pre-build spikes first.
