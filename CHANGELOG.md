# Changelog

All notable changes to Ouriva are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.21.1] — 2026-04-23

### Fixed
- `React.FormEvent` deprecated in React 19 — replaced with `React.SyntheticEvent<HTMLFormElement>` in settings form handlers
- File dropzone replaced `div[role=button]` with a native `<button>` element for accessibility correctness
- Resolved all SonarCloud Low-severity issues (negated conditions, replaceAll, Readonly props, unnecessary type assertions, nullish coalescing, globalThis, duplicate imports)
- Replaced deprecated Zod v4 APIs (`z.string().uuid()` → `z.uuid()`, `error.flatten()` → `z.flattenError()`, `error.format()` → `z.treeifyError()`)
- Eliminated code duplication in summary API routes and category select dropdowns — SonarCloud duplication at 0%

### Security
- Bumped `@xmldom/xmldom` to 0.8.13 (via `read-excel-file`) to resolve 4 high-severity CVEs: GHSA-2v35-w6hq-6mfw, GHSA-f6ww-3ggp-fr8h, GHSA-x6wf-f3px-wcqx, GHSA-j759-j44w-7fr8

---

## [1.21.0] — 2026-04-17

### Changed
- Docker base image upgraded from Node 20 to **Node 22 LTS** (Alpine), supported until April 2027
- Production container no longer ships npm or npx — reduced runtime attack surface
- Updated Next.js from 16.2.3 to 16.2.4
- Updated lucide-react to 1.x
- Updated shadcn to 4.3.0

### Security
- Added CodeQL static analysis to CI (runs on every push and pull request to `main`)
- Added SonarCloud code quality and security scanning to CI
- Added Snyk container vulnerability scanning to CI with results published to the GitHub Security tab
- Resolved transitive CVEs in `brace-expansion` and `@hono/node-server` via package overrides
- Docker base image pinned by digest to guard against supply chain attacks on mutable tags

---

## [1.20.1] — 2026-04-01

### Fixed
- TypeScript errors surfaced by the production build type-check
- CI lint errors that prevented clean builds

---

## [1.19.0] — 2026-03-28

### Added
- i18n: English and Portuguese (European) support via next-intl
- Locale-aware number and date formatting throughout the app
- Language selector in Settings → General

## [1.18.0] — 2026-03-01

### Added
- Annual summary: expand category rows to reveal subcategory monthly breakdown
- Subcategory rows are selectable for the chart view

## [1.17.0] — 2026-02-15

### Added
- Duplicate transaction: copy icon on transaction detail pre-fills the new transaction form

## [1.16.0] — 2026-02-01

### Fixed
- Budget: income transactions in expense categories are netted off as reimbursements, preventing over-budget false positives

## [1.15.0] — 2026-01-20

### Added
- CSV export: export all transactions matching active filters from the Transactions page
- UTF-8 BOM for Excel compatibility; split transactions expanded to one row per child

## [1.14.0] — 2026-01-10

### Added
- Month-over-month delta indicators on monthly summary stat cards

## [1.13.0] — 2025-12-20

### Added
- Auto-categorization rules engine for CSV import (CONTAINS / STARTS_WITH / EXACT / REGEX)
- "Auto" badge on matched rows during import; disappears on manual override

## [1.12.0] — 2025-12-01

### Added
- Category icons and colors (Lucide icons, 12 predefined color palette)
- Edit sheet pattern for category settings

## [1.11.0] — 2025-11-15

### Added
- 50/30/20 budget rule: Needs / Wants / Savings bucket assignment per category
- BudgetSplit component in monthly and annual summary

## [1.10.0] — 2025-11-01

### Added
- Income category breakdown in monthly and annual summaries

## [1.9.0] — 2025-10-15

### Added
- Transaction review flag (`needsReview`) with filter toggle and import support

## [Older versions]

Earlier versions were pre-release internal builds and are not documented here.
