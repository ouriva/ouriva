# Ouriva

> Privacy-first personal finance tracking. Your data stays on your server.

Ouriva is a mobile-first PWA for tracking multi-currency bank accounts, categorizing transactions, setting annual budgets, and reviewing monthly/annual summaries. Built for self-hosters who want full control over their financial data.

## Features

- **Multi-currency accounts** — Checking, savings, credit cards, and cash in any currency
- **Bank statement import** — CSV and Excel import with column mapping, saved profiles, and automatic duplicate detection
- **Auto-categorization rules** — Pattern matching rules that assign categories automatically during import
- **Hierarchical categories** — Parent/child categories (e.g., Food → Groceries) with icons and colors
- **Split transactions** — One bank charge, multiple categories (e.g., a supermarket trip split across Food, Household, Health)
- **Annual budgets** — Set yearly targets per category; income in expense categories is netted off as reimbursements
- **Monthly & annual summaries** — Charts and breakdowns of income vs. expenses with category drill-down
- **50/30/20 budget rule** — Assign categories to Needs / Wants / Savings buckets and see how your spending aligns
- **Review flag** — Mark transactions that need attention (pending refunds, split bills, suspicious charges)
- **CSV export** — Export filtered transactions; split transactions are expanded to one row per child
- **PWA** — Install on iPhone or Android home screen, works offline
- **Dark mode** — Respects system preference, toggleable in-app
- **i18n** — English and Portuguese (European) included

## Quick Start (Docker)

### Prerequisites

- Docker and Docker Compose
- A PostgreSQL database (can run in Docker too)

### 1. Clone the repository

```bash
git clone https://github.com/your-org/ouriva.git
cd ouriva
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set your `DATABASE_URL`:

```
DATABASE_URL="postgresql://db_user:db_password@db_host:5432/ouriva"
```

### 3. Run database migrations

```bash
docker compose run --rm app npx prisma migrate deploy
```

### 4. Start the app

```bash
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development Setup

### Prerequisites

- Node.js 20+
- Docker (for the local dev database)

### 1. Install dependencies

```bash
npm install
```

### 2. Start the dev database

```bash
docker compose -f docker-compose.dev.yml up -d
```

### 3. Configure environment

```env
DATABASE_URL="postgresql://budget_app_dev:dev_password_change_me@localhost:5432/personal_finance_dev"
```

### 4. Run migrations and seed

```bash
npx prisma migrate dev
npx prisma db seed
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS 4 + shadcn/ui (New York, Zinc) |
| ORM | Prisma 7 with PostgreSQL |
| Charts | Recharts |
| Forms | Zod + react-hook-form |
| PWA | Serwist |
| Icons | Lucide React |

## Project Structure

```
src/
├── app/
│   ├── (app)/              # Routes with bottom nav layout
│   │   ├── dashboard/      # Account balances + monthly overview
│   │   ├── transactions/   # List, add, edit, import, export
│   │   ├── summary/        # Monthly + annual summaries
│   │   ├── budget/         # Annual budget management
│   │   └── settings/       # Accounts, categories, currencies
│   └── api/                # REST API route handlers
├── components/             # UI components (shadcn + custom)
├── validators/             # Zod schemas
├── hooks/                  # Data-fetching hooks
├── lib/                    # Prisma client, formatters, utils
└── types/                  # Shared TypeScript types
prisma/
├── schema.prisma           # Database schema
└── seed.ts                 # Seed data
messages/
├── en.json                 # English strings
└── pt.json                 # Portuguese strings
```

## Documentation

- [Application Manual](docs/application-manual.md) — full technical reference (schema, API, components)
- [Roadmap](docs/roadmap.md) — planned features with effort/priority ratings

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

Ouriva is licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only).

You are free to self-host, modify, and distribute Ouriva under the terms of the AGPL-3.0. If you offer Ouriva as a hosted service, you must release any modifications under the same license.

For commercial licensing (e.g., proprietary modifications or SaaS without AGPL obligations), contact [hello@ouriva.app](mailto:hello@ouriva.app).
