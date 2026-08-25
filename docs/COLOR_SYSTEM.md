# Ouriva — Color System

A reference for every color token in the app: what it means, where it's used, and the rules for adding new UI without reintroducing the sprawl this document replaces.

## Why this exists

Before this pass, "positive" was drawn from two unrelated hues (`emerald` *and* `green`, split across ~20 files by whichever the original author reached for), "caution" from two more (`amber` and `orange`), the Budget Split buckets used literal `blue-500`/`amber-500` with no relation to anything else, and the two charts hand-rolled a *third* independent set of colors because Recharts can't read CSS custom properties. None of this was a deliberate design decision — it was drift, one component at a time.

The fix is a small, closed set: **one neutral ramp + 7 semantic colors**, each with exactly one job. If you're about to add a color, look here first — the thing you need probably already exists.

## The rule

> **One hue, one meaning. Brand gold is never a data color. Everything is muted except the two colors that must grab attention.**

Concretely:

- If a color means *"this happened, here's the number"* (an expense total, an income figure, a category identity) — use a **muted** token. Nothing here should compete for attention.
- If a color means *"you should look at this now"* (over budget, a destructive action, a form error) — it's allowed to be the loudest thing on the screen. There are exactly two such colors: **gold** (brand/caution) and **alert red**.
- Never reach for a raw Tailwind color (`text-blue-500`, `bg-rose-400`, etc.) in application code. If the palette below doesn't have what you need, that's a sign to extend the system deliberately (add a token to `globals.css`), not to type a one-off class.

## The tokens

All defined in `src/app/globals.css` as OKLCH custom properties (light value in `:root`, dark value in `.dark`), exposed to Tailwind via the `@theme inline` block — so `text-positive`, `bg-needs-tint`, etc. are real utility classes, and every one of them already adapts to light/dark automatically.

| Token | Job | Used for |
|---|---|---|
| `primary` / `ring` | Brand gold. The **only** color allowed to mean "clickable" or "brand." | Buttons, active nav/tab state, focus rings, the period-selector active pill, the app icon. Also doubles as "caution" (see below) — that pairing is intentional, not a collision. |
| `destructive` | Alert red — the app's single "stop and look" red. | Delete buttons, destructive confirm dialogs, form validation errors, over-limit budget bars and captions, "plan not viable," the Budget Split "off track" status and over-target badge. |
| `danger` / `danger-tint` | Terracotta — routine, descriptive "this is an expense" labeling. Deliberately **not** alarming, because it appears on every transaction row. | Transaction/recent-activity expense icons, the "Budgeted expenses" and "Expenses" stat figures, net-worth deltas, import-preview amounts. See the distinction below. |
| `positive` / `positive-bar` / `positive-tint` / `positive-border` | Sage — the app's one "good" color. Merges what used to be emerald *and* green. | Income amounts, on-track budget bars, positive net figures, the Budget Split **Savings** bucket (identity + card tint/border), the annual chart's income line. |
| `needs` / `needs-bar` / `needs-tint` / `needs-border` | Dusty blue — Budget Split **Needs** bucket identity. The app's only blue. | The Needs bucket bar/card/tag, and reused as the annual chart's single-category trend line rather than inventing a third blue. |
| `wants` / `wants-bar` / `wants-tint` / `wants-border` | Dusty mauve — Budget Split **Wants** bucket identity. | The Wants bucket bar/card/tag. Deliberately *not* amber — Wants used to share the exact brand gold value, which meant "this is a button" and "this is the Wants bucket" were visually the same thing. |
| Neutral ramp (`background`, `card`, `popover`, `muted`, `secondary`, `accent`, `border`, `input`) | Backgrounds, surfaces, dividers, secondary text. | Everywhere. Warmed from a cool blue-violet cast (OKLCH hue 286 — accidental, not chosen) to a hue near the brand's (80), at very low chroma. Lighter and airier in light mode, closer to a Revolut-style neutral than Tailwind Zinc's default. |

`amber`/`orange` (caution: "uncategorized," "approaching budget limit," "needs review," bucket-target warnings) intentionally stay as **plain Tailwind `amber-*` classes**, not a token — they're Tailwind's own well-designed, already dual-mode-safe shade ramp, and caution sharing gold's hue with brand is a deliberate pairing (see "Two reds" below), not a leftover duplicate.

## Two reds, on purpose

`destructive` and `danger` look similar but answer different questions:

- **`destructive`** answers *"is this bad?"* — yes, and you should act. Reserved for things that are actually wrong: over budget, a form that won't validate, an action that deletes data.
- **`danger`** answers *"is this an expense?"* — yes, no judgment attached. It's on every transaction row in the app, so it has to be calm, not alarming.

Before this system, a single Tailwind `red-600` did both jobs, which meant a completely routine "you spent €18.50 on coffee" read with the same visual urgency as "you are 24% over budget this month." Splitting them was the first change in this series (see the two-tier reasoning in the git history: `style(theme): soften routine expense red to muted terracotta`).

## Two blues that used to be three

The Needs bucket, the annual chart's category-detail line, and (before this pass) a separate chart "net line" were each their own independent blue. There is now exactly one blue in the app (`needs`), reused for both. If a future chart needs a second color to distinguish two blue-ish series, reach for `wants` or a genuinely new token — don't reintroduce a second blue.

## Charts are a special case

`annual-bar-chart.tsx` and `net-worth-chart.tsx` use Recharts, which renders SVG `fill`/`stroke` as presentation attributes — these do **not** resolve CSS custom properties, only literal values. So the chart components hand-roll HSL strings that approximate the token hues (see the comment above `incomeColor`/`expenseColor`/`lineColor` in `annual-bar-chart.tsx`). If you retune a token in `globals.css`, check whether the matching hardcoded HSL value in those two files should move with it — there's no automatic link between them.

## What's deliberately *not* tokenized

- **The category color picker** (`src/lib/category-icons.ts`, `CATEGORY_COLORS`) — 12 Tailwind colors a person chooses from per category, so their categories stay visually distinct from each other. This is supposed to have a lot of colors; it's the opposite problem from the one this document solves.
- **The category-breakdown rotating palettes** (`PALETTE` arrays in `category-breakdown.tsx` / `net-category-breakdown.tsx`) — an 8-color qualitative sequence assigned by list position for chart legends, not a semantic indicator. Same reasoning as the picker above.
- **The net-worth hero card's gradient** (`from-zinc-800 to-amber-950` in `dashboard-content.tsx`) — a deliberate always-dark treatment (it doesn't have `dark:` variants and stays dark even in light mode), not a themed surface. Left alone rather than forced onto the light/dark-reactive neutral tokens, which would break the effect.

## Before / after

Full before-state audit (every color, every file) and the visual comparisons used to choose these values are in two published artifacts from the design pass that produced this document:

- **Ouriva Palette Bench** — danger-red and bucket-color comparisons against real components, light/dark toggle.
- **Ouriva Color Audit** — the full inventory this document is the resolution of, including the merge-mapping table (old class → new token) for every single change.

Ask for the links if you don't have them handy — they aren't checked into the repo.
