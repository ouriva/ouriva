# Budget Tracker

A mobile-first personal finance PWA for tracking multi-currency bank accounts, categorizing transactions, setting annual budgets, and viewing monthly/annual summaries.

## Tech Stack

- **Next.js 16** (App Router) — full-stack TypeScript
- **Tailwind CSS + shadcn/ui** — mobile-first UI
- **Prisma 7** — PostgreSQL ORM with driver adapters
- **Recharts** — responsive SVG charts
- **Zod + react-hook-form** — validation and forms
- **Serwist** — PWA / service worker
- **Docker** — containerized deployment

## Development Setup

### Prerequisites

- Node.js 20+
- Docker Desktop (for the dev database)

### 1. Install dependencies

```bash
npm install
```

### 2. Start the dev database

```bash
docker compose -f docker-compose.dev.yml up -d
```

This starts a local PostgreSQL 17 container (`personal_finance_dev` / `budget_app_dev`).

### 3. Set up environment

The `.env` file should already point to the local dev database:

```
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

Open [http://localhost:3000](http://localhost:3000) on your browser or phone.

## Production Deployment

The app is deployed to a Raspberry Pi via Docker, with PostgreSQL on a separate server.

### First-time setup

1. Set up the production database — see `docs/database-production.sql`
2. Copy `docker-compose.yml` to the Pi
3. Create `.env` on the Pi with your `DATABASE_URL`
4. Configure deploy credentials — see `.env.production.example`

### Deploy

```bash
git tag v1.x.x
./scripts/deploy.sh
```

The deploy script builds the Docker image on your Mac, runs migrations via SSH tunnel, transfers the image to the Pi, and restarts the container. See `scripts/deploy.sh` for details.

## Project Structure

```
src/
├── app/
│   ├── (app)/              # Routes with bottom nav layout
│   │   ├── dashboard/      # Account balances + overview
│   │   ├── transactions/   # List, add, edit
│   │   ├── summary/        # Monthly + annual views
│   │   ├── budget/         # Annual budget management
│   │   └── settings/       # Accounts, categories, currencies
│   └── api/                # REST API routes
├── components/             # UI components (shadcn + custom)
├── validators/             # Zod schemas
├── hooks/                  # Data fetching hooks
├── lib/                    # Prisma client, formatters, utils
└── types/                  # Shared TypeScript types
prisma/
├── schema.prisma           # Database schema
└── seed.ts                 # Seed data
docs/                       # Database setup scripts
scripts/
└── deploy.sh               # Build + deploy to Raspberry Pi
```
