# Spendtinel — Feature Roadmap

Prioritized list of planned features. Ordered by impact vs effort within each tier.

---

## Phase 1 — Daily Friction Reducers

Features that reduce manual work and make the app more pleasant to use every day.

### ~~1. Auto-Categorization Rules~~ (Done — v1.12.0)

A rules engine that auto-assigns categories (and optionally display names) during CSV import. Managed in Settings > Auto-Categorization.

- `CategoryRule` model: `pattern`, `matchType` (CONTAINS / STARTS_WITH / EXACT / REGEX), `categoryId`, `friendlyName`, `priority`, `isActive`
- Rules evaluated highest-priority first; first match wins; case-insensitive for all match types; invalid regex fails silently
- `GET /api/category-rules` returns rules sorted by priority desc, createdAt asc
- Pure client-side matching utility (`src/lib/category-rules.ts`) — no extra round-trip during import
- Import Step 3: rules fetched alongside categories; matching rows show an "Auto" badge in the date header; badge disappears if the user manually overrides the category
- Duplicate rows are skipped from matching (they won't be imported anyway)

### ~~1b. Category Icons & Colors~~ (Done — v1.11.0)

Per-category icon and color shown in both transaction lists (Dashboard and Transactions page). Each category can have a Lucide icon and a color set in Settings → Categories.

- `icon` (Lucide icon name) and `color` (palette key) fields on the Category model
- ~60 curated icons in 11 groups; 12 predefined colors
- Settings → Categories redesigned to use an edit sheet pattern (tap the icon circle to open; all settings in one focused bottom sheet)
- `CategoryIcon` component used consistently in `TransactionCard` and `DashboardContent`
- Falls back to type arrows (emerald for income, red for expense) when no icon set

### ~~2. Transaction Review Flag~~ (Done — v1.4.0)

A boolean `needsReview` flag on transactions for marking items that need attention later — pending refunds, split bills waiting for payback, suspicious charges, etc.

- Blue "Review" indicator on transaction cards (next to category)
- "Mark for review" checkbox in the transaction edit form
- "Needs review only" filter toggle in the transaction list
- Supported during bank statement import (per-row checkbox in step 3)

### ~~3. CSV Export~~ (Done — v1.15.0)

"Export CSV" button in the filter bar of the Transactions page. Exports all transactions matching the current active filters (type, account, category, date range, search, needs-review). Split transactions are expanded to one row per split child for flat, pivot-table-friendly output.

- `GET /api/transactions/export` — same filter params as the list endpoint, no pagination, returns `text/csv`
- UTF-8 BOM included so Excel auto-detects encoding
- Filename reflects active date range: `transactions_2026-01-01_2026-03-31.csv`
- Columns: Date, Type, Amount, Currency, Description, Category (Parent > Child notation), Account, Notes
- Export button is an `<a download>` link — triggers browser download without any JS fetch

### 4. Recurring Transactions
**Priority:** High | **Effort:** Medium

Rent, Netflix, phone bill — most expenses repeat monthly. A `recurrence` field on transactions (monthly, weekly, yearly) plus a mechanism to auto-create upcoming instances. Eliminates 80% of manual entry for regular users.

Options:
- Server-side cron job that creates transactions on schedule
- On-load check when the user opens the app (simpler, no cron needed)

---

## Phase 2 — Insights & Polish

Features that make the data more useful and the experience smoother.

### ~~5. Income Category Breakdown~~ (Done — v1.5.0)

Monthly and annual summaries now show income broken down by category, not just as a single total. This enables the "same category" reimbursement workflow — categorize a reimbursement under the same category as the original expense, and the category view shows the net cost.

- "Income Categories" section below expense categories in monthly summary
- "Income by Category" table in annual summary
- Reuses the same hierarchical parent/child category display as expenses

### ~~5b. 50/30/20 Budget Rule~~ (Done — v1.8.0)

Assigns each category to a budget bucket (NEEDS / WANTS / SAVINGS) and shows how spending aligns with the popular 50/30/20 personal finance rule.

- New `CategoryBucket` enum in the database schema (`NEEDS`, `WANTS`, `SAVINGS`)
- `bucket` field on the `Category` model (nullable); effective bucket inherits from parent if unset
- N / W / S compact buttons on every row of the Categories settings page for quick assignment
- `BudgetSplit` component in the monthly and annual summary third tab: three stat cards (actual % vs target %), a stacked bar, and an unclassified warning
- `bucketBreakdown` field in monthly and annual summary API responses

### 6. Home Currency Net Worth
**Priority:** Medium | **Effort:** Low

A single "Net Worth" figure in a configurable home currency on the dashboard. Requires a simple exchange rate table (manually entered, not live API) and a conversion at display time. Gives multi-currency users the one number they actually want.

### ~~7. Month-over-Month Comparison~~ (Done — v1.9.0)

Implemented as inline delta indicators on the monthly summary stat cards. The monthly summary fetches the current and previous month in parallel and shows compact `↑5%` / `↓3%` indicators on the Income and Expenses cards, plus a full absolute delta ("↑ €120.00 vs Jan") on the Net card.

### 8. Bulk Categorize
**Priority:** Medium | **Effort:** Low

Select multiple transactions in the list and assign a category to all at once. Especially useful after importing a batch of uncategorized transactions. Checkbox selection + a "Set Category" action bar.

### 8b. Drag-to-Reorder Accounts
**Priority:** Low | **Effort:** Low

Allow users to control the order of account cards on the dashboard by dragging them in Settings → Accounts. Order is persisted via a `displayOrder` field on the Account model and reflected everywhere accounts are listed.

- `displayOrder Int @default(0)` field on Account; API sorts by `displayOrder ASC, name ASC`
- `POST /api/accounts/reorder` endpoint accepts an ordered array of IDs; assigns `displayOrder = index` in a single transaction
- `@dnd-kit/core` + `@dnd-kit/sortable` for the drag UI; `GripVertical` handle on each account card in Settings → Accounts
- Optimistic update (UI reorders instantly on drop, persists in background)

### 8c. Locale & Formatting Settings
**Priority:** Medium | **Effort:** Low

A locale preference in Settings → General that controls how numbers and dates are displayed throughout the app. Default is `en-US`; adding `pt-PT` covers Portuguese conventions (comma as decimal separator, period as thousands separator, day-first dates).

Numbers:
- `en-US`: 1,234.56 → `pt-PT`: 1.234,56
- All formatted amounts use `toLocaleString(locale, { minimumFractionDigits: 2 })` or the existing `formatCurrency` helper, driven by the saved locale

Dates:
- `en-US`: Mar 5 / March 2026 → `pt-PT`: 5 mar / março 2026
- All `toLocaleDateString` calls receive the saved locale

Implementation:
- Add a `locale` key to the existing app settings (stored in the `Setting` table, same as transfer category); default `"en-US"`
- Expose it via `GET /api/settings` (already returns all settings)
- Read the locale on the client via a small `useLocale()` hook or React context so all components share the same value without prop-drilling
- Update `formatCurrency` in `src/lib/formatters.ts` to accept / use the locale
- Update all `toLocaleDateString` / `toLocaleString` call sites

### 9. Pinned / Favorite Categories
**Priority:** Low | **Effort:** Low

Show the 3-4 most-used categories at the top of category dropdowns. Can be computed from usage frequency or manually pinned. Saves scrolling on mobile where the dropdown can be long.

### 10. Transaction Templates
**Priority:** Low | **Effort:** Low

Save frequent transactions as templates: "Coffee, 4.50, Food > Coffee." One tap to create from a template. Like recurring but on-demand, for variable-frequency expenses.

---

## Phase 3 — Differentiator

### 11. MCP Server (AI Agent Integration)
**Priority:** Medium | **Effort:** Medium

Expose the REST API as an MCP (Model Context Protocol) server so AI agents (Claude Desktop, Cursor, etc.) can interact with the app programmatically.

Use cases:
- "Categorize all my uncategorized transactions based on description"
- "What did I spend on eating out in the last 3 months?"
- "Am I on track with my budget this month?"
- "Create an expense for the 45 EUR dinner yesterday"

This would make Spendtinel the first personal finance app with AI agent support. Strong differentiator for the developer/early-adopter audience. Build on the existing REST API — the MCP server is essentially a wrapper that translates natural language tool calls into API requests.

When WebMCP (browser-based MCP) matures, this can be extended to allow agents to interact through the web UI directly.
