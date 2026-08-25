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
| `cat-zinc` … `cat-red` (12) | Muted counterpart of the category color picker — see below. Not part of the "7 semantic colors," a separate parallel set. | `CATEGORY_COLORS` in `category-icons.ts`; the category icon circle wherever it renders. |
| `hero` / `hero-foreground` / `hero-muted` / `hero-chip` / `hero-chip-foreground` / `hero-positive` / `hero-danger` | The dashboard net-worth card's own fixed palette — see below. Not light/dark-reactive. | `NetWorthHero` in `dashboard-content.tsx` only. |

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

## The category color picker — a second, parallel palette

`src/lib/category-icons.ts` (`CATEGORY_COLORS`) is 12 colors a person chooses from per category, so their categories stay visually distinct from each other — this is *supposed* to have a lot of colors, the opposite problem from the semantic sprawl the rest of this document solves. It's still been given the same muted, nature-toned treatment as everything else (12 new `--cat-*` tokens in `globals.css`), for visual consistency with the rest of the app — but it's a **deliberately separate set of tokens**, not aliases to `needs`/`wants`/`positive`/etc., even where a hue is close (`--cat-blue` vs `--needs`, `--cat-amber` vs `--primary`). Semantic meaning and arbitrary per-category identity are different concerns and need to be free to diverge later without one dragging the other along.

The `CATEGORY_COLORS` keys (`"zinc"`, `"blue"`, …) are unchanged from the original Tailwind-backed version — only what each key renders as. Existing categories' stored `color` values still resolve correctly; nothing needed migrating.

The **category-breakdown rotating palettes** (`PALETTE` arrays in `category-breakdown.tsx` / `net-category-breakdown.tsx`) — an 8-color qualitative sequence assigned by list position for chart legends, not tied to a category's chosen color — were muted to match in the same pass, as literal hex (Recharts-style components, same SVG constraint as the charts above; not worth a dedicated token for an 8-color rotation used in two places).

## The net-worth hero — a fixed sub-palette, not themed

The dashboard's net-worth card is the one piece of UI meant to carry more visual weight than everything around it, so unlike the rest of the app it stays a solid dark surface in both light and dark mode — same reasoning as before (it never had `dark:` variants), but the surface itself changed: the old two-stop diagonal gradient (`from-zinc-800 to-amber-950`, a stock "dark hero card" look with no relationship to the rest of the palette) is now a solid warm charcoal (`--hero`, same hue family as the neutral ramp) with one restrained radial gold glow anchored at the top-right corner and a hairline top edge, both applied via inline `style` (`var(--hero-glow)`, `var(--hero-hairline)`) since they're gradients, not solid-color utilities.

Because this card is *always* dark regardless of the app's theme, it can't use the theme-reactive `--positive`/`--danger` tokens for its new delta line — those resolve to their light-mode (darker, low-contrast) values whenever the app itself is in light mode, even though the card underneath them stays dark. `--hero-positive` and `--hero-danger` are pinned to the dark-mode positive/danger values instead, so the delta line stays legible no matter what theme the rest of the app is in.

**The delta line is new**, not just a restyle: `useDashboardData` now also fetches `/api/analytics/net-worth?period=1m` (the same endpoint the Net Worth analytics chart already uses) and computes a trailing-30-day delta, shown as "▲ €320.00 (2.2%) this month" beneath the total. It's suppressed entirely when there's fewer than two data points (a new account with no transaction history yet) rather than showing a meaningless "+€0.00 (0.0%)."

## Before / after

Full before-state audit (every color, every file) and the visual comparisons used to choose these values are in two published artifacts from the design pass that produced this document:

- **Ouriva Palette Bench** — danger-red and bucket-color comparisons against real components, light/dark toggle.
- **Ouriva Color Audit** — the full inventory this document is the resolution of, including the merge-mapping table (old class → new token) for every single change.
- **Net Worth Hero Redesign** — three real-data mockups for the dashboard card above; "Quiet premium" is the one that shipped.

Ask for the links if you don't have them handy — they aren't checked into the repo.
