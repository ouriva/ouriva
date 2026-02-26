# Spendtinel — Application Manual

A comprehensive guide to every part of this application: what each technology does, why it was chosen, how the pieces fit together, and what every file in the codebase does.

---

## Table of Contents

1. [The Big Picture](#1-the-big-picture)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Configuration Files](#4-configuration-files)
5. [The Database Layer](#5-the-database-layer)
6. [The API Layer](#6-the-api-layer)
7. [Validation with Zod](#7-validation-with-zod)
8. [The Frontend](#8-the-frontend)
9. [Components In Depth](#9-components-in-depth)
10. [Hooks and Data Fetching](#10-hooks-and-data-fetching)
11. [Styling with Tailwind CSS](#11-styling-with-tailwind-css)
12. [Charts with Recharts](#12-charts-with-recharts)
13. [PWA: Progressive Web App](#13-pwa-progressive-web-app)
14. [Dark Mode](#14-dark-mode)
15. [Docker and Deployment](#15-docker-and-deployment)
16. [Key Design Decisions](#16-key-design-decisions)
17. [Common Patterns in This Codebase](#17-common-patterns-in-this-codebase)
18. [Glossary](#18-glossary)

---

## 1. The Big Picture

This is a **personal finance application** that replaces an Excel spreadsheet. It lets you:

- Track multiple bank accounts across different currencies (EUR, USD, BRL, etc.)
- Record income and expenses, with a configurable transfer category for inter-account movements
- Import bank statements from CSV and Excel files with column mapping and duplicate detection
- Add friendly display names and notes to transactions
- Flag transactions for review (pending refunds, split bills, suspicious charges)
- Search and filter transactions by text, type, account, category, date range, or review status
- Organize transactions with hierarchical categories (e.g., Food > Groceries)
- Set annual budgets per category and track spending against them
- View monthly and annual summaries with charts
- Access everything from your phone as a PWA (Progressive Web App)

### Architecture Overview

The application follows a **client-server architecture** running in a single Next.js process:

```
┌─────────────────────────────────────────────────┐
│                   Your Phone                     │
│                  (PWA in Safari)                  │
│                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │  React      │  │  Recharts   │  │  Service  │ │
│  │  Components │  │  Charts     │  │  Worker   │ │
│  └──────┬──────┘  └─────────────┘  └──────────┘ │
│         │ fetch()                                  │
└─────────┼─────────────────────────────────────────┘
          │ HTTP (JSON)
┌─────────┼─────────────────────────────────────────┐
│         ▼         Raspberry Pi (Docker)            │
│  ┌─────────────┐                                   │
│  │  Next.js    │                                   │
│  │  API Routes │                                   │
│  └──────┬──────┘                                   │
│         │ Prisma ORM                               │
└─────────┼─────────────────────────────────────────┘
          │ TCP (PostgreSQL protocol)
┌─────────┼─────────────────────────────────────────┐
│         ▼         NUC Server (Docker)              │
│  ┌─────────────┐                                   │
│  │  PostgreSQL │                                   │
│  │  Database   │                                   │
│  └─────────────┘                                   │
└───────────────────────────────────────────────────┘
```

**The request lifecycle**: You tap a button on your phone → the browser sends a `fetch()` request to the Next.js server on the Raspberry Pi → Next.js runs the API route handler → Prisma translates it to SQL → PostgreSQL on the NUC executes the query → the result travels back through the same chain → React renders the updated UI.

### Why This Stack?

The stack was chosen for these priorities:

1. **Mobile-first** — Tailwind CSS makes responsive design natural; PWA removes app store friction
2. **Type safety end-to-end** — TypeScript catches errors at compile time; Zod catches them at runtime; Prisma generates types from the database schema
3. **Single language** — JavaScript/TypeScript for frontend, backend, and database queries. One language to learn.
4. **Low resource usage** — Next.js standalone output runs on a Raspberry Pi with ~150MB of Docker image
5. **Modern patterns** — App Router, Server Components, and React 19 features

---

## 2. Technology Stack

### Core Framework: Next.js 16

**What it is**: A React framework that adds server-side rendering, routing, and API endpoints on top of React.

**What problem it solves**: With plain React, you get a blank HTML page and everything loads client-side. This is slow and bad for SEO. Next.js renders pages on the server, so the browser gets ready-to-display HTML immediately.

**Key features we use**:

- **App Router** — File-system based routing. Create a file at `src/app/dashboard/page.tsx` and you get a `/dashboard` route automatically.
- **Server Components** — Components that render on the server and send HTML to the browser. No JavaScript shipped for them. This is the default in App Router.
- **Client Components** — Components marked with `"use client"` that run in the browser. Needed for interactivity (clicks, state, effects).
- **API Route Handlers** — Files named `route.ts` that handle HTTP requests (GET, POST, PUT, DELETE). They run exclusively on the server.
- **Metadata API** — Export a `metadata` object from page files to set `<title>`, `<meta>` tags, etc.
- **Standalone output** — Traces only the files the server needs, producing a ~20MB self-contained server instead of shipping the full `node_modules` (~300MB+).

### Language: TypeScript

**What it is**: JavaScript with static type checking. Every variable, function parameter, and return value can have a declared type.

**What problem it solves**: JavaScript lets you pass a string where a number is expected, call methods on `undefined`, or misspell a property name — and you won't find out until the code runs (and crashes). TypeScript catches these errors in your editor, before the code ever executes.

**Key concepts used here**:

```typescript
// Type annotation — tells TypeScript what shape `account` must have
interface Account {
  id: string;
  name: string;
  initialBalance: number;
  isActive: boolean;
}

// Generic type — PaginatedResponse works with any data type
interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; total: number };
}

// Usage: PaginatedResponse<Account> means data is Account[]
```

### UI Library: React 19

**What it is**: A library for building user interfaces from composable components.

**Key concepts**:

- **Components** — Functions that return JSX (HTML-like syntax). Each component manages its own piece of UI.
- **Props** — Data passed from parent to child components. Like function parameters.
- **State** (`useState`) — Data that changes over time. When state updates, React re-renders the component.
- **Effects** (`useEffect`) — Side effects that run after render (API calls, subscriptions).
- **Hooks** — Functions starting with `use` that let you "hook into" React features. Custom hooks extract reusable logic.

### Styling: Tailwind CSS 4

**What it is**: A utility-first CSS framework. Instead of writing CSS classes like `.header { font-size: 24px; font-weight: bold; }`, you compose utility classes directly in HTML: `className="text-2xl font-bold"`.

**What problem it solves**: Traditional CSS suffers from naming conflicts, dead code, and growing file size. Tailwind eliminates naming decisions, only includes the utilities you actually use, and keeps styles co-located with the component.

**Key Tailwind patterns in this codebase**:

```tsx
// Responsive design: mobile-first, then larger screens
<div className="px-4 md:px-8 lg:px-12">
  {/* px-4 on mobile, px-8 on medium screens, px-12 on large */}
</div>

// Dark mode: light style by default, dark: prefix overrides
<div className="bg-white dark:bg-zinc-900">

// Conditional classes using cn() utility
<div className={cn("rounded-lg", isActive && "bg-green-500")}>
```

### Component Library: shadcn/ui

**What it is**: A collection of pre-built, accessible React components (buttons, cards, dialogs, inputs, etc.) that you copy into your project and own.

**How it differs from other libraries**: Most component libraries (Material UI, Chakra) ship as npm packages you import. You can't modify their internals. shadcn/ui copies the source code into `src/components/ui/` — you own it and can modify anything.

**Components used**: `Button`, `Card`, `Checkbox`, `Dialog`, `Input`, `Label`, `Select`, `Separator`, `Sheet`, `Tabs`, `Badge`, `Textarea`

**Configuration**: `components.json` tells the shadcn CLI where to place files, which style to use (New York), and the base color (Zinc).

### ORM: Prisma 7

**What it is**: An Object-Relational Mapper. It lets you interact with the database using TypeScript instead of raw SQL.

**What problem it solves**: Writing SQL strings by hand is error-prone (typos, SQL injection), and the results are untyped JavaScript objects. Prisma generates TypeScript types from your schema, so `prisma.account.findMany()` returns `Account[]` with full autocomplete.

**Key Prisma concepts**:

- **Schema** (`prisma/schema.prisma`) — Defines your database models, fields, relations, and indexes
- **Migrations** — SQL scripts generated from schema changes. Applied with `prisma migrate dev` (development) or `prisma migrate deploy` (production)
- **Client** — Auto-generated TypeScript code that provides type-safe database queries
- **Driver Adapters** (Prisma 7) — Instead of a built-in database engine, Prisma 7 uses standard database drivers like `pg` (Node.js PostgreSQL driver)

### Validation: Zod 4

**What it is**: A TypeScript-first schema validation library. You define a schema once and use it for both runtime validation and TypeScript type inference.

**What problem it solves**: TypeScript types only exist at compile time — they're erased when your code runs. When data arrives from an API request or form submission, you need runtime checking. Zod provides both.

```typescript
// Define a schema
const schema = z.object({
  name: z.string().min(1),
  amount: z.number().positive(),
});

// Use it for runtime validation
const result = schema.safeParse(requestBody);
if (!result.success) {
  return { error: result.error };
}
// result.data is now typed and validated

// Use it for TypeScript types
type Input = z.infer<typeof schema>;
// Input = { name: string; amount: number }
```

### Forms: react-hook-form

**What it is**: A form library that manages form state, validation, and submission.

**What problem it solves**: Managing form state manually (tracking every input value, validation errors, submission state, dirty tracking) requires a lot of boilerplate code. react-hook-form handles all of this.

**Integration with Zod**: The `@hookform/resolvers` package connects Zod schemas to react-hook-form, so the same schema validates both the API and the form.

### Charts: Recharts

**What it is**: A charting library for React that renders SVG charts (pie, bar, line, etc.).

**Components used**:
- `PieChart` + `Pie` — Donut chart for expense category breakdown
- `BarChart` + `Bar` — Grouped bar chart for monthly income vs expenses
- `ResponsiveContainer` — Wrapper that makes charts resize to fit their container
- `Tooltip` — Hover/tap popup showing data values
- `Legend` — Chart legend showing what each color represents

### Date Utilities: date-fns

**What it is**: A collection of functions for manipulating and formatting dates.

**What problem it solves**: JavaScript's built-in `Date` is verbose and inconsistent. `date-fns` provides clear, immutable functions:

```typescript
import { format, parseISO, addMonths, subMonths } from "date-fns";

format(new Date(), "MMM d, yyyy")       // "Feb 6, 2026"
format(parseISO("2026-01-15"), "MMMM")  // "January"
addMonths(new Date(), 1)                 // Next month
```

### Icons: Lucide React

**What it is**: A library of 1000+ SVG icons as React components.

```tsx
import { Plus, Trash2, ChevronLeft } from "lucide-react";

<Plus className="h-4 w-4" />  // Renders a + icon, 16x16 pixels
```

### PWA: Serwist

**What it is**: A service worker library (successor to Workbox) that enables Progressive Web App features.

**What it provides**: Offline caching, background sync, install-to-home-screen prompts, and network-first/cache-first strategies for different resource types.

### Theme: next-themes

**What it is**: A library for switching between light/dark mode in Next.js applications.

**How it works**: Adds a `dark` CSS class to the `<html>` element based on user preference (system setting, manual toggle, or stored preference). Tailwind's `dark:` variant reads this class.

---

## 3. Project Structure

```
spendtinel/
├── src/                          # All application source code
│   ├── app/                      # Next.js App Router (pages + API)
│   │   ├── layout.tsx            # Root layout (HTML shell)
│   │   ├── page.tsx              # / → redirects to /dashboard
│   │   ├── globals.css           # Tailwind + theme variables
│   │   ├── manifest.ts           # PWA manifest (/manifest.json)
│   │   ├── sw.ts                 # Service worker source
│   │   ├── ~offline/page.tsx     # Offline fallback page
│   │   ├── (app)/                # Route group (bottom nav layout)
│   │   │   ├── layout.tsx        # Adds bottom nav + padding
│   │   │   ├── dashboard/        # Home screen
│   │   │   ├── transactions/     # Transaction CRUD + import
│   │   │   ├── summary/          # Monthly + annual views
│   │   │   ├── budget/           # Budget management
│   │   │   └── settings/         # Configuration pages
│   │   └── api/                  # REST API endpoints
│   ├── components/               # React components
│   │   ├── ui/                   # shadcn/ui (auto-generated)
│   │   ├── layout/               # App shell (nav, header)
│   │   ├── providers/            # Context providers
│   │   ├── dashboard/            # Dashboard-specific
│   │   ├── transactions/         # Transaction-specific
│   │   ├── import/               # Bank statement import wizard
│   │   ├── summary/              # Summary-specific
│   │   ├── budget/               # Budget-specific
│   │   ├── charts/               # Recharts wrappers
│   │   └── settings/             # Settings-specific
│   ├── lib/                      # Shared utilities
│   │   ├── prisma.ts             # Database client singleton
│   │   ├── settings.ts           # Transfer category helper (reads AppSettings)
│   │   ├── utils.ts              # cn() class merger
│   │   ├── formatters.ts         # Currency/date formatting
│   │   └── import-ref.ts         # Import deduplication hash generation
│   ├── validators/               # Zod schemas
│   ├── hooks/                    # Custom React hooks
│   ├── types/                    # Shared TypeScript types
│   └── generated/                # Prisma-generated client
├── prisma/
│   ├── schema.prisma             # Database schema definition
│   ├── seed.ts                   # Sample data for development
│   └── migrations/               # SQL migration files
├── public/                       # Static files (served as-is)
│   ├── icons/                    # PWA icons
│   └── sw.js                     # Compiled service worker (generated)
├── scripts/
│   └── deploy.sh                 # Build + deploy to Raspberry Pi
├── docs/                         # Documentation and SQL scripts
├── next.config.ts                # Next.js + Serwist configuration
├── tsconfig.json                 # TypeScript configuration
├── package.json                  # Dependencies and scripts
├── postcss.config.mjs            # PostCSS (Tailwind) config
├── eslint.config.mjs             # Linting rules
├── components.json               # shadcn/ui configuration
├── Dockerfile                    # Multi-stage Docker build
├── docker-compose.yml            # Production deployment
├── docker-compose.dev.yml        # Development database
├── .env                          # Dev environment variables
├── .env.production.example       # Prod env var template
├── .dockerignore                 # Docker build exclusions
└── .gitignore                    # Git exclusions
```

### Understanding Next.js App Router Directory Conventions

Next.js App Router uses **file-system routing** — the directory structure under `src/app/` directly maps to URLs:

| File | URL | Purpose |
|------|-----|---------|
| `src/app/page.tsx` | `/` | Root page |
| `src/app/layout.tsx` | (wraps all pages) | Root HTML layout |
| `src/app/(app)/dashboard/page.tsx` | `/dashboard` | Dashboard page |
| `src/app/(app)/transactions/page.tsx` | `/transactions` | Transaction list |
| `src/app/(app)/transactions/new/page.tsx` | `/transactions/new` | New transaction form |
| `src/app/(app)/transactions/[id]/page.tsx` | `/transactions/abc123` | Edit transaction |
| `src/app/api/transactions/route.ts` | `GET/POST /api/transactions` | API endpoint |
| `src/app/api/transactions/[id]/route.ts` | `GET/PUT/DELETE /api/transactions/abc123` | Single item API |

**Special file names**:
- `page.tsx` — The UI component for a route
- `layout.tsx` — Wraps child pages (persists across navigation)
- `route.ts` — API endpoint (HTTP handler, no UI)

**Special directory patterns**:
- `(app)/` — **Route group**. The parentheses mean "apply this layout but don't add to the URL". `/dashboard` not `/(app)/dashboard`.
- `[id]/` — **Dynamic segment**. Matches any value. `/transactions/abc123` captures `id = "abc123"`.
- `[year]/` — Same concept. `/budgets/2026` captures `year = "2026"`.

---

## 4. Configuration Files

### `package.json` — Project Identity and Dependencies

This is the project's manifest. It declares the project name, scripts, and every dependency.

```json
{
  "scripts": {
    "dev": "next dev",           // Start development server (Turbopack)
    "build": "next build --webpack",  // Production build (Webpack for Serwist)
    "start": "next start",      // Start production server
    "lint": "eslint"             // Run ESLint
  }
}
```

**Why `--webpack`?** Serwist (the PWA library) injects a Webpack plugin to compile the service worker. Next.js defaults to Turbopack in dev mode but uses Webpack for production builds. The `--webpack` flag ensures Serwist's plugin runs during the build. Without it, the service worker won't be generated.

**Dependencies** (what the app uses at runtime):
- `next`, `react`, `react-dom` — The framework
- `@prisma/client`, `@prisma/adapter-pg`, `pg` — Database access
- `zod` — Validation
- `react-hook-form`, `@hookform/resolvers` — Forms
- `recharts` — Charts
- `date-fns` — Date utilities
- `lucide-react` — Icons
- `papaparse` — CSV parsing (for bank statement import)
- `read-excel-file` — Excel (.xlsx/.xls) parsing (for bank statement import)
- `next-themes` — Dark mode
- `radix-ui` — Accessible UI primitives (used by shadcn/ui)
- `class-variance-authority`, `clsx`, `tailwind-merge` — CSS utilities

**Dev Dependencies** (used only during development/build):
- `typescript`, `@types/*` — TypeScript compiler and type definitions
- `prisma` — CLI for migrations/generation (runtime uses `@prisma/client`)
- `tailwindcss`, `@tailwindcss/postcss` — CSS framework
- `eslint`, `eslint-config-next` — Linting
- `@serwist/next`, `serwist` — PWA service worker
- `shadcn` — CLI for adding shadcn/ui components
- `tsx` — TypeScript executor (runs seed.ts)
- `dotenv` — Loads .env files (used in seed script)

### `tsconfig.json` — TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2017",            // Output syntax level
    "lib": ["dom", "dom.iterable", "esnext", "webworker"],
    "strict": true,                // Enable ALL strict checks
    "moduleResolution": "bundler", // Modern module resolution
    "jsx": "react-jsx",           // JSX without React import
    "paths": { "@/*": ["./src/*"] } // Import alias
  }
}
```

**Why `"webworker"` in lib?** The service worker (`sw.ts`) uses Web Worker APIs (`ServiceWorkerGlobalScope`, `PrecacheEntry`). Adding `"webworker"` tells TypeScript these globals exist.

**What does `"strict": true` enable?** It turns on multiple checks at once:
- `strictNullChecks` — `null` and `undefined` are separate types, not assignable to `string`
- `noImplicitAny` — Variables must have explicit types if TypeScript can't infer them
- `strictFunctionTypes` — Function parameter types are checked correctly
- Several more. This catches the most bugs and is recommended for all new projects.

**The `@/*` path alias**: Instead of `import { prisma } from "../../../lib/prisma"` (fragile relative paths), you write `import { prisma } from "@/lib/prisma"` — always relative to `src/`.

### `next.config.ts` — Next.js Configuration

```typescript
import { spawnSync } from "node:child_process";
import withSerwistInit from "@serwist/next";

// Git hash for cache busting the offline page
const revision = spawnSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf-8",
}).stdout?.trim() ?? crypto.randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  reactCompiler: true,    // Automatic memoization (React 19)
  turbopack: {},           // Needed because Serwist adds webpack config
  output: "standalone",    // Minimal production output for Docker
};

export default withSerwist(nextConfig);
```

**`reactCompiler: true`**: React 19's compiler automatically adds `useMemo`, `useCallback`, and `React.memo` where needed. Before this, developers had to manually optimize re-renders. The compiler does it automatically.

**`output: "standalone"`**: During build, Next.js traces which files the server actually needs (which `node_modules`, which source files) and copies only those into `.next/standalone/`. This produces a ~20MB server instead of the full `node_modules` (~300MB+). Essential for the Raspberry Pi's limited storage and bandwidth.

**`turbopack: {}`**: An empty object that tells Next.js "I know Serwist adds Webpack config, that's fine." Without this, dev mode warns about having a Webpack config but no Turbopack config.

### `postcss.config.mjs` — CSS Processing

```javascript
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
```

PostCSS is a CSS processing pipeline. When you write `@import "tailwindcss"` in your CSS, PostCSS runs the Tailwind plugin which transforms utility classes into actual CSS. In Tailwind v4, this replaces the old `tailwind.config.js` file — configuration is now done in CSS.

### `eslint.config.mjs` — Code Quality Rules

```javascript
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,   // Performance rules (no unused imports, image optimization)
  ...nextTs,       // TypeScript-specific rules
  globalIgnores([".next/**", "out/**", "build/**"]),
]);
```

ESLint is a static analysis tool — it reads your code without running it and warns about potential problems (unused variables, accessibility issues, performance anti-patterns). `core-web-vitals` is Next.js's recommended rule set focused on web performance.

### `components.json` — shadcn/ui Configuration

```json
{
  "style": "new-york",        // Visual style (vs "default" which is rounder)
  "rsc": true,                // React Server Components enabled
  "tailwind": {
    "baseColor": "zinc",      // Gray color palette (neutral, not blue-tinted)
    "cssVariables": true       // Use CSS variables for theming
  },
  "aliases": {
    "ui": "@/components/ui",   // Where shadcn installs components
    "utils": "@/lib/utils"     // Where cn() helper lives
  }
}
```

When you run `npx shadcn@latest add button`, it reads this config to know where to place the file, what styling to use, and what import paths to generate.

---

## 5. The Database Layer

### Schema Design (`prisma/schema.prisma`)

The database has **7 models** (tables) and **1 enum**:

```
┌──────────┐     ┌────────────┐
│ Currency │──┐  │ AccountType│──┐
└──────────┘  │  └────────────┘  │
              │                   │
              ▼                   ▼
           ┌─────────┐
           │ Account  │
           └────┬────┘
                │
                ▼
         ┌─────────────┐
         │ Transaction │
         └──────┬──────┘
                │
                ▼
          ┌──────────┐      ┌────────┐      ┌─────────────┐
          │ Category │◄─────│ Budget │      │ AppSettings │
          │ (tree)   │◄─────────────────────│ (singleton) │
          └──────────┘      └────────┘      └─────────────┘
```

#### Currency

```prisma
model Currency {
  id        String    @id @default(uuid())
  code      String    @unique          // "EUR", "USD", "BRL"
  name      String                      // "Euro", "US Dollar"
  symbol    String                      // "€", "$", "R$"
  accounts  Account[]                   // Accounts using this currency
}
```

**Why a separate Currency table?** Instead of storing `"EUR"` as a string on every account, we store a reference (foreign key). This means renaming a currency or changing its symbol updates everywhere automatically.

**`@id @default(uuid())`** — The primary key is a UUID (Universally Unique Identifier), a 36-character random string like `"a1b2c3d4-e5f6-..."`. UUIDs are globally unique without coordination — unlike auto-increment integers, they can be generated client-side and won't collide across databases.

#### AccountType

```prisma
model AccountType {
  id        String    @id @default(uuid())
  name      String    @unique          // "Checking", "Savings", "Credit Card", "Cash"
  accounts  Account[]
}
```

A simple lookup table. You could hardcode these as an enum, but a table lets you add new types without code changes.

#### Account

```prisma
model Account {
  id              String    @id @default(uuid())
  name            String                          // "Main Checking"
  initialBalance  Decimal   @default(0) @db.Decimal(12, 2)
  isActive        Boolean   @default(true)        // Soft-delete flag
  currencyId      String
  accountTypeId   String
  currency        Currency     @relation(...)
  accountType     AccountType  @relation(...)
  transactions    Transaction[] @relation("fromAccount")
}
```

**`Decimal(12, 2)`** — Stores up to 12 digits with 2 decimal places. Decimal is exact, unlike floating-point (`0.1 + 0.2 = 0.30000000000000004` in float, but `0.30` in Decimal). Critical for financial data.

**`isActive` (soft-delete)** — Instead of deleting accounts, we set `isActive: false`. This preserves historical transactions that reference the account. If you hard-delete an account, those transactions would have a broken foreign key.

**`@@index([currencyId])` and `@@index([accountTypeId])`** — Database indexes that speed up queries filtering by currency or account type. Without indexes, the database scans every row.

#### Category (Hierarchical)

```prisma
model Category {
  id          String     @id @default(uuid())
  name        String                           // "Food", "Groceries"
  isActive    Boolean    @default(true)
  parentId    String?                           // null = top-level
  parent      Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children    Category[] @relation("CategoryTree")
  transactions Transaction[]
  budgets     Budget[]
}
```

**Self-referencing relation** — A category can be a child of another category. `parentId` points to another row in the same table. This creates a tree structure:

```
Food (parentId: null)
├── Groceries (parentId: food.id)
├── Restaurants (parentId: food.id)
└── Coffee & Snacks (parentId: food.id)
```

**Two-level limit** — Enforced in application code, not in the database. The API checks that you can't create a child of a child. This keeps the UI manageable.

#### Transaction

```prisma
model Transaction {
  id            String          @id @default(uuid())
  type          TransactionType                    // INCOME, EXPENSE
  amount        Decimal         @db.Decimal(12, 2)
  description   String?
  friendlyName  String?         @db.VarChar(255)   // User-facing display name
  notes         String?         @db.Text           // Longer user notes
  date          DateTime        @db.Date           // Date only, no time
  importRef     String?         @unique            // Deduplication key
  fromAccountId String
  categoryId    String?
  needsReview   Boolean         @default(false)    // Flag for later review
  fromAccount   Account  @relation("fromAccount", ...)
  category      Category? @relation(...)
}
```

**Transaction types**:
- **INCOME**: Money comes into an account (e.g., Salary).
- **EXPENSE**: Money leaves an account (e.g., Groceries).

There is no TRANSFER type. Transfers between accounts are recorded as regular INCOME/EXPENSE transactions tagged with a configurable "transfer category" (see AppSettings). This matches how bank CSV statements represent transfers and simplifies the data model.

**Amount is always positive** — The `type` determines direction. An expense of €50 is stored as `amount: 50, type: EXPENSE`, not `amount: -50`. This avoids confusion and makes aggregation queries simpler.

**`friendlyName`** — An optional user-facing display name. Bank statement descriptions are often cryptic (e.g., "POS DEBIT 0042 LIDL"). The friendly name lets you rename it to something readable (e.g., "Groceries at Lidl"). When present, the UI displays `friendlyName` as the primary title and `description` as a secondary subtitle.

**`notes`** — Free-form text for longer annotations. Useful for recording context like "Birthday dinner with friends" or "Annual gym membership renewal".

**`importRef`** — A unique identifier for imported transactions (e.g., from a bank statement CSV). When importing, you can check if `importRef` already exists to avoid duplicates.

**`needsReview`** — A boolean flag for marking transactions that need attention later (pending refunds, split bills waiting for payback, suspicious charges). Defaults to `false`. Can be set during manual creation, editing, or import. The transaction list has a filter to show only flagged items, and transaction cards show a blue "Review" indicator when flagged.

**`@db.Date`** — Stores only the date (2026-01-15), not the full timestamp. Budget tracking doesn't need time precision.

**Indexes** — Transaction has 4 indexes (date, type, fromAccountId, categoryId) because it's the most-queried table. Every summary, balance, and budget comparison queries transactions with filters.

#### Budget

```prisma
model Budget {
  id         String   @id @default(uuid())
  year       Int                              // 2026
  amount     Decimal  @db.Decimal(12, 2)      // Budget target
  categoryId String
  category   Category @relation(...)

  @@unique([year, categoryId])   // One budget per category per year
  @@index([year])
}
```

**`@@unique([year, categoryId])`** — A compound unique constraint. You can't have two budget entries for "Food" in 2026. This enables the upsert pattern: "create if it doesn't exist, update if it does."

#### AppSettings (Singleton)

```prisma
model AppSettings {
  id                 String    @id @default("singleton")
  transferCategoryId String?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  transferCategory   Category? @relation(fields: [transferCategoryId], references: [id], onDelete: SetNull)
}
```

**Singleton pattern** — There is only one row, always with `id = "singleton"`. The API uses `upsert` to auto-create it on first access. This avoids having global settings scattered across multiple tables.

**`transferCategoryId`** — Points to the category used for inter-account transfers. Transactions in this category are excluded from summaries and budgets (but still count toward account balances). The Settings > General page lets you select this category and shows a "Transfer Balance" indicator that should be 0 if all transfers are properly matched across accounts.

**`onDelete: SetNull`** — If the referenced category is deleted, the setting is cleared rather than causing a foreign key error.

### How Prisma Generates Types

When you run `npx prisma generate`, Prisma reads `schema.prisma` and creates TypeScript code in `src/generated/prisma/`. This includes:

- Type definitions for every model (`Account`, `Transaction`, etc.)
- The `PrismaClient` class with methods like `.account.findMany()`, `.transaction.create()`
- Enum types (`TransactionType.INCOME`, etc.)

**The Prisma Client Singleton** (`src/lib/prisma.ts`):

```typescript
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

**Why the `globalThis` pattern?** In development, Next.js hot-reloads your code on every change. Each hot-reload re-executes all module-level code. Without caching, every reload creates a new `PrismaClient` (which creates a new database connection pool). After many reloads, you'd exhaust the database's connection limit. Storing on `globalThis` (a JavaScript global that survives module re-evaluation) ensures one client instance.

**Why `pg.Pool`?** Prisma 7 uses "driver adapters" — it delegates actual database communication to standard drivers. `pg` is the most widely-used PostgreSQL driver for Node.js. `Pool` manages a pool of connections: instead of opening/closing a connection for every query, it reuses existing connections.

### Migrations

Migrations are versioned SQL scripts that evolve the database schema over time. They live in `prisma/migrations/`.

**Development workflow** (`npx prisma migrate dev`):
1. You change `schema.prisma`
2. Run `prisma migrate dev --name add_tags`
3. Prisma diffs the old schema vs new schema
4. Generates a SQL migration file (e.g., `ALTER TABLE "Transaction" ADD COLUMN "tags" TEXT[]`)
5. Applies it to your dev database
6. Regenerates the Prisma Client

**Production workflow** (`npx prisma migrate deploy`):
1. Applies all pending migrations (never generates new ones)
2. Runs inside the deploy script via SSH tunnel to the production database
3. Uses `homelab_admin` user (which has DDL privileges)

### Seed Data (`prisma/seed.ts`)

The seed script populates the database with sample data for development. It's **idempotent** — running it multiple times produces the same result. Currencies and account types use `upsert` (create or update). Accounts, categories, and transactions use `deleteMany` + `create` to reset to a known state.

The seed creates: 3 currencies, 4 account types, 5 accounts, 8 parent categories with 20 subcategories, 40+ transactions across January-February 2026, and 7 budget entries.

---

## 6. The API Layer

### Architecture

The API follows REST conventions. Each resource has its own directory under `src/app/api/`:

```
api/
├── transactions/
│   ├── route.ts          → GET /api/transactions (list)
│   │                     → POST /api/transactions (create)
│   └── [id]/route.ts     → GET /api/transactions/:id (read)
│                         → PUT /api/transactions/:id (update)
│                         → DELETE /api/transactions/:id (delete)
├── accounts/
│   ├── route.ts          → GET, POST
│   ├── [id]/route.ts     → GET, PUT, DELETE
│   └── balances/route.ts → GET (computed balances)
├── categories/
│   ├── route.ts          → GET, POST
│   └── [id]/route.ts     → GET, PUT, DELETE
├── currencies/
│   ├── route.ts          → GET, POST
│   └── [id]/route.ts     → PUT, DELETE
├── account-types/
│   ├── route.ts          → GET, POST
│   └── [id]/route.ts     → PUT, DELETE
├── budgets/
│   ├── route.ts          → GET (list), POST (bulk upsert)
│   └── [year]/route.ts   → GET (budget vs actual)
├── import/
│   ├── check-duplicates/route.ts → POST (check importRefs for duplicates)
│   ├── execute/route.ts          → POST (bulk create transactions)
│   └── profiles/
│       ├── route.ts              → GET (list), POST (create)
│       └── [id]/route.ts        → DELETE (remove profile)
├── settings/
│   └── route.ts          → GET (read), PUT (update transfer category)
└── summary/
    ├── monthly/route.ts  → GET (monthly breakdown)
    └── annual/route.ts   → GET (yearly breakdown)
```

### How API Route Handlers Work

In Next.js App Router, you export named functions matching HTTP methods:

```typescript
// src/app/api/accounts/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/accounts
export async function GET(request: NextRequest) {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    include: { currency: true, accountType: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ data: accounts });
}

// POST /api/accounts
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createAccountSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Validation failed", code: "VALIDATION_ERROR" } },
      { status: 400 }
    );
  }

  const account = await prisma.account.create({
    data: parsed.data,
    include: { currency: true, accountType: true },
  });

  return NextResponse.json({ data: account }, { status: 201 });
}
```

**The pattern every endpoint follows**:
1. Parse and validate the request (Zod for body, manual for query params)
2. Execute the database query (Prisma)
3. Return a JSON response with consistent shape

### Response Shapes

**Success (list)**: `{ data: T[], pagination: { page, limit, total, totalPages } }`
**Success (single)**: `{ data: T }`
**Error**: `{ error: { message: string, code: string, details?: object } }`

**HTTP Status Codes**:
| Code | Meaning | When used |
|------|---------|-----------|
| 200 | OK | Successful GET, PUT |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE (no body) |
| 400 | Bad Request | Validation failed |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Can't delete (has dependent records) |
| 500 | Internal Server Error | Unexpected failure |

### Key API Endpoints Explained

#### `GET /api/accounts/balances` — Computed Account Balances

This is the most complex endpoint. Account balances aren't stored — they're computed from transactions:

```
balance = initialBalance
        + SUM(INCOME transactions for this account)
        - SUM(EXPENSE transactions for this account)
```

The endpoint loops through all active accounts, runs aggregation queries for each, and groups results by currency. Note that transfer-categorized transactions are **included** in balances — they represent real money movement and must be counted.

```json
{
  "accounts": [...],
  "byCurrency": [
    { "code": "EUR", "symbol": "€", "accounts": [...], "total": 12500.00 },
    { "code": "USD", "symbol": "$", "accounts": [...], "total": 1718.50 }
  ]
}
```

**Why compute instead of store?** Stored balances can drift out of sync if a bug skips an update. Computing from transactions is always correct (it's the "single source of truth"). The performance cost is minimal — this query runs in milliseconds for personal-scale data.

#### `GET /api/summary/monthly` — Monthly Summary

Groups transactions by category for a given month, separating income and expenses. If a transfer category is configured in Settings, those transactions are excluded (they don't represent earning or spending).

The query uses Prisma's `groupBy` to aggregate amounts by category:

```typescript
const expenses = await prisma.transaction.groupBy({
  by: ["categoryId"],
  where: {
    type: "EXPENSE",
    date: { gte: startOfMonth, lte: endOfMonth },
  },
  _sum: { amount: true },
});
```

It then joins categories with their parents to build a hierarchical breakdown:

```json
{
  "totalIncome": 3500,
  "totalExpense": 1850.50,
  "net": 1649.50,
  "categories": [
    { "name": "Food", "total": 450.30, "children": [
      { "name": "Groceries", "total": 318.30 },
      { "name": "Restaurants", "total": 83.50 }
    ]}
  ],
  "incomeCategories": [
    { "name": "Salary", "total": 3000, "children": [] },
    { "name": "Health", "total": 500, "children": [
      { "name": "Insurance Reimbursement", "total": 500 }
    ]}
  ]
}
```

Both `categories` (expenses) and `incomeCategories` use the same hierarchical structure. Income breakdown enables the "same category" reimbursement workflow — categorize a reimbursement under the original expense category, and the summary shows the net impact per category.

#### `GET /api/budgets/[year]` — Budget vs Actual

Merges budget targets with actual spending. For each category:

```json
{
  "categoryName": "Food",
  "budgeted": 6000.00,
  "actual": 892.30,
  "remaining": 5107.70,
  "percentage": 14.87
}
```

The `percentage` drives the progress bar color: green (<75%), yellow (75-100%), red (>100%).

#### `POST /api/budgets` — Bulk Upsert

The budget page sends all category budgets at once. The API uses Prisma's `$transaction` for atomicity — either all budgets save or none do:

```typescript
await prisma.$transaction(
  budgets.map((b) =>
    prisma.budget.upsert({
      where: { year_categoryId: { year, categoryId: b.categoryId } },
      update: { amount: b.amount },
      create: { year, categoryId: b.categoryId, amount: b.amount },
    })
  )
);
```

**`$transaction`** wraps multiple operations in a database transaction. If any operation fails, all are rolled back. This prevents partial saves.

**`upsert`** = "update or insert." If a budget for this year+category exists, update it. If not, create it. This is possible because of the `@@unique([year, categoryId])` constraint.

---

## 7. Validation with Zod

### Where Validation Happens

```
User types in form → react-hook-form + Zod schema (client-side)
                    ↓
                  fetch() POST /api/...
                    ↓
API route handler → Zod schema (server-side) → Prisma → Database
```

**The same Zod schema validates twice**: once in the browser (fast feedback) and once on the server (security — never trust the client). This is called "isomorphic validation."

### Transaction Validator — Discriminated Union

The transaction validator uses Zod's **discriminated union** — different rules based on the transaction type:

```typescript
const baseFields = {
  amount: z.number().positive().multipleOf(0.01),
  description: z.string().max(255).optional(),
  friendlyName: z.string().max(255).optional(),
  notes: z.string().max(1000).optional(),
  date: z.coerce.date(),
  needsReview: z.boolean().optional(),
};

export const createTransactionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("INCOME"),  ...baseFields, fromAccountId: z.string().uuid(), categoryId: z.string().uuid().optional() }),
  z.object({ type: z.literal("EXPENSE"), ...baseFields, fromAccountId: z.string().uuid(), categoryId: z.string().uuid().optional() }),
]);
```

**How discriminated unions work**: Zod looks at the `type` field first. Based on the value, it validates against the matching schema. This gives precise error messages per type instead of a vague "invalid input."

**`z.coerce.date()`** — Accepts both strings and Date objects and converts to Date. JSON doesn't have a Date type, so dates arrive as strings like `"2026-01-15"` from the API. `coerce` handles the conversion automatically.

### Query Parameter Validator

```typescript
export const transactionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  startDate: z.coerce.date().optional(),
  needsReview: z.coerce.boolean().optional(),
  // ...
});
```

**`z.coerce.number()`** — URL query parameters are always strings (`?page=2`). `coerce` converts `"2"` to `2` automatically.

**`.default(1)`** — If `page` is not provided, use `1`. This means pagination works even without explicit page parameters.

---

## 8. The Frontend

### Layout System

The app uses **nested layouts** — a core Next.js App Router concept:

```
Root Layout (src/app/layout.tsx)
├── <html>, <body>, ThemeProvider, fonts
│
└── App Layout (src/app/(app)/layout.tsx)
    ├── <main> with padding
    ├── <BottomNav /> (fixed at bottom)
    │
    └── Page Content (page.tsx)
        ├── <PageHeader title="..." />
        └── Content components
```

**Root Layout** — Renders once, wraps everything. Contains the `<html>` and `<body>` tags, loads fonts, and provides the theme. This is where the PWA meta tags live (apple-web-app, viewport settings).

**App Layout** — Adds the bottom navigation bar. Lives inside the `(app)` route group so all app pages get the nav bar, but the URL doesn't include `(app)`.

**Why `pb-20` on `<main>`?** The bottom nav is fixed-position (stays at the bottom of the screen). Without bottom padding, the last content would be hidden behind the nav bar. `pb-20` = `padding-bottom: 5rem` = enough space for the nav.

### The Root Page — Redirect

```typescript
// src/app/page.tsx
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/dashboard");
}
```

Visiting `/` redirects to `/dashboard`. This runs on the server (307 redirect) — the user never sees this page. We redirect instead of rendering the dashboard here because `/dashboard` lives inside `(app)/` which has the bottom nav layout.

### Server Components vs Client Components

**Server Components** (default — no `"use client"`):
- Render on the server, send HTML to the browser
- Can directly access the database, file system, or environment variables
- Cannot use `useState`, `useEffect`, `onClick`, or any browser API
- No JavaScript shipped to the browser (lighter pages)

**Client Components** (`"use client"` at the top):
- Render in the browser (also server-rendered initially for SSR)
- Can use hooks, event handlers, browser APIs
- JavaScript is shipped to the browser (interactive)

**In this app**: Page files are server components (they set metadata and compose layout). Interactive content is extracted into client components (`DashboardContent`, `TransactionList`, `BudgetContent`, etc.).

**The Suspense Pattern**:

```tsx
// Server component (page.tsx)
export default function BudgetPage() {
  return (
    <Suspense fallback={<Loader2 className="animate-spin" />}>
      <BudgetContent />  {/* Client component using useSearchParams */}
    </Suspense>
  );
}
```

**Why Suspense?** Components using `useSearchParams()` need to read the URL, which isn't available during static rendering. Wrapping in `<Suspense>` tells Next.js: "render the shell immediately, then stream the dynamic content when ready." Without Suspense, Next.js disables static optimization for the entire page.

### Data Fetching Pattern

This app uses **client-side fetching** — data is loaded in the browser after the page renders. This is the simplest pattern for an app-like experience:

```typescript
// Inside a client component
const [data, setData] = useState(null);
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  fetch("/api/accounts")
    .then(res => res.json())
    .then(json => setData(json.data))
    .finally(() => setIsLoading(false));
}, []);
```

**Why not server-side fetching?** For a PWA that runs like a native app, the shell renders instantly (from the service worker cache) and data loads progressively. This feels faster than waiting for the server to fetch everything before sending HTML.

**The `DashboardContent` parallel fetch pattern**:

```typescript
const [balances, summary, transactions] = await Promise.all([
  fetch("/api/accounts/balances").then(r => r.json()),
  fetch("/api/summary/monthly?...").then(r => r.json()),
  fetch("/api/transactions?limit=5").then(r => r.json()),
]);
```

`Promise.all()` fires all three requests simultaneously. If each takes 200ms, the total wait is ~200ms (not 600ms sequentially). This significantly improves perceived performance.

---

## 9. Components In Depth

### Layout Components

#### `BottomNav` (`src/components/layout/bottom-nav.tsx`)

A fixed-position navigation bar at the bottom of the screen with 5 tabs: Dashboard, Transactions, Summary, Budget, Settings.

**Key concepts**:
- **`"use client"`** — Needs `usePathname()` to highlight the active tab
- **`usePathname()`** — Next.js hook that returns the current URL path
- **`min-h-[44px]`** — Apple's Human Interface Guidelines require 44px minimum touch targets on iOS
- **`pb-safe`** — Safe area padding for iPhones with the home indicator bar (the bottom bar on notch-less iPhones)
- **`Link`** — Next.js component for client-side navigation (no full page reload)

#### `PageHeader` (`src/components/layout/page-header.tsx`)

A reusable header with a title, optional description, and optional action buttons slot.

```tsx
<PageHeader title="Summary" description="Monthly breakdown">
  <Button variant="outline" size="sm" asChild>
    <Link href="/summary/annual">Annual</Link>
  </Button>
</PageHeader>
```

**`children` prop** — The action button is passed as `children`, making the component flexible. Any component can be placed there.

### Transaction Components

#### `TransactionForm` (`src/components/transactions/transaction-form.tsx`)

Handles creating and editing transactions (INCOME/EXPENSE).

**Key patterns**:

1. **react-hook-form integration with Zod**:
```typescript
const form = useForm<CreateTransactionInput>({
  resolver: zodResolver(createTransactionSchema),
  defaultValues: { type: "EXPENSE", amount: 0, date: new Date() },
});
```
The `zodResolver` connects the Zod schema to the form, so validation errors appear on individual fields automatically.

2. **Type tabs** — A 2-column tab bar (Expense / Income) lets users switch types. The form fields are the same for both types: amount, description, friendly name, notes, date, account, category, and a "Mark for review" checkbox.

3. **`inputMode="decimal"`** — On mobile, this opens the numeric keyboard with a decimal point instead of the full QWERTY keyboard.

4. **Category grouping** — Categories are displayed grouped by parent, with the format "Parent > Child" for clear hierarchy.

#### `TransactionCard` (`src/components/transactions/transaction-card.tsx`)

A single transaction display. Server component (no interactivity needed for display).

**Color coding**: Income is green, expenses red. Uses a `typeConfig` object to map transaction types to colors and icons — this is cleaner than a chain of if/else statements. Transactions flagged for review show a blue "Review" indicator (with a `CircleDot` icon) next to the category name, using the same inline pattern as the amber "Uncategorized" warning.

**Display priority chain**: The card title uses `friendlyName?.trim() || description || subtitleText`. When a friendly name exists, the bank description shows as a secondary subtitle below it. The `.trim()` prevents whitespace-only friendly names from hiding the description.

#### `TransactionList` (`src/components/transactions/transaction-list.tsx`)

Groups transactions by date and displays them with search, filtering, and pagination.

**Filter UI**: A search bar (debounced 300ms), type tabs (All/Income/Expense), and a collapsible section with account, category, date range, and "Needs review only" filters. The component fetches accounts and categories on mount for the filter dropdowns.

**Date grouping logic**: The API returns a flat array. The component groups transactions into `Map<string, Transaction[]>` where the key is the formatted date (e.g., "Jan 15, 2026").

#### `DeleteTransactionButton` (`src/components/transactions/delete-transaction-button.tsx`)

A trash icon that opens a confirmation dialog before deleting.

**Why a confirmation dialog?** Deleting a transaction is destructive (hard-delete, not soft-delete). The dialog prevents accidental deletions from mistaken taps on mobile.

### Settings Components

#### `GeneralSettings` (`src/components/settings/general-settings.tsx`)

The app-wide preferences panel, accessible from Settings > General. Currently supports:

- **Transfer Category selector** — A dropdown to pick which category represents inter-account transfers. Transactions in this category are excluded from summaries and budgets. Saves immediately on change via `PUT /api/settings`.
- **Transfer Balance indicator** — Shows the net sum of all transfer-categorized transactions (INCOME minus EXPENSE). Displayed in green if 0 (all transfers are matched), amber if non-zero (some transfers are missing a counterpart).

This is a client component that fetches categories and settings on mount, then re-fetches settings after each save to update the transfer balance.

#### `SimpleSettingsList` — Generic CRUD Component

```tsx
<SimpleSettingsList
  apiEndpoint="/api/currencies"
  title="Currency"
  fields={[
    { name: "code", label: "Code", placeholder: "EUR" },
    { name: "name", label: "Name", placeholder: "Euro" },
    { name: "symbol", label: "Symbol", placeholder: "€" },
  ]}
  displayField="code"
  subtitleField="name"
  badgeField="symbol"
/>
```

**One component, multiple uses**: The same `SimpleSettingsList` renders both the Currencies page and the Account Types page. It accepts configuration as props (which API to call, which fields to show, how to display items). This avoids duplicating the CRUD logic.

**This is a common pattern called "render through configuration"** — instead of building separate components for similar UIs, you build one configurable component.

#### `SettingsItemForm` — Reusable Sheet Form

A bottom-sheet (drawer) form that works for both creating and editing items. It determines POST vs PUT based on whether `itemId` is provided:

```typescript
const method = itemId ? "PUT" : "POST";
const url = itemId ? `${apiEndpoint}/${itemId}` : apiEndpoint;
```

**Bottom sheets** (`Sheet` from shadcn/ui) are a mobile-first pattern. They slide up from the bottom of the screen, which is within thumb reach on phones. They're more natural than modals (which appear in the center) on mobile devices.

#### `CategoryTree` — Hierarchical Category Management

Displays categories in a collapsible tree with add/edit/toggle operations.

**State management**: The component tracks which parent categories are expanded using a `Set<string>` of expanded IDs. Clicking the chevron toggles membership in the set.

**Cascade soft-delete**: When you deactivate a parent category, the API also deactivates all its children. This maintains data consistency — you shouldn't have active children under an inactive parent.

#### `AccountList` — Account Management

Fetches three endpoints in parallel (accounts, currencies, account types) because the form needs all three to populate dropdown options:

```typescript
const [accountsRes, currenciesRes, typesRes] = await Promise.all([
  fetch("/api/accounts?all=true"),
  fetch("/api/currencies"),
  fetch("/api/account-types"),
]);
```

### Import Components

The bank statement import feature lives in `src/components/import/` and uses a multi-step wizard pattern.

#### `ImportWizard` — State Machine

Manages the import flow through 4 steps: Upload → Column Mapping → Review → Confirm. All state is lifted into a single `ImportState` object that's passed down to each step. The wizard doesn't use URL-based state — it's all in React state, so refreshing the page resets the import.

#### `StepUpload` — File Parsing

Accepts CSV and Excel files (`.csv`, `.xlsx`, `.xls`). Uses **PapaParse** for CSV parsing and **read-excel-file** for Excel. Supports saved import profiles that remember column mapping, delimiter, skip rows, and date format settings from previous imports of the same bank format.

#### `StepColumnMapping` — Column Assignment

Presents dropdowns to map CSV/Excel columns to transaction fields (date, description, amount, etc.). Supports two amount modes: single column (positive/negative) or split columns (debit + credit). Includes a data preview table and profile save/load functionality.

#### `StepReview` — Transaction Preview

Shows all parsed transactions with checkboxes, category dropdowns, type toggles (Income/Expense), inline friendly name and notes inputs, and a per-row "Review" checkbox to flag imported transactions for later review. On mount, generates `importRef` hashes using Web Crypto API and checks for duplicates via the API. Duplicate rows are auto-unchecked and badged.

#### `StepConfirm` — Final Import

Shows a summary of what will be imported (count, income/expense breakdown) and triggers the bulk import via `/api/import/execute`. Displays success/error state after completion.

#### Import Deduplication (`src/lib/import-ref.ts`)

Each imported row gets a unique hash (`importRef`) based on account ID, date, description, amount, and an occurrence counter. The occurrence counter handles rows that are identical in all fields (e.g., two $5.00 charges at the same store on the same day). The hash uses SHA-256 via the Web Crypto API.

### Summary Components

#### `MonthYearPicker` — URL-Based Navigation

```tsx
<MonthYearPicker mode="month" basePath="/summary" />
```

Uses URL search parameters (`?year=2026&month=1`) instead of local state. This means:
- **Bookmarkable** — You can share a link to a specific month's summary
- **Browser history** — Back/forward buttons navigate between months
- **No state loss** — Refreshing the page keeps the selected month

The component uses `useRouter().push()` with `useSearchParams()` to read and update the URL.

#### Expenses / Income Tabs

Both the monthly and annual summaries use a tabbed interface to switch between expense and income views. In the monthly summary, the tabs control both the pie chart and the category breakdown below it. In the annual summary, the tabs control the category table. The bar chart remains always visible since it already shows both income and expense bars side by side.

#### `CategoryBreakdown` — Category Distribution

Reusable component for both expense and income category breakdowns. Shows each parent category's total and percentage. Child categories are nested and indented. Percentages are computed client-side:

```typescript
const percentage = total > 0 ? (category.total / total) * 100 : 0;
```

Used in both tabs: expense tab passes `total={totalExpense}`, income tab passes `total={totalIncome}`.

#### `AnnualCategoryTable` — Scrollable Monthly Grid

A table with 14 columns: Category (sticky), Total, and 12 months. On mobile, this scrolls horizontally with the category column staying fixed (CSS `sticky`). Used in both the expense and income tabs of the annual summary.

**`sticky` positioning** — The first column has `position: sticky; left: 0`. As you scroll horizontally, it "sticks" to the left edge. This is essential on mobile where the table is wider than the screen.

### Dashboard Component

#### `DashboardContent`

The home screen fetches three APIs in parallel and displays:
1. **Account balances** — Grouped by currency (e.g., "EUR accounts: €12,500")
2. **Monthly snapshot** — This month's income, expenses, and net
3. **Recent transactions** — Last 5 transactions

### Budget Components

#### `BudgetContent` — Inline Editing

This component has the most complex state management. It:
1. Fetches budget data from the API
2. Stores budgets in local state
3. Tracks edits (changed values) separately
4. On save, sends only changed entries to the API (bulk upsert)

**Optimistic local state pattern**: When you edit a budget amount, the change appears immediately in the UI (local state updates). Only when you click "Save" does it go to the server. If the save fails, the UI shows an error but the local state remains so you don't lose your edits.

#### `BudgetProgressBar` — Visual Progress

A simple color-coded bar:
- Green (0-75%): `bg-green-500`
- Yellow (75-100%): `bg-yellow-500`
- Red (100%+): `bg-red-500`

The width is capped at 100% even if the actual value exceeds it (so the bar doesn't overflow).

---

## 10. Hooks and Data Fetching

### `useTransactions` Hook (`src/hooks/use-transactions.ts`)

A custom React hook that encapsulates transaction fetching with filters and pagination.

```typescript
export function useTransactions(filters?: Partial<TransactionQuery>) {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const response = await fetch(`/api/transactions?${params}`);
    const result = await response.json();
    setTransactions(result.data);
    setIsLoading(false);
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { transactions, isLoading, error, refetch: fetchData };
}
```

**Why a custom hook?** It separates data fetching logic from UI rendering. The `TransactionList` component only needs to call `useTransactions()` and render the results — it doesn't need to know about `fetch`, `URLSearchParams`, or error handling.

**`useCallback` prevents infinite loops**: Without it, `fetchData` would be a new function on every render → `useEffect` would see a new dependency → trigger a fetch → cause a re-render → create a new function → infinite loop.

**Why not use SWR or React Query?** These libraries add caching, revalidation, and deduplication automatically. They're excellent for production apps. This codebase implements fetching manually for educational purposes — so you understand what those libraries abstract away. You could swap to SWR later by changing only this hook.

### Shared Types (`src/types/api.ts`)

```typescript
export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface ApiError {
  error: { message: string; code: string; details?: Record<string, string[]> };
}
```

**Generics** (`<T>`): `PaginatedResponse<Account>` means `data` is `Account[]`. `PaginatedResponse<Transaction>` means `data` is `Transaction[]`. One interface, any data type.

---

## 11. Styling with Tailwind CSS

### How Tailwind Works

Instead of writing CSS in separate files:

```css
/* Traditional CSS */
.header { font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem; color: gray; }
```

You compose utility classes in JSX:

```tsx
<h1 className="text-2xl font-bold mb-4 text-muted-foreground">Title</h1>
```

Each class does one thing: `text-2xl` = font-size 1.5rem, `font-bold` = font-weight 700, `mb-4` = margin-bottom 1rem.

### The `cn()` Utility (`src/lib/utils.ts`)

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

This combines two utilities:
- **`clsx`** — Conditionally joins class names: `clsx("base", isActive && "bg-green")` → `"base bg-green"` or `"base"`
- **`twMerge`** — Resolves Tailwind conflicts: `twMerge("px-4 px-8")` → `"px-8"` (last wins). Without this, both classes would apply and the result would be unpredictable.

**Every shadcn/ui component uses `cn()`** to merge default classes with custom ones.

### Theme System (`globals.css`)

The CSS file defines design tokens as CSS custom properties (variables):

```css
:root {
  --background: oklch(1 0 0);          /* White */
  --foreground: oklch(0.141 0.005 285.823);  /* Near-black */
  --primary: oklch(0.21 0.006 285.885);
  --muted-foreground: oklch(0.552 0.016 285.938);
  /* ... */
}

.dark {
  --background: oklch(0.141 0.005 285.823);  /* Near-black */
  --foreground: oklch(0.985 0 0);            /* Near-white */
  /* ... inverted colors ... */
}
```

**OKLCH color space** — A perceptually uniform color model. Unlike hex or RGB, "50% lightness" in OKLCH actually looks 50% as bright. This produces more visually consistent color palettes.

Tailwind maps these variables to utility classes:
```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
}
```

Now `bg-background`, `text-foreground`, etc. automatically adapt to light/dark mode.

### Responsive Design

Tailwind uses **mobile-first breakpoints**. Unprefixed classes apply to all screens. Prefixed classes apply from that breakpoint up:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
```

- `grid-cols-1` — 1 column on mobile
- `md:grid-cols-2` — 2 columns on medium screens (768px+)
- `lg:grid-cols-3` — 3 columns on large screens (1024px+)

### Currency and Date Formatting (`src/lib/formatters.ts`)

```typescript
export function formatCurrency(amount: number | string, currencyCode: string): string {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(numAmount);
}
```

**`Intl.NumberFormat`** is a browser API for locale-aware number formatting. Given `currencyCode: "EUR"`, it automatically uses the `€` symbol and correct decimal placement. This is more reliable than manual string formatting.

**Why accept `string | number`?** Prisma returns Decimal fields as strings (to preserve precision). JSON doesn't have a Decimal type, so `"1234.56"` arrives as a string. The formatter handles both.

---

## 12. Charts with Recharts

### Expense Pie Chart

```tsx
<ResponsiveContainer width="100%" height={250}>
  <PieChart>
    <Pie
      data={data}          // [{ name: "Food", total: 450 }, ...]
      dataKey="total"       // Which property maps to the size
      nameKey="name"        // Which property maps to the label
      cx="50%" cy="50%"    // Center coordinates
      innerRadius={60}      // Creates donut shape (vs filled pie)
      outerRadius={100}
      paddingAngle={2}      // Gap between slices
    >
      {data.map((_, index) => (
        <Cell key={index} fill={COLORS[index % COLORS.length]} />
      ))}
    </Pie>
    <Tooltip formatter={(value) => formatCurrency(value ?? 0, "EUR")} />
    <Legend />
  </PieChart>
</ResponsiveContainer>
```

**`ResponsiveContainer`** wraps the chart and makes it resize to fit its parent. Without it, you'd need hardcoded pixel dimensions.

**`Cell`** assigns colors from a palette. `COLORS[index % COLORS.length]` cycles through colors if there are more categories than colors.

**`Legend`** renders a color-coded key below the chart. Uses `wrapperStyle` with `hsl(var(--foreground))` so label text is readable in both light and dark mode.

**Dark mode chart colors** — All text elements in charts (axis tick labels, legend text, tooltip text) use `hsl(var(--foreground))` from the theme instead of hardcoded colors. This ensures readability in both light and dark mode.

### Annual Bar Chart

```tsx
<BarChart data={data}>
  <XAxis dataKey="month" tick={{ fill: "hsl(var(--foreground))" }} />
  <YAxis tick={{ fill: "hsl(var(--foreground))" }} />
  <Bar dataKey="income" fill="#22c55e" name="Income" />
  <Bar dataKey="expense" fill="#ef4444" name="Expenses" />
</BarChart>
```

A grouped bar chart showing monthly income (green) and expenses (red) side by side for each month.

---

## 13. PWA: Progressive Web App

### What Makes It a PWA

Three things turn a website into a PWA:

1. **Web App Manifest** (`manifest.ts`) — Tells the browser how to install the app
2. **Service Worker** (`sw.ts`) — Enables offline functionality and caching
3. **HTTPS** — Required for service workers (localhost is exempt for development)

### Web App Manifest (`src/app/manifest.ts`)

```typescript
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Spendtinel",
    short_name: "Spendtinel",
    start_url: "/",
    display: "standalone",    // No browser chrome (address bar, tabs)
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      { src: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { src: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
  };
}
```

**`display: "standalone"`** — When installed on the home screen, the app runs fullscreen without the Safari address bar. It looks and feels like a native app.

**Why Next.js function instead of a static JSON file?** Next.js automatically serves it at `/manifest.json` and can dynamically generate values if needed.

### Service Worker (`src/app/sw.ts`)

```typescript
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,  // Injected at build time
  skipWaiting: true,                     // Activate immediately
  clientsClaim: true,                    // Take control of all pages
  navigationPreload: true,               // Speed up page loads
  runtimeCaching: defaultCache,          // Cache strategies
  fallbacks: {
    entries: [{
      url: "/~offline",
      matcher: ({ request }) => request.destination === "document",
    }],
  },
});
```

**Precaching**: At build time, Serwist generates a list of all assets (JS bundles, CSS, etc.) and injects it into `__SW_MANIFEST`. On install, the service worker downloads all of them. This means the app shell loads instantly on subsequent visits.

**Runtime caching**: For requests not in the precache (API calls, dynamic content), `defaultCache` applies strategies:
- **Network-first** for pages — try the network, fall back to cache
- **Cache-first** for static assets — serve from cache, update in background
- **Stale-while-revalidate** for images — serve cached, fetch updated version for next time

**Offline fallback**: When a page navigation fails (no network), the service worker serves `/~offline` — a simple "You're offline" page that was precached.

**`skipWaiting + clientsClaim`**: Normally, a new service worker waits until all tabs are closed before activating. These flags make it take control immediately, so users get updates without closing and reopening the app.

### Offline Fallback Page (`src/app/~offline/page.tsx`)

```tsx
export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <h1 className="text-2xl font-bold">You're offline</h1>
      <p>Check your internet connection and try again.</p>
    </div>
  );
}
```

**The `~` prefix** is a Serwist convention. It's unlikely to collide with a real app route.

### PWA Meta Tags in Root Layout

```typescript
export const metadata: Metadata = {
  appleWebApp: {
    capable: true,                    // Enable standalone mode on iOS
    statusBarStyle: "default",       // Black status bar
    title: "Spendtinel",          // Name under the icon
  },
  formatDetection: { telephone: false }, // Don't auto-link phone numbers
  icons: {
    icon: "/icons/icon-192.svg",
    apple: "/icons/icon-192.svg",    // Icon when added to home screen
  },
};

export const viewport: Viewport = {
  maximumScale: 1,          // Disable pinch-to-zoom
  userScalable: false,      // Same — app-like behavior
  themeColor: [             // Color of the browser/status bar
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};
```

---

## 14. Dark Mode

### How It Works

The dark mode system has three layers:

1. **`next-themes`** (`ThemeProvider`) — Manages the preference (system/light/dark) and adds the `dark` class to `<html>`
2. **CSS variables** (`globals.css`) — `:root` defines light colors, `.dark` overrides with dark colors
3. **Tailwind's `dark:` variant** — `dark:bg-zinc-900` applies only when `.dark` class is on `<html>`

```
User preference (system/manual)
        ↓
ThemeProvider sets <html class="dark">
        ↓
CSS variables change values  ( --background: white → black )
        ↓
Tailwind utilities respond  ( bg-background → dark background )
```

**`suppressHydrationWarning`** on `<html>` — next-themes modifies the `<html>` class client-side (adding "dark"). This differs from the server-rendered HTML (which doesn't know the user's preference). Without `suppressHydrationWarning`, React would warn about this mismatch.

### `@custom-variant dark (&:is(.dark *))` (in `globals.css`)

This tells Tailwind v4 how the `dark:` variant works. The selector `&:is(.dark *)` means "this element when it's inside an element with the `.dark` class." This matches how next-themes adds `.dark` to `<html>`.

---

## 15. Docker and Deployment

### Dockerfile — Multi-Stage Build

```dockerfile
# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build the app
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 3: Production image
FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER nextjs
EXPOSE 3000
ENV HOSTNAME="0.0.0.0" PORT=3000 NODE_ENV=production
CMD ["node", "server.js"]
```

**Why multi-stage?** Each `FROM` starts a fresh image. The final image (`runner`) only contains what's needed to run — not the build tools, source code, or full `node_modules`. This reduces the image from ~1GB to ~150MB.

**Stage 1 (deps)** — Copies only `package.json` and `package-lock.json`, then runs `npm ci`. Because Docker caches layers, this step is skipped if dependencies haven't changed (even if source code has). This saves significant build time.

**Stage 2 (builder)** — Copies source code and runs the build. `prisma generate` creates the client code, then `npm run build` compiles Next.js.

**Stage 3 (runner)** — Starts from a clean Alpine image. Copies only three things:
- `.next/standalone` — The self-contained server (~20MB)
- `.next/static` — CSS, JS bundles (served by Next.js)
- `public/` — Static files (icons, service worker)

**`USER nextjs`** — Runs as a non-root user for security. If the app is compromised, the attacker has limited system access.

**`HOSTNAME="0.0.0.0"`** — By default, Node.js listens on `127.0.0.1` (localhost only). Inside Docker, `127.0.0.1` means "inside the container" — unreachable from outside. `0.0.0.0` listens on all network interfaces, making the app reachable from the host.

### Docker Compose Files

**`docker-compose.dev.yml`** — Development database:

```yaml
services:
  db:
    image: postgres:17-alpine
    container_name: spendtinel-db
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: personal_finance_dev
      POSTGRES_USER: budget_app_dev
      POSTGRES_PASSWORD: dev_password_change_me
    volumes:
      - spendtinel_dev_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U budget_app_dev -d personal_finance_dev"]
```

**Named volume** (`spendtinel_dev_data`) — Data persists across container restarts. `docker compose down` keeps the volume; `docker compose down -v` deletes it.

**`docker-compose.yml`** — Production deployment:

```yaml
services:
  app:
    image: spendtinel:latest
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}  # From .env on the Pi
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://127.0.0.1:3000/"]
```

**`${DATABASE_URL}`** — Docker Compose reads `.env` from the same directory. The `${}` syntax substitutes the value. This keeps credentials out of the compose file.

**`restart: unless-stopped`** — Restarts the container automatically if it crashes or the Pi reboots. It only stays stopped if you explicitly `docker compose down`.

**Health check** — Docker periodically hits `http://127.0.0.1:3000/` to verify the app is responsive. If 3 checks fail, Docker marks the container as unhealthy. Uses `127.0.0.1` instead of `localhost` because Alpine's DNS resolves `localhost` to IPv6 (`::1`), but Node.js listens on IPv4.

### Deploy Script (`scripts/deploy.sh`)

A 6-step automated deployment:

1. **Build** — `docker build` with version tag + `latest` tag
2. **Migrate** — SSH tunnel to production DB, run `prisma migrate deploy`
3. **Export** — `docker save | gzip` creates a compressed image file
4. **Transfer** — `scp` copies the file to the Raspberry Pi
5. **Load** — `docker load` on the Pi imports the image
6. **Verify** — Check the container is running and healthy

**Configuration** is read from `.env.production.local` (gitignored):
- `PI_SSH` — SSH host for the Raspberry Pi
- `PI_APP_DIR` — Where `docker-compose.yml` lives on the Pi (full path, not `~`)
- `DB_SSH` — SSH host for the database server
- `MIGRATE_DB_URL` — Connection string through the SSH tunnel

**SSH tunnel for migrations**:
```bash
ssh -f -N -L 5433:localhost:5432 "${DB_SSH}"
```
This forwards local port 5433 to the NUC's port 5432 through SSH. Prisma connects to `localhost:5433` which tunnels to the production database securely.

**Git tag versioning**: The script reads the latest git tag (e.g., `v1.0.0`) and uses it as the Docker image tag. Safety checks warn about uncommitted changes and tag/HEAD mismatches.

---

## 16. Key Design Decisions

### Amounts Are Always Positive

Storing `-50` for expenses creates confusion: does negative mean expense or refund? Instead, `amount` is always positive and `type` determines direction. Aggregation queries become simpler:

```sql
SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) AS total_income
SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) AS total_expense
```

### Transfers Are Category-Based, Not a Type

Instead of a dedicated TRANSFER transaction type (with `fromAccountId` / `toAccountId`), transfers are regular INCOME/EXPENSE transactions tagged with a configurable "transfer category" in Settings > General. This approach was chosen because:
- **Matches bank statement reality** — Bank CSVs show transfers as debits/credits, not as a special type. Import works without special handling.
- **Simpler data model** — No `toAccountId`, `toAmount`, or type-specific branching in every API and UI component.
- **Flexible** — Users configure which category represents transfers, matching their existing workflow (e.g., from Excel budgeting).
- **Transfer Balance indicator** — Settings > General shows the net sum of all transfer-categorized transactions, which should be 0 if all transfers are properly matched across accounts.

### Soft-Delete for Accounts and Categories

Accounts and categories use `isActive: false` instead of deletion. This preserves historical data — you can still see transactions from a closed account. Hard-deleting would require cascading deletes or null foreign keys, both problematic.

Transactions are hard-deleted because they don't have dependent records and the user explicitly confirms deletion.

### Computed Balances

Account balances are computed from transactions, not stored. This is the "CQRS without CQRS" approach — the transaction log is the source of truth. The balance endpoint aggregates on read.

For personal finance scale (thousands of transactions), this is fast enough. At enterprise scale (millions), you'd add a materialized view or cached balance.

### URL-Based State for Summaries

The selected month/year is stored in the URL (`?year=2026&month=1`), not in component state. Benefits:
- **Shareable** — Copy the URL to share a specific month's view
- **Bookmarkable** — Save a bookmark to your favorite view
- **Browser history** — Back/forward buttons navigate between months
- **No state loss** — Refreshing the page preserves the selection

### Client-Side Data Fetching

All data fetching happens in the browser via `fetch()`. This gives an app-like experience:
- The shell renders instantly (from service worker cache)
- Data loads progressively (loading spinners)
- Navigation doesn't reload the page

The trade-off is that the initial data load shows a spinner. For a personal-use PWA, this is acceptable. For a public-facing website needing SEO, you'd use server-side fetching.

---

## 17. Common Patterns in This Codebase

### Pattern: Loading → Error → Data

Every component that fetches data follows the same structure:

```tsx
const [data, setData] = useState(null);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState(null);

if (isLoading) return <Loader2 className="animate-spin" />;
if (error) return <p className="text-destructive">{error}</p>;
return <div>{/* render data */}</div>;
```

### Pattern: Parallel API Calls

When multiple independent endpoints are needed, use `Promise.all`:

```typescript
const [accounts, currencies, types] = await Promise.all([
  fetch("/api/accounts").then(r => r.json()),
  fetch("/api/currencies").then(r => r.json()),
  fetch("/api/account-types").then(r => r.json()),
]);
```

### Pattern: Generic Reusable Components

Instead of building separate components for similar UIs, pass configuration as props:

```tsx
// One component handles currencies AND account types
<SimpleSettingsList apiEndpoint="/api/currencies" fields={currencyFields} ... />
<SimpleSettingsList apiEndpoint="/api/account-types" fields={typeFields} ... />
```

### Pattern: Zod Schema → Form → API

The same Zod schema validates at three levels:

```
1. Schema definition:      validators/transaction.ts
2. Form validation:        zodResolver(createTransactionSchema)
3. API validation:         createTransactionSchema.safeParse(body)
```

### Pattern: Server Page → Client Content

Pages are server components for metadata. Interactive content is extracted to client components:

```tsx
// page.tsx (server component)
export const metadata = { title: "Budget" };
export default function BudgetPage() {
  return (
    <PageHeader title="Budget" />
    <Suspense><BudgetContent /></Suspense>  {/* client component */}
  );
}
```

### Pattern: Build Query String from Filters

Convert an object of filters to URL search parameters:

```typescript
const params = new URLSearchParams();
Object.entries(filters).forEach(([key, value]) => {
  if (value !== undefined) params.set(key, String(value));
});
const response = await fetch(`/api/transactions?${params}`);
```

---

## 18. Glossary

| Term | Meaning |
|------|---------|
| **API** | Application Programming Interface — the HTTP endpoints your frontend calls |
| **App Router** | Next.js routing system based on the file system (vs the older "Pages Router") |
| **Client Component** | React component that runs in the browser (marked with `"use client"`) |
| **CRUD** | Create, Read, Update, Delete — the four basic database operations |
| **CSS Variable** | A value defined once and reused: `--background: white` → `var(--background)` |
| **DDL** | Data Definition Language — SQL for creating/altering tables (`CREATE TABLE`, `ALTER TABLE`) |
| **Discriminated Union** | A TypeScript/Zod pattern where a literal field determines the shape of the rest |
| **Driver Adapter** | Prisma 7's way of using standard DB drivers instead of its own engine |
| **Foreign Key** | A field that references another table's primary key (creates a relation) |
| **Hook** | A React function starting with `use` that adds state/effects to components |
| **Hydration** | The process of making server-rendered HTML interactive by attaching JavaScript |
| **Idempotent** | An operation that produces the same result no matter how many times you run it |
| **Index** | A database structure that speeds up queries on specific columns |
| **JSX** | HTML-like syntax in JavaScript: `<div className="foo">text</div>` |
| **Middleware** | Code that runs between the request and the handler (not used in this app yet) |
| **Migration** | A versioned SQL script that changes the database schema |
| **ORM** | Object-Relational Mapper — translates between code objects and database rows |
| **PostCSS** | A CSS processing tool that transforms CSS with plugins (like Tailwind) |
| **Precaching** | Downloading and caching assets when the service worker installs (offline-ready) |
| **Props** | Data passed from a parent component to a child component |
| **PWA** | Progressive Web App — a website that behaves like a native app |
| **Route Group** | A Next.js directory with parentheses `(name)/` that adds layout without URL segment |
| **Route Handler** | A `route.ts` file that handles HTTP requests (replaces API routes from Pages Router) |
| **RSC** | React Server Components — components that render only on the server |
| **Schema** | The definition of your database structure (tables, columns, types, relations) |
| **Seed** | Populating a database with initial/sample data |
| **Server Component** | Default in App Router — renders on server, no JS shipped to browser |
| **Service Worker** | A script that runs in the background, intercepting network requests for caching |
| **Soft Delete** | Marking a record as inactive instead of removing it from the database |
| **SSR** | Server-Side Rendering — generating HTML on the server for each request |
| **Standalone Output** | Next.js build mode that traces dependencies for a minimal production bundle |
| **Suspense** | React feature for showing fallback UI while async content loads |
| **Turbopack** | Next.js's Rust-based bundler for development (faster than Webpack) |
| **Upsert** | "Update or Insert" — creates a record if it doesn't exist, updates if it does |
| **UUID** | Universally Unique Identifier — a random 36-character ID like `a1b2c3d4-e5f6-...` |
| **Viewport** | The visible area of a web page; also the meta tag controlling mobile display |
| **Webpack** | JavaScript bundler used for production builds (Serwist requires it) |
| **Zod** | Runtime validation library that also generates TypeScript types |
