# Changelog

All notable changes to Ouriva are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
