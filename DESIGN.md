# Design System — Speaking Dutch

Source of truth for all visual decisions. Variant C ("Dutch Modern") was approved on 2026-04-15 via /plan-design-review. Reference implementation: `docs/design/mockups/variant-C-dutch-modern.html` and `.../states.html`.

If this file disagrees with a mockup, the mockup is wrong — update the mockup, not this file.

## Principles

- **Memory is legible.** The user must feel remembered within 3 seconds of opening the app. Visual hierarchy serves this.
- **One anchor per screen.** The tap-to-talk mic is the single dominant element. Nothing else competes for primary attention.
- **Warm, not bright.** Calm surfaces, never Duolingo-bright. The palette feels like paper, not plastic.
- **Color state is binary.** Cream surface = user's turn or processing. Filled tangerine = user is recording. Never ambiguous which side of the conversation you're on.
- **Motion improves hierarchy or atmosphere.** No decorative motion. Every animation answers "where are we in the loop right now?"
- **Typography carries the emotional load.** Newsreader serif for anything that should feel personal (memory, brand, empty states). Inter sans for utility and status.
- **Voice is warm, not chirpy.** "Having trouble hearing you" not "Oops! Something went wrong 😊".

## Typography

Serif: **Newsreader** (Google Fonts variable). Uses `opsz` for optical sizing.
Sans: **Inter** (Google Fonts variable).

Both loaded via:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap" rel="stylesheet">
```

| Use | Font | Size | Weight | Other |
|---|---|---|---|---|
| Memory greeting (main) | Newsreader | 30px | 400 | line-height 1.2, letter-spacing -0.015em |
| "Today" continuation | Newsreader | 21px | 400 italic | line-height 1.3, color var(--ink-soft) |
| Brand wordmark | Newsreader | 18px | 500 italic | tangerine dot before, "Dutch" italic |
| Panel empty state | Newsreader | 15px | 400 italic | color var(--ink-soft) |
| UI label (eyebrow) | Inter | 11px | 600 | letter-spacing 0.14em, uppercase |
| Body / CTA | Inter | 14px | 500 | letter-spacing -0.005em |
| Day pill | Inter | 11px | 600 | uppercase, 0.08em tracking |
| Mono (code/keys) | JetBrains Mono | 12px | 400 | — |

Never use default system fonts. Never use Arial, Helvetica, or Roboto as fallbacks above Inter.

## Color

CSS variables, defined at `:root`:

```css
:root {
  --bg:            #F4EDE1;  /* warm ecru base */
  --bg-card:       #FBF7EE;  /* lifted surface (panels, cards) */
  --ink:           #141414;  /* primary text */
  --ink-soft:      #4A443C;  /* body secondary */
  --ink-whisper:   #8A8271;  /* tertiary, labels, placeholders */
  --rule:          #E0D6C3;  /* hairline dividers, card borders */
  --accent:        #DC5B2B;  /* Dutch tangerine — primary action */
  --accent-deep:   #B64416;  /* pressed, active, error text */
  --accent-wash:   #F8DCCC;  /* accent background (pill, highlight swipe) */
  --state-rec:     #DC5B2B;  /* recording fill (== --accent) */
  --state-rec-dot: #E03B3B;  /* pulsing red dot on recording mic only */
}
```

Contrast-checked pairings (WCAG AA minimum 4.5:1 for body text):

| Text | Background | Ratio | Pass? |
|---|---|---|---|
| `--ink` (#141414) on `--bg` (#F4EDE1) | ecru | 13.4:1 | AAA |
| `--ink-soft` (#4A443C) on `--bg` | ecru | 8.9:1 | AAA |
| `--ink-whisper` (#8A8271) on `--bg` | ecru | 3.6:1 | AA Large only — use for 14px+ only |
| `--accent-deep` (#B64416) on `--accent-wash` (#F8DCCC) | wash | 4.7:1 | AA |
| `--accent` (#DC5B2B) on `--bg` (#F4EDE1) | ecru | 3.4:1 | NOT for body text — use for 18px+ or decorative only |
| white on `--accent` (recording mic icon) | tangerine | 4.9:1 | AA |

Any new color pairing requires a contrast check before it ships.

## Spacing (8pt grid)

Only these values: `4, 8, 12, 16, 24, 32, 40, 56, 80`. Everything else is a bug. Phone screen horizontal padding: 28px (odd exception, intentional for iPhone 14 viewport).

## Radius

- `14px` — cards, panels, elevated surfaces
- `8px` — buttons, inputs, small pills
- `999px` — status pills (Day-N chip), chip-style tags
- `50%` — mic button only

No other radii. Do not reach for 4px, 6px, 10px, 12px, 16px, 20px.

## Shadow

Only two shadow recipes. Do not invent new ones.

**`--shadow-card`** (cards, panels, non-action elevated surfaces):
```css
box-shadow: 0 1px 0 rgba(20,20,20,0.02);
border: 1px solid var(--rule);
```
Borders do most of the work. Shadows are whispers.

**`--shadow-mic-idle`** (the mic button in idle state):
```css
box-shadow:
  inset 0 2px 0 rgba(255,255,255,0.8),
  inset 0 -2px 4px rgba(180,70,22,0.08),
  0 20px 40px -14px rgba(60,40,20,0.35),
  0 4px 12px -4px rgba(60,40,20,0.18);
```

**`--shadow-mic-rec`** (the mic button while recording):
```css
box-shadow:
  inset 0 2px 0 rgba(255,255,255,0.3),
  0 0 0 6px rgba(220,91,43,0.15),
  0 0 0 18px rgba(220,91,43,0.08),
  0 18px 40px -14px rgba(180,70,22,0.5);
```

## Motion

Everything respects `prefers-reduced-motion: reduce`. When that media query matches:
- All looping animations stop.
- Keep only opacity transitions (panel slide-in → becomes fade-in only).
- The recording-ring emanation still plays (it's the primary affordance for "we are listening"). All other decorative motion turns off.

| Motion | Duration | Easing | Iteration | Notes |
|---|---|---|---|---|
| mic idle breathe | 4s | ease-in-out | infinite | scale 1 ↔ 1.025 |
| mic halo rotate (idle) | 24s | linear | infinite | slow, barely perceptible |
| mic halo rotate (thinking) | 6s | linear | infinite | 4× faster than idle, signals work |
| recording rings | 1.4s | ease-out | infinite, 3-way stagger 0s / 0.46s / 0.92s | scale 0.9 → 1.45, opacity 0.8 → 0 |
| red-dot pulse (recording) | 1s | ease-in-out | infinite | opacity 1 ↔ 0.4 |
| transcribing shimmer | 1.1s | ease-in-out | infinite | diagonal sweep on mic surface |
| thinking dots | 1.2s | ease-in-out | infinite, 3 dots staggered 0s / 0.2s / 0.4s | translateY 0 → -4px |
| speaking EQ bars | 0.8s | ease-in-out | infinite, 5 bars staggered 0s–0.4s | scaleY 1 ↔ 0.4 |
| speaking sound waves | 2s | ease-out | infinite, 2 waves staggered 0s / 1s | scale 0.95 → 1.5, opacity 0.6 → 0 |
| panel slide-in (session end) | 500ms | ease-out | once | translateY 16px → 0, opacity 0 → 1 |
| session-end mic fade | 400ms | ease-in-out | once | opacity 1 → 0.4 |

## Components

### Mic button
- 168px diameter on home screen, 140px on states grid.
- One component, five visual states driven by a `data-state` attribute: `idle | recording | transcribing | thinking | speaking`.
- Minimum touch target: 168px (well above 44px WCAG minimum).
- ARIA label changes per state: "Tap to start" / "Stop recording" / "Transcribing" / "Thinking" / "Interrupt and speak".
- Keyboard: space or enter triggers the primary action for the current state.

### Feedback panel ("What Buddy noticed")
- Card, 14px radius, `--bg-card` surface, `--rule` border.
- Empty state: italic Newsreader placeholder, quiet.
- Populated state: 3–5 short bullets, each prefixed with a **status glyph**:
  - **✓** tangerine `--accent` — user got this right (attempted and succeeded).
  - **○** muted `--ink-whisper` — partial credit (attempted, got some right).
  - **↻** tangerine `--accent` — "Buddy will bring this back tomorrow" — the item is going back into the review queue.
  - **No red X ever.** Errors are opportunities, not failures. This is a design rule, not a preference.
- Glyph is 16px, sits on the baseline of the first line of bullet text, with 12px gap to the text.
- Bullet text: Inter 14px, weight 400, line-height 1.45, color `--ink`.
- Animates in via `panel slide-in` when session ends.

### Cold-start state (first-ever session)

On the very first open, there is no memory. The screen MUST feel honest and warm, not fake-familiar.

- Day pill: **"Morning"** / **"Afternoon"** / **"Evening"** (by local time) — NOT "Day 1".
- Eyebrow: **"Let's begin"** (replaces "Yesterday").
- Memory slot (main): `<p class="memory">Hallo. Let's get to know each other.</p>`
  - "Hallo" is in Newsreader italic, colored `--accent-deep`, setting the language pact.
  - No highlight swipe on day 1 — nothing to emphasize yet.
- Today slot: `<p class="today">We'll start with small-talk greetings. Short session, about 5 minutes.</p>`
- Feedback panel: shown but empty, same placeholder as a returning user pre-session.

After the first session ends, the greeting pattern switches permanently to the "Yesterday / Today" format documented above.

### Error UI pattern

Errors use **inline status swap on the mic zone**. Never modals, never toasts, never full-screen errors.

- Mic button enters a soft paused state: opacity 0.6, all animations disabled, color unchanged.
- The text label below the mic (normally "Tap to start" / "Listening" / etc.) swaps to the error message in `--accent-deep` color, Inter 14px weight 500.
- The hint line below (normally "about 5 minutes" / "tap again when done") swaps to actionable guidance if helpful, in italic Newsreader 13px `--ink-whisper`.
- Tapping the mic retries the last action. No separate "retry" button.

Messages by failure type:

| Failure | Main line | Hint line |
|---|---|---|
| STT dropped mid-utterance | "Having trouble hearing you" | "tap to try again" |
| STT retry x2 exhausted | "Can't seem to hear you today" | "tap to end the session" |
| Claude API timeout | "Buddy is thinking too hard" | "tap to try again" |
| Claude retry exhausted | "Buddy needs a minute — try again in a bit" | "your progress is saved" |
| TTS failed | "Trouble speaking. Here's what Buddy said:" | *(falls back to showing Dutch text below)* |
| Mic permission denied | "I need microphone access to hear you" | "tap to open settings" |
| Network offline | "You're offline. Reconnect to keep going." | *(no hint)* |

After a successful retry, the mic immediately returns to its normal state. No success toast.

### Day pill
- `--accent-wash` background, `--accent-deep` text, 999px radius, 6px × 10px padding.
- Purely informational — never tappable.
- Content by session number:
  - Session 1 (brand new): **"Morning"** (or "Evening" / "Afternoon" by local time) — not "Day 1" because on day 1 there's no streak yet.
  - Session 2–99: **"Day N"**.
  - Session 100+: **"Day N"** (no cap, no special treatment — graceful).
- Hide pill entirely if user opens the app more than once in a day (second+ session shows no pill).

### Brand wordmark
- "Speaking Dutch" with italic "Dutch" (Newsreader italic).
- Tangerine filled dot (●) precedes the word, sized to match the x-height.
- 18px, weight 500. Never replace with an icon.

## Voice (copywriting)

- **Labels** (uppercase): short plural noun. "YESTERDAY", "TODAY", "WHAT BUDDY NOTICED".
- **CTAs**: imperative but warm. "Tap to start", "tap again when done", "tap to interrupt".
- **Status**: casual, present-tense, 1–4 words. "Listening", "Buddy is thinking", "Got it".
- **Errors**: humble, actionable. Never accusatory. "Having trouble hearing you — tap to try again" ✓. "Oops! Something went wrong" ✗.
- **Empty states**: hint what will appear. "Your feedback from today's conversation will show up here." Not "Nothing yet."
- **Dutch in UI**: never mix Dutch words into English UI chrome. The only Dutch text on screen comes from Buddy's actual replies. The "memory greeting" is English explaining Dutch struggles — not Dutch itself.

## Responsive

V1 target: mobile web (iOS Safari, Android Chrome), 375–430px viewport widths.

| Viewport | Behavior |
|---|---|
| 375px (iPhone SE) | 24px horizontal padding, mic 152px, all other tokens unchanged |
| 390–414px (iPhone 14/15 standard) | 28px padding, mic 168px — the reference |
| 430px+ (iPhone Pro Max) | 32px padding, mic 176px |
| tablet + desktop | V1: center-clamp the 430px mobile layout in the viewport. Letterbox is a warm dark-ecru (`#2A241B`) surrounding the clamped mobile layout. Full two-column desktop deferred to V1.1. |

### Desktop clamp (V1 spec)

```css
@media (min-width: 768px) {
  html, body { background: #2A241B; }      /* warm dark-ecru letterbox */
  body { padding: 48px 0; }
  .phone {
    max-width: 430px;
    margin: 0 auto;
    box-shadow: 0 24px 80px -20px rgba(0,0,0,0.5);
    border-radius: 28px;
    min-height: calc(100vh - 96px);
  }
}
```

Landscape orientation on mobile: not designed for V1 (short sessions, held in portrait). Rotate notice if detected: "Rotate back to portrait for the best experience."

## Accessibility

- Touch targets ≥ 44px × 44px (mic is 168px, way above).
- Focus rings on all interactive elements: 3px solid `--accent`, offset 2px, visible on keyboard focus only (`:focus-visible`).
- `aria-live="polite"` on the status label below the mic — announces state changes to screen readers.
- `aria-label="Tap to start"` etc. on the mic, updated with state changes.
- `prefers-reduced-motion: reduce` honored as specified in Motion section.
- Color contrast: all body text ≥ 4.5:1 (AA). Large text ≥ 3:1.
- Language: `<html lang="en">` for the UI. `lang="nl"` explicitly set on any element containing Dutch text (matters for screen-reader pronunciation).

## What NOT to do (anti-patterns)

- No purple/indigo/blue-to-purple gradients anywhere.
- No 3-column feature grids with icons-in-colored-circles.
- No emoji as UI chrome (real SVG icons or nothing).
- No "streak counter" with flames or gamification theater. The Day-N pill is the only progress element.
- No modal dialogs with "Congrats!" or "Level up!" messaging. There are no levels.
- No decorative blobs, floating circles, wavy SVG dividers.
- No default font fallbacks above Inter / Newsreader — if the custom fonts fail to load, fall back to Georgia (for Newsreader) and to `-apple-system` (for Inter) only.
- No generic hero copy ("Welcome back!", "Your journey continues", "Ready to practice?"). Every word earns its place.

## Approved reference mockups

| Screen | File | What it demonstrates |
|---|---|---|
| Home (idle) | `docs/design/mockups/variant-C-dutch-modern.html` | Base layout, typography, color, memory greeting pattern |
| Mic states (5) | `docs/design/mockups/states.html` | All 5 mic states with motion, spec table |

Keep these files. They are part of the living design spec.
