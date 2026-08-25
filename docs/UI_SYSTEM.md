# Ouriva — Icons & Button Hierarchy

A reference for the app's icon sizing scale, accessibility conventions, and button-variant hierarchy. Companion to `docs/COLOR_SYSTEM.md` — that one governs *color*, this one governs *shape and weight*: what size an icon should be, when a button gets to be the amber one.

## Why this exists

An icon audit found 8 different icon pixel sizes in ad hoc use with no formal scale, 13 icon-only buttons sized at 36px despite the app's own stated 44px minimum touch target, and 5 of those 13 with no accessible label at all (plus 3 relying on `title` alone and 2 hardcoded in English, bypassing i18n). Separately, a pass over every page's primary "Add"/create action found six places where it was styled `variant="outline"` — visually no different from the secondary actions next to it, with nothing on the screen reading as *the* primary thing to do. Both were drift, not a decision, fixed the same way as the color system: audit everything, apply one small rule everywhere, document the rule so it doesn't drift back.

## Icons

**Library**: 100% [Lucide](https://lucide.dev) (`lucide-react`). No custom SVGs, no emoji, no second icon set — keep it that way. Flat outline style, 2px stroke, no filled icons except the one deliberate exception below.

**The scale** — five sizes, each with one job. Don't size an icon ad hoc; pick the tier that matches its role:

| Size | Tier | Used for |
|---|---|---|
| 16px (`h-4 w-4`) | Dense / inline | Status icons inline with text: `TriangleAlert`, `CircleDot`, `Split`, `MessageSquare` |
| 20px (`h-5 w-5`) | Toolbar / utility button | Every icon-only button's glyph — edit, delete, duplicate, toggle, date-nav, remove-split. One size for all of them. Also the bottom-nav tab icons. |
| 24px (`h-6 w-6`) | Primary action | Reserved for the one icon meant to outrank the utility buttons around it (currently unused now that the transactions FAB is gone — the next candidate for this tier should earn it, not default to it) |
| 32px (`h-8 w-8`) | Empty state | `Landmark` ("no accounts yet") |
| 64px (`h-16 w-16`) | Hero / illustrative | Import success/error result screens |

The one filled icon in the app is the `Star` "default" badge (`fill-current`) in `simple-settings-list.tsx` — everything else is outline. Keep it that way; a second filled icon would need a reason, not just a preference.

**Touch targets**: `Button`'s `icon` size variant is `size-11` (44px) in `src/components/ui/button.tsx` — the app's own CLAUDE.md convention ("44px minimum touch targets for interactive elements"), not shadcn's default `size-9` (36px). Don't override it down with a `className` on individual buttons; if a context genuinely can't fit 44px, treat it as a documented exception (see below), not a silent default-shrink.

**One documented exception**: the account reorder up/down stepper in `account-list.tsx` stays a compact 32×24px control rather than each half growing to 44px, which would roughly double that row's height for a secondary action. It still carries a real accessible label — only the touch-target size is exempted, and the code comment at that call site explains why. Revisit if that control gets redesigned; don't treat it as precedent for shrinking other buttons.

**Accessibility labels**: every icon-only button needs a real name a screen reader can announce — an `sr-only` span or `aria-label`, always routed through `next-intl` (`t()`/`tCommon()`), never a hardcoded English string. `title` alone doesn't count as a fix by itself; it's a fine *addition* for a hover tooltip, but pair it with a real label, not instead of one. This isn't a style preference — 2026 fintech UX guidance specifically calls out WCAG-adjacent labeling as increasingly enforced by financial regulators, not just a general nicety.

## Button hierarchy

> **One clearly primary action per screen. Primary is the amber `default` variant. Everything else is `outline` or `ghost`.**

`Button`'s `default` variant (`bg-primary text-primary-foreground`) is reserved for the single most important action on a given screen or decision point — never for a supporting action, and never doubled up (two `default`-variant buttons competing on the same screen means one of them is wrong). `outline` and `ghost` are for everything else: secondary actions, cancel buttons, utility icons.

Every top-level "Add new X" action in the app follows this now:

| Page | Primary action | Secondary action(s) |
|---|---|---|
| Dashboard | Add transaction | Analytics (ghost icon) |
| Transactions | Add | Import |
| Settings → Accounts | Add | Edit / delete / reorder (per row) |
| Settings → Categories | Add (subcategory sheet) | — |
| Settings → Currencies, Account Types | Add | Set default / edit / delete (per row) |
| Settings → Auto-categorization | Add rule | Edit / delete (per row) |

The Transactions page previously used a floating "+" action button (FAB), fixed to the bottom-right corner, disconnected from the header row and from every other page's pattern. It's gone — "Add" now lives in the header next to Import, same position as the Dashboard's Analytics-then-Add pairing. If a future page is tempted to reach for a FAB again, don't — put the primary action in the header instead, consistent with everywhere else.

Before extending this: check whether the screen already has a real primary action (a form's Save/Create submit button, a sticky "unsaved changes" Save banner) before adding a second `default`-variant button — those already exist correctly in `transaction-form.tsx` and `budget-content.tsx` and shouldn't gain a competing primary button beside them.

## Before / after

The full icon inventory (every icon, every file, before this pass) and the sizing/accessibility proposal are in a published artifact from the audit:

- **Ouriva Icon Audit** — every clickable icon grouped by navigation, icon-only buttons, status indicators, and the category picker, with the 5-step scale and accessibility gaps proposal.

Ask for the link if you don't have it handy — it isn't checked into the repo.
