# Spendtinel — Feature Roadmap

Prioritized list of planned features. Ordered by impact vs effort within each tier.

---

## Phase 1 — Daily Friction Reducers

Features that reduce manual work and make the app more pleasant to use every day.

### 1. Auto-Categorization Rules
**Priority:** High | **Effort:** Low

"When description contains LIDL, set category to Groceries."

A rules engine that auto-assigns categories during import and manual entry. A simple table in the database (`pattern`, `categoryId`, `matchType`) with a settings page to manage rules. Runs during CSV import (step-review) and optionally suggests categories when creating transactions manually.

### ~~2. Transaction Review Flag~~ (Done — v1.4.0)

A boolean `needsReview` flag on transactions for marking items that need attention later — pending refunds, split bills waiting for payback, suspicious charges, etc.

- Blue "Review" indicator on transaction cards (next to category)
- "Mark for review" checkbox in the transaction edit form
- "Needs review only" filter toggle in the transaction list
- Supported during bank statement import (per-row checkbox in step 3)

### 3. CSV Export
**Priority:** High | **Effort:** Low

"Download CSV" button on the transactions page. Exports transactions matching the current filters (date range, account, category, type). One API endpoint, one button. Builds user trust — data isn't trapped.

### 4. Recurring Transactions
**Priority:** High | **Effort:** Medium

Rent, Netflix, phone bill — most expenses repeat monthly. A `recurrence` field on transactions (monthly, weekly, yearly) plus a mechanism to auto-create upcoming instances. Eliminates 80% of manual entry for regular users.

Options:
- Server-side cron job that creates transactions on schedule
- On-load check when the user opens the app (simpler, no cron needed)

---

## Phase 2 — Insights & Polish

Features that make the data more useful and the experience smoother.

### 5. Home Currency Net Worth
**Priority:** Medium | **Effort:** Low

A single "Net Worth" figure in a configurable home currency on the dashboard. Requires a simple exchange rate table (manually entered, not live API) and a conversion at display time. Gives multi-currency users the one number they actually want.

### 6. Month-over-Month Comparison
**Priority:** Medium | **Effort:** Low

Show deltas next to each category in the monthly summary: "Food: +23% vs last month." No new page — just a number and an arrow/color on the existing summary. Simple query comparing current month totals to previous month.

### 7. Bulk Categorize
**Priority:** Medium | **Effort:** Low

Select multiple transactions in the list and assign a category to all at once. Especially useful after importing a batch of uncategorized transactions. Checkbox selection + a "Set Category" action bar.

### 8. Pinned / Favorite Categories
**Priority:** Low | **Effort:** Low

Show the 3-4 most-used categories at the top of category dropdowns. Can be computed from usage frequency or manually pinned. Saves scrolling on mobile where the dropdown can be long.

### 9. Transaction Templates
**Priority:** Low | **Effort:** Low

Save frequent transactions as templates: "Coffee, 4.50, Food > Coffee." One tap to create from a template. Like recurring but on-demand, for variable-frequency expenses.

---

## Phase 3 — Differentiator

### 10. MCP Server (AI Agent Integration)
**Priority:** Medium | **Effort:** Medium

Expose the REST API as an MCP (Model Context Protocol) server so AI agents (Claude Desktop, Cursor, etc.) can interact with the app programmatically.

Use cases:
- "Categorize all my uncategorized transactions based on description"
- "What did I spend on eating out in the last 3 months?"
- "Am I on track with my budget this month?"
- "Create an expense for the 45 EUR dinner yesterday"

This would make Spendtinel the first personal finance app with AI agent support. Strong differentiator for the developer/early-adopter audience. Build on the existing REST API — the MCP server is essentially a wrapper that translates natural language tool calls into API requests.

When WebMCP (browser-based MCP) matures, this can be extended to allow agents to interact through the web UI directly.
