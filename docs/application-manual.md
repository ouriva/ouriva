# Ouriva — Application Manual

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
15. [Internationalisation (i18n)](#15-internationalisation-i18n)
16. [Docker and Deployment](#16-docker-and-deployment)
17. [Key Design Decisions](#17-key-design-decisions)
18. [Common Patterns in This Codebase](#18-common-patterns-in-this-codebase)
19. [Glossary](#19-glossary)

---

## 1. The Big Picture

This is a **personal finance application** that replaces an Excel spreadsheet. It lets you:

- Track multiple bank accounts across different currencies (EUR, USD, BRL, etc.)
- Record income, expenses, and inter-account transfers (INCOME / EXPENSE / TRANSFER transaction types)
- Import bank statements from CSV and Excel files with column mapping and duplicate detection
- Auto-categorize imported transactions using configurable text-matching rules (contains / starts with / exact / regex)
- Add friendly display names and notes to transactions
- Flag transactions for review (pending refunds, split bills, suspicious charges)
- Duplicate an existing transaction — pre-fills a new form with all the source fields (including splits), defaulting the date to today
- Search and filter transactions by text, type, account, category, date range, or review status
- Export transactions to CSV (with active filters applied) for use in spreadsheets
- Organize transactions with hierarchical categories (e.g., Food > Groceries)
- Set annual budgets per category and track spending against them; reimbursements (income in an expense category) and corrections (expense in an income category) are automatically netted off the relevant actual
- View monthly and annual summaries with charts; drill into subcategory breakdowns in the annual view
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
│         ▼         App Server (Docker)              │
│  ┌─────────────┐                                   │
│  │  Next.js    │                                   │
│  │  API Routes │                                   │
│  └──────┬──────┘                                   │
│         │ Prisma ORM                               │
└─────────┼─────────────────────────────────────────┘
          │ TCP (PostgreSQL protocol)
┌─────────┼─────────────────────────────────────────┐
│         ▼         Database Server (Docker)         │
│  ┌─────────────┐                                   │
│  │  PostgreSQL │                                   │
│  │  Database   │                                   │
│  └─────────────┘                                   │
└───────────────────────────────────────────────────┘
```

**The request lifecycle**: You tap a button on your phone → the browser sends a `fetch()` request to the Next.js server → Next.js runs the API route handler → Prisma translates it to SQL → PostgreSQL executes the query → the result travels back through the same chain → React renders the updated UI.

### Why This Stack?

The stack was chosen for these priorities:

1. **Mobile-first** — Tailwind CSS makes responsive design natural; PWA removes app store friction
2. **Type safety end-to-end** — TypeScript catches errors at compile time; Zod catches them at runtime; Prisma generates types from the database schema
3. **Single language** — JavaScript/TypeScript for frontend, backend, and database queries. One language to learn.
4. **Low resource usage** — Next.js standalone output produces a ~150MB Docker image, suitable for modest servers
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

### Internationalisation: next-intl

**What it is**: The standard i18n library for Next.js App Router. Provides `useTranslations()` for client components, `getTranslations()` for server components, and `NextIntlClientProvider` to distribute messages to the client tree.

**Why next-intl**: Native async Server Component support, type-safe message keys (TypeScript knows if you mistype a key), and active maintenance for App Router patterns.

**Locale strategy**: Cookie-based with no URL prefix (`localePrefix: "never"`). `/dashboard` stays `/dashboard` in both English and Portuguese — essential for a PWA where the service worker caches URLs and the user has the app installed to their home screen.

---

## 3. Project Structure

```
ouriva/
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
│   │   │   ├── analytics/        # Analytics charts
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
│   │   ├── analytics/            # Analytics charts + period selector
│   │   ├── charts/               # Recharts wrappers
│   │   └── settings/             # Settings-specific
│   ├── lib/                      # Shared utilities
│   │   ├── prisma.ts             # Database client singleton
│   │   ├── settings.ts           # Excluded category IDs helper (reads AppSettings)
│   │   ├── utils.ts              # cn() class merger
│   │   ├── formatters.ts         # Currency/date formatting
│   │   ├── import-ref.ts         # Import deduplication hash generation
│   │   ├── category-rules.ts     # Pure rule-matching utility (matchRule)
│   │   └── category-icons.ts     # CATEGORY_ICONS map + CATEGORY_COLORS + ICON_GROUPS
│   ├── i18n/                     # Internationalisation config
│   │   ├── routing.ts            # Locale list + cookie strategy
│   │   └── request.ts            # Server-side locale resolver
│   ├── validators/               # Zod schemas
│   ├── hooks/                    # Custom React hooks
│   ├── types/                    # Shared TypeScript types
│   └── generated/                # Prisma-generated client
├── messages/                     # Translation files
│   ├── en.json                   # English strings
│   └── pt.json                   # Portuguese strings
├── prisma/
│   ├── schema.prisma             # Database schema definition
│   ├── seed.ts                   # Sample data for development
│   └── migrations/               # SQL migration files
├── public/                       # Static files (served as-is)
│   ├── icons/                    # PWA icons
│   └── sw.js                     # Compiled service worker (generated)
├── docs/                         # Documentation and SQL scripts
├── src/proxy.ts                  # Next.js 16 request proxy (replaces middleware.ts)
├── next.config.ts                # Next.js + Serwist + next-intl configuration
├── tsconfig.json                 # TypeScript configuration
├── package.json                  # Dependencies and scripts
├── postcss.config.mjs            # PostCSS (Tailwind) config
├── eslint.config.mjs             # Linting rules
├── components.json               # shadcn/ui configuration
├── Dockerfile                    # Multi-stage Docker build
├── docker-compose.yml            # Production deployment
├── docker-compose.dev.yml        # Development database
├── .env                          # Dev environment variables
├── .env.production.example       # DATABASE_URL template for the Docker quick start
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
| `src/app/(app)/analytics/page.tsx` | `/analytics` | Analytics charts |
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

**`output: "standalone"`**: During build, Next.js traces which files the server actually needs (which `node_modules`, which source files) and copies only those into `.next/standalone/`. This produces a ~20MB server instead of the full `node_modules` (~300MB+), keeping the Docker image lean.

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
  globalIgnores([
    ".next/**", "out/**", "build/**",
    "public/sw.js", "public/sw.js.map", // Serwist-generated, not hand-written
  ]),
]);
```

ESLint is a static analysis tool — it reads your code without running it and warns about potential problems (unused variables, accessibility issues, performance anti-patterns). `core-web-vitals` is Next.js's recommended rule set focused on web performance.

`public/sw.js` is excluded because it is auto-generated by Serwist (the PWA service worker library) during the build — linting generated code produces false positives and is not useful.

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

The database has **7 models** (tables) and **2 enums**:

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

#### CategoryBucket Enum

```prisma
enum CategoryBucket {
  NEEDS
  WANTS
  SAVINGS
}
```

This enum powers the **50·30·20 Budget Rule** feature. Each category can be assigned to one of three buckets that map to the personal finance rule-of-thumb: 50% of income on needs (rent, groceries, utilities), 30% on wants (dining out, entertainment), and 20% on savings/debt repayment.

**Bucket inheritance**: A category's effective bucket follows this chain — `category.bucket ?? category.parent?.bucket ?? null`. If a subcategory has no bucket set, it inherits the parent's bucket. This lets you assign a bucket once to a top-level category and have all its children participate automatically.

**`null` is valid** — Categories without a bucket assignment contribute to the `unclassified` total in the `BudgetSplit` component, which shows a warning if unclassified spending is significant.

#### Category (Hierarchical)

```prisma
model Category {
  id               String          @id @default(uuid())
  name             String                               // "Food", "Groceries"
  isActive         Boolean         @default(true)
  type             CategoryType    @default(EXPENSE)    // INCOME or EXPENSE
  parentId         String?                              // null = top-level
  excludeFromStats Boolean         @default(false)
  bucket           CategoryBucket?                      // NEEDS, WANTS, SAVINGS, or null
  icon             String?                              // Lucide icon name, e.g. "ShoppingCart"
  color            String?                              // Palette key, e.g. "emerald"
  parent           Category?       @relation("CategoryTree", fields: [parentId], references: [id])
  children         Category[]      @relation("CategoryTree")
  transactions     Transaction[]
  budgets          Budget[]
}
```

**Self-referencing relation** — A category can be a child of another category. `parentId` points to another row in the same table. This creates a tree structure:

```
Food (parentId: null, bucket: NEEDS)
├── Groceries (parentId: food.id, bucket: null → inherits NEEDS)
├── Restaurants (parentId: food.id, bucket: WANTS → overrides parent)
└── Coffee & Snacks (parentId: food.id, bucket: null → inherits NEEDS)
```

**Two-level limit** — Enforced in application code, not in the database. The API checks that you can't create a child of a child. This keeps the UI manageable.

#### Transaction

```prisma
model Transaction {
  id            String          @id @default(uuid())
  type          TransactionType                    // INCOME, EXPENSE, TRANSFER
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
- **TRANSFER**: An inter-account movement (e.g., moving money from checking to savings). TRANSFER transactions have no category and are excluded from all income/expense summaries and budget actuals. They still count toward account balances.

**CategoryType** (`INCOME` | `EXPENSE`) is a separate attribute on `Category`. It determines how transactions are routed in budget reports:
- An INCOME transaction in an EXPENSE category is a **contra-expense** (e.g., a health insurance reimbursement in the "Doctor" category reduces the net doctor expense — the reimbursement netting model).
- An EXPENSE transaction in an INCOME category is a **contra-income** (e.g., paying back a salary overpayment in the "Salary" category reduces the net income — the mirror of reimbursement netting).
- An INCOME transaction in an INCOME category is real income (e.g., Salary); an EXPENSE transaction in an EXPENSE category is real spending.
- Subcategories inherit their parent's CategoryType.

**Amount is always positive** — The `type` determines direction. An expense of €50 is stored as `amount: 50, type: EXPENSE`, not `amount: -50`. This avoids confusion and makes aggregation queries simpler.

**`friendlyName`** — An optional user-facing display name. Bank statement descriptions are often cryptic (e.g., "POS DEBIT 0042 LIDL"). The friendly name lets you rename it to something readable (e.g., "Groceries at Lidl"). When present, the UI displays `friendlyName` as the primary title and `description` as a secondary subtitle.

**`notes`** — Free-form text for longer annotations. Useful for recording context like "Birthday dinner with friends" or "Annual gym membership renewal".

**`importRef`** — A unique identifier for imported transactions (e.g., from a bank statement CSV). When importing, you can check if `importRef` already exists to avoid duplicates.

**`needsReview`** — A boolean flag for marking transactions that need attention later (pending refunds, split bills waiting for payback, suspicious charges). Defaults to `false`. Can be set during manual creation, editing, or import. The transaction list has a filter to show only flagged items, and transaction cards show an orange "Review" indicator when flagged.

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
  id                   String   @id @default("singleton")
  // Budget Split visibility — budgetSplitEnabled is the master switch; the
  // two "in*" flags only take effect while it's on.
  budgetSplitEnabled   Boolean  @default(true)
  budgetSplitInSummary Boolean  @default(true)
  budgetSplitInBudget  Boolean  @default(true)
  // Budget Split targets — how income should divide across the three
  // buckets. Default to the classic 50/30/20 rule; must sum to 100
  // whenever changed (enforced in updateSettingsSchema, not the schema).
  needsTarget          Int      @default(50)
  wantsTarget          Int      @default(30)
  savingsTarget        Int      @default(20)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}
```

**Singleton pattern** — There is only one row, always with `id = "singleton"`. The API uses `upsert` to auto-create it on first access. This avoids having global settings scattered across multiple tables.

**50·30·20 visibility flags** — `budgetSplitEnabled` is the master switch for the whole feature; `budgetSplitInSummary` and `budgetSplitInBudget` scope it to the Summary tabs and the Budget page respectively, but only take effect while the master switch is on (the AND-ing happens client-side in `useBudgetSplitVisibility`, not in these raw flags). All three default to `true` so existing installs see no behavior change. Updated via `PATCH /api/settings` (partial update, validated by `updateSettingsSchema` in `src/validators/settings.ts`) from the toggles in Settings > General; `GET /api/settings` returns them alongside the existing computed `transferBalance`/`nonTrackedBalance` figures. This is a stable extension point for further preferences — new fields can be added here without a schema redesign.

**Target percentages** — `needsTarget`, `wantsTarget`, and `savingsTarget` store the user-configurable Needs/Wants/Savings split that used to be hardcoded as 50/30/20. All three default to `50`, `30`, and `20` respectively, so existing installs keep today's behavior until someone changes them. Unlike the visibility flags above, they're interdependent rather than independent: `updateSettingsSchema` (`src/validators/settings.ts`) requires that if any one of the three is present in a `PATCH /api/settings` body, all three must be present, each between 1 and 98, and together summing to exactly 100 — a partial or unbalanced update is rejected before it ever reaches the database.

#### MatchType Enum

```prisma
enum MatchType {
  CONTAINS
  STARTS_WITH
  EXACT
  REGEX
}
```

Used by `CategoryRule` to describe how the pattern is applied to an imported transaction's description.

#### CategoryRule

```prisma
model CategoryRule {
  id           String    @id @default(uuid())
  pattern      String                          // Text to match, e.g. "LIDL"
  matchType    MatchType @default(CONTAINS)    // How to match the pattern
  priority     Int       @default(0)           // Higher = checked first
  isActive     Boolean   @default(true)        // Inactive rules are skipped
  categoryId   String
  friendlyName String?                         // Optional display name to auto-fill
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  category     Category  @relation(...)

  @@index([isActive])
  @@index([categoryId])
}
```

**Purpose** — Auto-categorization during bank statement import. When a transaction's description matches a rule, the import wizard pre-fills the category dropdown and optionally the display name field. The user can override any auto-filled value before confirming.

**Priority + tiebreak** — Rules are evaluated in descending priority order. When two rules have the same priority, the one created earlier wins (`createdAt ASC`). This is the order returned by `GET /api/category-rules`, so the client-side `matchRule()` function receives them pre-sorted and simply takes the first match.

**`friendlyName`** — If set, the rule also pre-fills the transaction's display name field during import. Useful for renaming cryptic bank descriptions (e.g., rule pattern `"LIDL"` with friendly name `"Lidl"` turns `"POS DEBIT 0042 LIDL"` into a readable label).

**Matching** — All match types are case-insensitive. `CONTAINS` / `STARTS_WITH` / `EXACT` lower-case both sides before comparing. `REGEX` uses the `i` flag. Invalid regex patterns fail silently (rule is skipped, no crash).

**Duplicates are skipped** — Rule matching is only applied to non-duplicate rows. Duplicate transactions are auto-unchecked and won't be imported, so matching them wastes computation.

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
3. Uses the migration user (which has DDL privileges)

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
├── transactions/
│   ├── route.ts          → GET (list + pagination), POST (create)
│   ├── [id]/route.ts     → GET, PUT, DELETE
│   └── export/route.ts   → GET (CSV download, same filters as list)
├── budgets/
│   ├── route.ts          → GET (list), POST (bulk upsert)
│   └── [year]/route.ts   → GET (budget vs actual)
├── import/
│   ├── check-duplicates/route.ts → POST (check importRefs for duplicates)
│   ├── execute/route.ts          → POST (bulk create transactions)
│   └── profiles/
│       ├── route.ts              → GET (list), POST (create)
│       └── [id]/route.ts        → DELETE (remove profile)
├── category-rules/
│   ├── route.ts          → GET (list, sorted by priority desc), POST (create)
│   └── [id]/route.ts     → PUT (update), DELETE (hard delete)
├── settings/
│   └── route.ts          → GET (read), PUT (update transfer category)
├── summary/
│   ├── monthly/route.ts  → GET (monthly breakdown)
│   └── annual/route.ts   → GET (yearly breakdown)
└── analytics/
    └── net-worth/route.ts → GET (net worth over time)
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
  ],
  "bucketBreakdown": {
    "NEEDS": 980.00,
    "WANTS": 430.50,
    "SAVINGS": 200.00,
    "unclassified": 240.00
  }
}
```

Both `categories` (expenses) and `incomeCategories` use the same hierarchical structure. Each category's `children` array now includes a `months: number[]` field (12-element array) alongside the existing `total`, enabling per-month drill-down for subcategories in the annual summary table.

#### `GET /api/transactions/export` — CSV Download

Accepts the same filter query params as `GET /api/transactions` (type, accountId, categoryId, startDate, endDate, search, needsReview) but fetches all matching rows without pagination and returns a `text/csv` file.

Split transactions are expanded to one row per split child — the exported data is flat and directly usable in spreadsheets and pivot tables. Category paths use `Parent > Child` notation.

The response includes a UTF-8 BOM (`\uFEFF`) so Excel auto-detects the encoding without any import wizard step. The `Content-Disposition` filename reflects any active date range: `transactions_2026-01-01_2026-03-31.csv`.

Columns: `Date, Type, Amount, Currency, Description, Category, Account, Notes`

**`bucketBreakdown`** — Totals broken down by `CategoryBucket` value, plus `unclassified` for expenses in categories that have no bucket assignment (including via parent inheritance). This field drives the `BudgetSplit` component's 50·30·20 view. The annual summary API returns the same `bucketBreakdown` field, but aggregated across the full year.

**Netting** — `totalIncome`, `totalExpense`, and `bucketBreakdown` all accumulate the same `CategoryType`-routed, netted amount used to build `categories`/`incomeCategories` (see "CategoryType Drives Budget Routing" above) — not the raw transaction amount. An INCOME transaction in an EXPENSE category (a reimbursement) reduces that category's expense total, `totalExpense`, and its bucket total together; it does not add to `totalIncome`. Symmetrically, an EXPENSE transaction in an INCOME category (a correction) reduces `totalIncome` and does not add to `totalExpense` or any bucket. This keeps `NEEDS + WANTS + SAVINGS + unclassified` always equal to `totalExpense`, and keeps every figure on the page reconciling with the category breakdown tables.

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

**Split transactions**: Split parents have no category of their own (`categoryId: null`). The API fetches top-level transactions with their split children included, then replaces each split parent with its children. This means each child's amount is attributed to its own category, so a single split transaction can contribute to multiple budget rows simultaneously.

**Reimbursement/correction netoff**: routing is driven by `Category.type`, not `Transaction.type` (see "CategoryType Drives Budget Routing" above). Income transactions assigned to an EXPENSE category (e.g. an insurance reimbursement categorised as "Health") are treated as contra-expenses: the expense `actual` = gross expenses − reimbursements in that category, giving the true out-of-pocket cost. Symmetrically, expense transactions assigned to an INCOME category (e.g. paying back a salary overpayment) are treated as contra-income: the income `actual` = gross income − corrections in that category. Either way, the netted-off transaction is excluded from the opposite tab so it is not double-counted.

**`plannedBucketBreakdown`** — The planned counterpart to the summary endpoints' `bucketBreakdown`: sums each active leaf EXPENSE category's *budgeted* amount (not actual spend) into `NEEDS`/`WANTS`/`SAVINGS`/`unclassified`, using the same effective-bucket inheritance (`category.bucket ?? category.parent?.bucket ?? null`). Drives the `BudgetSplit` component on the Budget page, compared against `income.totalBudgeted`. Only budgets on *active* leaf categories count, matching the universe used for `expense.totalBudgeted` — a budget left over on a category that's since been marked inactive (`isActive: false`) is excluded from both, so the two figures always reconcile.

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

#### `GET /api/analytics/net-worth` — Net Worth Over Time

Returns a time series of the user's total net worth — the sum of all account balances — sampled at each date a transaction occurred within the selected period.

**Query parameters**:
- `period` — `1m`, `3m`, `6m`, `1y` (default), or `all`

**Response shape**:
```typescript
{
  data: { date: string; netWorth: number }[];  // ISO date strings
  currency: { code: string; symbol: string } | null;
  currentNetWorth: number | null;
}
```

**Algorithm — event-driven, single-pass**

Rather than computing the balance for every calendar day (which produces thousands of data points and requires repeatedly scanning all transactions), the endpoint collects only the dates where at least one transaction occurred:

```typescript
// 1. Collect unique transaction dates within the period
const dateSet = new Set<string>();
allTransactions
  .filter(tx => format(new Date(tx.date), "yyyy-MM-dd") >= startDateStr)
  .forEach(tx => dateSet.add(format(new Date(tx.date), "yyyy-MM-dd")));

// 2. Sort the dates
const sortedDates = Array.from(dateSet).sort((a, b) => a.localeCompare(b));
```

Then a **single pass** through all transactions (sorted by date) maintains a running balance map — one entry per account — without re-scanning the full set for each target date:

```typescript
const runningBalance = new Map<string, number>(
  accounts.map((a) => [a.id, Number(a.initialBalance)])
);
let txIndex = 0;
for (const dateStr of sortedDates) {
  // Advance pointer until we've applied all transactions up to this date
  while (txIndex < allTransactions.length) {
    const tx = allTransactions[txIndex];
    const txDateStr = format(new Date(tx.date), "yyyy-MM-dd");
    if (txDateStr > dateStr) break;
    const current = runningBalance.get(tx.fromAccountId) ?? 0;
    const amount = Number(tx.amount);
    if (tx.type === "INCOME") runningBalance.set(tx.fromAccountId, current + amount);
    else if (tx.type === "EXPENSE") runningBalance.set(tx.fromAccountId, current - amount);
    txIndex++;
  }
  // Snapshot: convert all account balances to default currency and sum
  let totalNetWorth = 0;
  for (const account of accounts) {
    const balance = runningBalance.get(account.id) ?? 0;
    totalNetWorth += balance * fxRate(account.currency.code);
  }
  dataPoints.push({ date: dateStr, netWorth: totalNetWorth });
}
```

**Why event-driven?** A typical user has ~300 transaction dates per year. Day-by-day would produce 365 points for `1y`, all requiring the same computation. Event-driven produces the same chart shape with far fewer points.

**Why today's FX rate?** The `baseCurrencyAmount` field (set during CSV import) is not populated for manually-entered transactions. Using it would mix two different accuracy levels across the same chart. Applying today's rate consistently across all historical points is honest and matches how the dashboard balance is computed.

**`Period` type**: Exported from this route file (`src/app/api/analytics/net-worth/route.ts`) and re-used by the frontend components to keep the type definition in one place:

```typescript
export type Period = "1m" | "3m" | "6m" | "1y" | "all";
```

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
const form = useForm<CreateTransactionFormInput>({
  resolver: zodResolver(createTransactionSchema),
  defaultValues: { type: "EXPENSE", amount: undefined, date: "yyyy-MM-dd" },
});
```
The form uses `CreateTransactionFormInput` (`z.input<typeof createTransactionSchema>`) rather than `CreateTransactionInput` (`z.infer<>`). The distinction matters because `z.coerce.date()` has an input type of `unknown` — the HTML `<input type="date">` produces a string, not a `Date`. Using the pre-coercion (`z.input`) type keeps the form's TypeScript types consistent with what the DOM actually provides. The `zodResolver` then runs Zod's coercion (string → Date) on submit before calling `onSubmit`.

2. **Type tabs** — A 2-column tab bar (Expense / Income) lets users switch types. The form fields are the same for both types: amount, description, friendly name, notes, date, account, category, and a "Mark for review" checkbox.

3. **`inputMode="decimal"`** — On mobile, this opens the numeric keyboard with a decimal point instead of the full QWERTY keyboard.

4. **Category grouping** — Categories are displayed grouped by parent, with the format "Parent > Child" for clear hierarchy.

#### `TransactionCard` (`src/components/transactions/transaction-card.tsx`)

A single transaction display. Server component (no interactivity needed for display).

**Icon circle**: Uses the `CategoryIcon` component. If the transaction's category has an `icon` and `color` set, the circle shows that Lucide icon on the category's color background. For split transactions (multiple categories) or categories with no icon, it falls back to a type arrow: `ArrowDownLeft` on an emerald background for income, `ArrowUpRight` on a red background for expenses.

**Amount color**: Income amounts are emerald (`text-emerald-600 dark:text-emerald-400`). Expense amounts use the default foreground color — they are distinguished by the `−` sign and the red icon circle, not by text color. The `typeConfig` object separates `color` (used for the icon arrow color) from `amountColor` (used for the amount text) so both can be controlled independently.

**Needs Review indicator**: Transactions flagged for review show an orange "Review" indicator (with a `CircleDot` icon) next to the category name, using the same inline pattern as the amber "Uncategorized" warning.

**Display priority chain**: The card title uses `friendlyName?.trim() || description || subtitleText`. When a friendly name exists, the bank description shows as a secondary subtitle below it. The `.trim()` prevents whitespace-only friendly names from hiding the description.

#### `TransactionList` (`src/components/transactions/transaction-list.tsx`)

Groups transactions by date and displays them with search, filtering, and load-more pagination.

**Search matches description, display name, and amount**: The `search` query parameter is sent to `GET /api/transactions`. On the API side, if the search term parses as a valid positive number (accepting both dot `"20.01"` and comma `"20,01"` as decimal separators), an exact `amount` match is added as an additional OR condition alongside the description and friendlyName text search. Typing `"20,01"` in the search bar therefore returns all transactions whose description or display name contains that string, or whose amount equals `20.01`.

**Skeleton loading**: Shows placeholder rows on first mount before data arrives, giving immediate visual feedback.

**Sticky filter bar**: The filter bar has `position: sticky; top: 0` with `backdrop-blur-sm` so the frosted-glass bar stays anchored at the top as the user scrolls through a long transaction list.

**Active filter chips**: When a filter is active (e.g., account = "Main Checking"), a dismissable pill appears inline below the search bar. Tapping the `×` on a chip clears that individual filter without opening the filter panel. This gives users a clear visual of what's active and a quick way to remove it.

**Filter persistence**: Active filters are stored in the URL search parameters. Navigating away and returning to the transactions page restores the previous filter state.

**Date group headers**: Transactions are grouped by day. Each group header shows the date and the day's net total (total income minus total expenses for that day). This lets users quickly spot which days had significant net outflows.

**Load-more pagination**: Instead of previous/next page navigation, the list appends results to the existing list as the user taps "Load more". Accumulated results are kept in state. An end-of-list counter shows how many transactions are displayed vs the total matching the current filters.

**Date grouping logic**: The API returns a flat array. The component groups transactions into `Map<string, Transaction[]>` where the key is the formatted date (e.g., "Jan 15, 2026").

#### `DeleteTransactionButton` (`src/components/transactions/delete-transaction-button.tsx`)

A trash icon that opens a confirmation dialog before deleting.

**Why a confirmation dialog?** Deleting a transaction is destructive (hard-delete, not soft-delete). The dialog prevents accidental deletions from mistaken taps on mobile.

#### Duplicate Transaction

A `Copy` icon button in the edit page header navigates to `/transactions/new?from=<id>`. The new page (`transactions/new/page.tsx`) reads the `from` query param, fetches the source transaction from the database on the server, and passes its fields to `TransactionForm` as `initialData` — but **without** the `id`, so the form submits a POST (create) rather than a PUT (edit).

The date is reset to today because duplicating is most commonly used for a recurring expense that happened again, not to re-create a historical record. All other fields (type, amount, description, friendly name, notes, account, category, splits, exchange rate) are copied verbatim.

**`isEditing` flag**: `TransactionForm` derives create-vs-edit mode from `!!initialData?.id` (not `!!initialData`). This makes it possible to pass pre-filled `initialData` without an `id` and still get a POST — the key that makes duplicate work without duplicating form logic.

#### `CategoryIcon` (`src/components/ui/category-icon.tsx`)

A reusable icon circle component used in both `TransactionCard` and `DashboardContent`. Renders a Lucide icon inside a colored circle, or falls back to a type arrow when no icon/color is set.

```tsx
<CategoryIcon
  icon={transaction.category?.icon}    // e.g. "ShoppingCart" or null
  color={transaction.category?.color}  // e.g. "emerald" or null
  fallback={ArrowUpRight}              // shown when no icon set
  fallbackBg="bg-red-100 dark:bg-red-900/30"
  fallbackColor="text-red-600 dark:text-red-400"
  size="sm"   // "sm" = 32px circle, "md" (default) = 40px circle
/>
```

**Lookup chain**: Looks up `CATEGORY_ICONS[icon]` and `CATEGORY_COLORS.find(c => c.key === color)`. If found, renders the Lucide icon in white on the color background. Otherwise, renders the `fallback` icon with `fallbackBg` and `fallbackColor`.

**Split transactions**: Pass `undefined` for `icon` and `color` so split transactions always show the type arrow — they span multiple categories so no single icon is representative.

### Settings Components

#### `GeneralSettings` (`src/components/settings/general-settings.tsx`)

The app-wide preferences panel, accessible from Settings > General. Includes:

- **Budget Split** — a single card holding everything related to the feature. A master toggle (`budgetSplitEnabled`) plus three scoped sub-rows, indented under the master switch: "Show in Summary" (`budgetSplitInSummary`), "Show in Budget" (`budgetSplitInBudget`), and "Budget bucket colours" (a `localStorage`-only, per-device preference read by the Budget page's category rows — unrelated to `AppSettings`, just co-located here since it's meaningless without the feature it colour-codes). All three sub-rows render `disabled` (and visually dimmed) whenever the master switch is off, but keep their own last-set value rather than resetting, so turning the master switch back on restores whatever was previously chosen. The two `AppSettings`-backed toggles update optimistically, then `PATCH` `/api/settings` with just that one field; on a failed request the local state reverts so the switch never drifts from what's actually persisted.

  Below a divider in the same card sits **`UnclassifiedCategories`** (`src/components/settings/unclassified-categories.tsx`) — a collapsible list of active EXPENSE categories whose *effective* bucket is null, i.e. the same set that falls into `BudgetSplit`'s `unclassified` slice. Two different rules, matching how `effectiveBucket` actually resolves: a root category is listed only if it has no children (a root with children isn't meaningfully unclassified on its own — its bucket only matters as a fallback for children that don't set their own); a child category is listed only if *both* its own bucket and its parent's bucket are null, since a child with no bucket but a bucketed parent already counts toward that bucket. Renders nothing when the 50·30·20 feature is disabled.

  Also below the divider, **`BudgetSplitTargets`** (`src/components/settings/budget-split-targets.tsx`) renders the three target percentages as editable number inputs, with a live "X% allocated" indicator that turns red whenever the sum isn't exactly 100. Unlike the toggles above, the three values save together on an explicit click rather than instantly on change — the Save button only appears once a field has been touched, and only enables once the sum is exactly 100, since a partial save would leave the split inconsistent. This is also where the card's own title lives: what used to read "50·30·20 Budget Rule" is now simply **Budget Split** — the feature's identity no longer hardcodes a ratio now that it's configurable, though 50/30/20 remains what a fresh install defaults to. Everywhere else in the app that displays the literal split — the Summary tab labels, the Budget page's planned-allocation heading, and this same card's own sub-row descriptions — now interpolates these three live values instead of a hardcoded string.
- **Transfer Balance** — the total volume of all TRANSFER-type transactions for the current data set. This is an informational figure (not a net balance) — since each transfer side is recorded independently, the number tells you how much money has been moved between accounts in total.
- **Non-tracked Balance** — the combined balance of all categories with `excludeFromStats: true` (configured per-category in Settings > Categories, and not specific to any one use case — the toggle itself is described generally as "Transactions won't appear in summaries or budgets"). The description text frames the €0-when-settled expectation as conditional ("if you're using this to track money spent on behalf of others...") rather than a blanket claim, since the flag is a general-purpose exclusion mechanism, not specific to that one scenario. Below it sits **`NonTrackedCategories`** (`src/components/settings/non-tracked-categories.tsx`), listing those same categories. Unlike the bucket rule above, `excludeFromStats` has no parent/child inheritance (see `getExcludedCategoryIds` in `src/lib/settings.ts` — it reads the flag straight off each category, never the parent), so the rule here is simply "list any active category whose own flag is set," no matter its type or whether it has children.

  Kept as two separate cards deliberately — Transfer Balance and Non-tracked Balance are unrelated concepts that happen to share the same `BalanceIndicator` layout, not sub-features of one another. That sub-component takes an explicit `label` prop per caller ("Total Transferred" / "Non-tracked Total") rather than a shared hardcoded string — a mislabeled shared string previously made the Non-tracked box display "Total Transferred" too.

  `UnclassifiedCategories` and `NonTrackedCategories` both share one presentational component, **`CollapsibleCategoryList`** (`src/components/settings/collapsible-category-list.tsx`) — collapsed by default with a count badge or a checkmark when nothing needs attention, expanded rows grouped under their parent's name and linking to Settings > Categories. Each caller owns its own data-fetching and row-selection rule; the shared piece only renders the disclosure.

This is a client component that fetches settings on mount via `GET /api/settings`, which computes both balances server-side.

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

**Header integration**: `SimpleSettingsList` accepts `pageTitle` and `pageDescription` props and renders its own page header row (title on left, "Add" button on right) at the top. The pages that use it do not render a separate `PageHeader` component. This keeps the Add button state co-located with the list data it refreshes after creation.

#### `SettingsItemForm` — Reusable Sheet Form

A bottom-sheet (drawer) form that works for both creating and editing items. It determines POST vs PUT based on whether `itemId` is provided:

```typescript
const method = itemId ? "PUT" : "POST";
const url = itemId ? `${apiEndpoint}/${itemId}` : apiEndpoint;
```

**Bottom sheets** (`Sheet` from shadcn/ui) are a mobile-first pattern. They slide up from the bottom of the screen, which is within thumb reach on phones. They're more natural than modals (which appear in the center) on mobile devices.

#### `CategoryTree` — Hierarchical Category Management

Displays categories in a collapsible tree. Each row is intentionally minimal — the list stays scannable, and editing happens in a focused bottom sheet.

**Row anatomy**: Parent rows show `[▶/▼ expand] [icon circle] Name (N active children) [+ add child]`. Child rows show `[icon circle] Name [status badges]`. Only the icon circle is a tap target that opens the edit sheet; the expand chevron is a separate button. This avoids the 300ms tap delay that `onClick` on a `<div>` has on mobile — proper `<button>` elements fire immediately.

**Edit sheet (`CategoryEditSheet`)**: A bottom sheet containing all settings for a category in one place:
- Name text input
- Color swatches (12 predefined palette colors)
- Icon grid (≈60 curated Lucide icons, grouped by section: Food, Transport, Home, etc.)
- Bucket selector (NEEDS / WANTS / SAVINGS) with full label descriptions
- Active and Exclude from Stats checkboxes

All changes are staged locally; a single "Save" button commits them via `PUT /api/categories/:id`. The footer also has a **Delete category** button (destructive, with a confirmation dialog) that calls `DELETE /api/categories/:id`.

**Icon and color system**: Stored as `icon` (Lucide icon name string, e.g. `"ShoppingCart"`) and `color` (palette key, e.g. `"emerald"`). The constants live in `src/lib/category-icons.ts`:
- `CATEGORY_ICONS` — `Record<string, LucideIcon>` mapping name → component
- `CATEGORY_COLORS` — Array of `{ key, bg }` with full literal Tailwind class strings (e.g. `bg-emerald-500`). Full literals are required so Tailwind's build-time class detection never purges them.
- `ICON_GROUPS` — Same icons organized into labeled sections for the picker grid

**State management**: The component tracks which parent categories are expanded using a `Set<string>` of expanded IDs. Clicking the chevron toggles membership in the set.

**Safe child lookup**: When opening the edit sheet for a child category, the component looks up the full category from the flat `categories` array rather than using the nested `parent.children[i]` object. Prisma's nested includes only fetch one level of children — the child objects don't have their own `children` array, so using them directly would crash on `category.children.length`.

**Deleting a category**: `DELETE /api/categories/:id` hard-deletes the category — unlike accounts, categories have no `isActive`-based soft-delete for removal (the `isActive` checkbox in the edit sheet is a separate "hide from pickers" toggle, not a delete mechanism). The endpoint blocks deletion entirely with `409 CONSTRAINT_ERROR` if the category or any of its children still has transactions. Deleting a parent cascades to delete all of its children, plus any `Budget` and `CategoryRule` rows referencing the category or its children, in a single transaction. The three system Transfer categories are protected and always return `403 FORBIDDEN`.

**Header integration**: `CategoryTree` accepts `pageTitle` and `pageDescription` props and renders its own page header row (title on the left, "Add" button on the right) at the top of the component. This keeps the Add button co-located with the data state it depends on, while placing it visually alongside the page title.

#### `AccountList` — Account Management

Fetches three endpoints in parallel (accounts, currencies, account types) because the form needs all three to populate dropdown options:

```typescript
const [accountsRes, currenciesRes, typesRes] = await Promise.all([
  fetch("/api/accounts?all=true"),
  fetch("/api/currencies"),
  fetch("/api/account-types"),
]);
```

Like `SimpleSettingsList` and `CategoryTree`, `AccountList` accepts `pageTitle` and `pageDescription` props and renders its own header row with the "Add" button alongside the title.

#### `CategoryRulesList` (`src/components/settings/category-rules-list.tsx`)

The auto-categorization rules management page, accessible from Settings > Auto-Categorization. It is a custom client component (rather than `SimpleSettingsList`) because the category select needs hierarchical grouped options that the generic field system doesn't support.

**Layout**: Each rule is displayed as a card row showing:
- Pattern in monospace font
- Match type badge (`Contains`, `Starts with`, `Exact`, `Regex`)
- Arrow + category name (formatted as "Parent › Child" for subcategories)
- Priority badge (`P2`, `P5`, …) when priority > 0
- Edit and Delete action buttons
- Dimmed (50% opacity) when `isActive = false`

**Add/Edit form**: A bottom sheet (`RuleForm`) with fields in this order:
1. **Pattern** — the text to match (monospace input)
2. **Match Type** — select with descriptions for each option
3. **Category** — hierarchical grouped select (same pattern as the transaction form)
4. **Display Name** (optional) — pre-filled in the import wizard when this rule matches
5. **Priority** — number input, default 0; higher number = checked first
6. **Active** — checkbox toggle; inactive rules are skipped during import

**Delete**: Hard delete via `DELETE /api/category-rules/:id`. Rules have no soft-delete — they're not referenced by transactions, so deletion is safe.

### Import Components

The bank statement import feature lives in `src/components/import/` and uses a multi-step wizard pattern.

#### `ImportWizard` — State Machine

Manages the import flow through 4 steps: Upload → Column Mapping → Review → Confirm. All state is lifted into a single `ImportState` object that's passed down to each step. The wizard doesn't use URL-based state — it's all in React state, so refreshing the page resets the import.

#### `StepUpload` — File Parsing

Accepts CSV and Excel files (`.csv`, `.xlsx`, `.xls`). Uses **PapaParse** for CSV parsing and **read-excel-file** for Excel. Supports saved import profiles that remember column mapping, delimiter, skip rows, and date format settings from previous imports of the same bank format.

#### `StepColumnMapping` — Column Assignment

Presents dropdowns to map CSV/Excel columns to transaction fields (date, description, amount, etc.). Supports two amount modes: single column (positive/negative) or split columns (debit + credit). Includes a data preview table and profile save/load functionality.

#### `StepReview` — Transaction Preview

Shows all parsed transactions with checkboxes, category dropdowns, type toggles (Income/Expense), inline friendly name and notes inputs, and a per-row "Review" checkbox to flag imported transactions for later review. On mount, it runs several async steps in sequence:

1. Parses dates and amounts, generating an `importRef` hash per row (Web Crypto API)
2. Fetches categories and auto-categorization rules in parallel
3. Checks for duplicates via the API; duplicate rows are auto-unchecked and badged with "Duplicate"
4. Applies `matchRule()` to each non-duplicate row; matching rows have their category and display name pre-filled and get an "Auto" badge in the date header line

The "Auto" badge disappears when the user manually changes the category dropdown, signalling the value is no longer from a rule.

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

**"This month" / "This year" shortcut**: When the selected period is not the current one, a small pill button appears next to the navigation arrows letting the user jump back to the current period in one tap. The pill is hidden when already viewing the current period, keeping the UI clean.

#### `SummaryNav` (`src/components/summary/summary-nav.tsx`)

A segmented Monthly/Annual toggle rendered at the top of every summary page. It is a **Server Component** — there is no interactivity needed, just two `Link` elements styled as a pill toggle. The active tab is determined by the current pathname.

```tsx
// Server Component — no "use client" needed
<SummaryNav active="monthly" />
```

Using a Server Component here means zero JavaScript is shipped to the browser for this navigation element. The styling uses the active variant to highlight the current tab (`bg-background shadow-sm` on the active pill, muted on inactive).

#### Expenses / Income / 50·30·20 Tabs

Both the monthly and annual summaries use a three-tab interface:
- **Expenses tab** — Category breakdown for expense transactions
- **Income tab** — Category breakdown for income transactions
- **50·30·20 tab** — `BudgetSplit` component showing spending against the budget rule

In the annual summary, the active tab also controls the `AnnualCategoryTable` (which category set is shown) and which category is selectable for drill-down in the chart above.

#### `CategoryBreakdown` (`src/components/summary/category-breakdown.tsx`)

A single `Card` containing a list of category rows. Replaces the previous pie chart as the primary expense/income visualization in the monthly summary. Each row shows:
- A colored left border (from a fixed `PALETTE` array, indexed by position)
- The category name
- The absolute total amount
- A thin horizontal progress bar showing the category's share of the total
- Percentage text

Child categories are nested and indented under their parent. Percentages are computed client-side:

```typescript
const percentage = total > 0 ? (category.total / total) * 100 : 0;
```

Used in both tabs: expense tab passes `total={totalExpense}`, income tab passes `total={totalIncome}`. The colored left border uses the same `PALETTE` index consistently so the same category always gets the same color within the list, making it easy to visually track categories across months.

#### `AnnualCategoryTable` (`src/components/summary/annual-category-table.tsx`)

A table with 14 columns: Category (sticky), Total, and 12 months. On mobile, this scrolls horizontally with the category column staying fixed (CSS `sticky`). Used in both the expense and income tabs of the annual summary.

**`sticky` positioning** — The first column has `position: sticky; left: 0`. As you scroll horizontally, it "sticks" to the left edge. This is essential on mobile where the table is wider than the screen.

**Clickable rows for chart drill-down**: Rows are interactive. Clicking a category row highlights it (selected state with a distinct background) and updates the `AnnualBarChart` above to show that category's monthly spending as a single blue line. Clicking the selected row again, or switching tabs, resets the chart back to the overview mode (income vs expense lines). Subcategory rows are also selectable for the chart.

The selected category name appears in the chart card's title with a "← Overview" reset button alongside it.

**Subcategory expand/collapse**: Category rows that have subcategories show a `ChevronRight` / `ChevronDown` icon on the left of the name. Clicking the chevron expands the row to reveal indented child rows, each with their own annual total and 12-month breakdown. Chevron clicks use `stopPropagation` so they don't also trigger chart selection. Expanded state is tracked in a local `Set<string>` via `useState`. Each child row is also selectable for the chart — the `selectedCategoryData` resolver in `AnnualSummaryContent` searches both parent and child categories when resolving monthly data for the chart.

#### `MonthlySummaryContent` (`src/components/summary/monthly-summary-content.tsx`)

The client component that owns all monthly summary state and rendering. Fetches the current month and the **previous month in parallel** so it can compute deltas for the stat cards.

**Stat card layout** — A 2+1 grid: Income and Expenses side by side in `grid-cols-2`, then Net full-width below. Cards use `Card className="py-0"` + `CardContent className="p-3"` to override shadcn's default `py-6` padding and keep cards compact on mobile.

**Inline deltas** — Income and Expenses cards show a compact `↑5%` or `↓3%` indicator in the top-right corner, comparing the current month to the previous month. The Net card shows the full absolute delta: "↑ €120.00 vs Jan", providing context for how this month compares to the previous one.

**Three tabs** — Expenses, Income, and 50·30·20. The first two tabs render `CategoryBreakdown` with the appropriate data. The 50·30·20 tab renders `BudgetSplit`.

**Skeleton loading** — Skeleton elements match the actual layout shape (same grid, same card sizes) to minimize layout shift when data loads.

#### `AnnualSummaryContent` (`src/components/summary/annual-summary-content.tsx`)

The client component for the annual summary. Uses the same 2+1 stat card layout as monthly. The bar chart is always visible above the tabs (since it shows aggregate data), while the tabs control which category set is displayed in `AnnualCategoryTable` below.

**Chart card styling** — The chart title uses `text-[10px] font-semibold uppercase tracking-wide text-muted-foreground` — a small uppercase label style consistent with stat card labels. The chart div uses `-mx-3` to allow the `ResponsiveContainer` to fill the full card width while the card still has padding for the title and legend.

**`maxMonth` prop** — For the current year, only months up to the current calendar month are shown (no future zero-value months). For past years, all 12 months are shown.

**Three tabs** — Expenses, Income, and 50·30·20. Selecting a row in `AnnualCategoryTable` (available in Expenses and Income tabs) drives the chart into category detail mode.

#### `BudgetSplit` (`src/components/summary/budget-split.tsx`)

The 50·30·20 Budget Rule visualization. Rendered in the third tab of both monthly and annual summaries (actual spending vs. actual income), and in a standalone card on the Budget page (planned budget vs. budgeted income) — same component, different data, in all three places.

Displays:
- **Total readout + stacked bar** — one bar, 100% = income. Segments show each bucket's share of income, in priority order (Needs, then Wants, then Savings, then unclassified) — a bucket only gets whatever room is left after the ones before it, deliberately: Needs is essential spending and should visually "win" the available space over discretionary buckets when you're over budget, rather than all three shrinking proportionally. A text readout above the bar always states the total ("68% of income spent"), and turns red with the €-over figure ("115% of income spent — €5,400 over") plus a red-tinted track when total spending exceeds income — the segment shapes alone can't be trusted to show that once one bucket has consumed all the remaining room.
- **Target markers** — three thin vertical lines under the bar at the configured cumulative boundaries (`needsTarget`, `needsTarget + wantsTarget`, and always 100%), colour-matched to their segment (blue/amber/emerald) so the ideal split reads at a glance.
- **Three stat cards** — NEEDS, WANTS, SAVINGS. Each shows the actual amount, its % of income, an On track/Review/Off track badge, and a target-relative progress bar (`min(actual/target, 1) * 100`, i.e. a full bar means you've hit your target — not "double your target," which an earlier version of this formula used). The bar and badge turn red together when off target; for Savings specifically, "off target" means falling *short* of the 20% floor, not exceeding it, so the red condition is inverted relative to Needs/Wants. When off target, the percentage line also grows a currency figure ("+15.0% — €5,400.00 over" / "15.0% — €5,400.00 short"), matching the top bar's phrasing.
- **Unclassified warning** — If any expenses fall into categories with no bucket assignment, a warning badge shows the unclassified total and prompts the user to assign buckets in Settings > Categories.

```tsx
<BudgetSplit
  breakdown={{ NEEDS: 980, WANTS: 430, SAVINGS: 200, unclassified: 240 }}
  totalIncome={3500}
/>
```

**Visibility** — Gated by `useBudgetSplitVisibility()` (`src/hooks/use-budget-split-visibility.ts`), which reads the `budgetSplitEnabled`/`budgetSplitInSummary`/`budgetSplitInBudget` flags on `AppSettings` (see below) and returns `{ showInSummary, showInBudget }` — each already ANDed with the master switch. When a surface is hidden, its `TabsTrigger`/`TabsContent` pair (or, on the Budget page, the whole card) is omitted from the tree entirely, not just visually hidden, and the summary tab grid collapses from 4 to 3 columns.

### Dashboard Component

#### `DashboardContent` (`src/components/dashboard/dashboard-content.tsx`)

A fully redesigned home screen that fetches three APIs in parallel (balances, monthly summary, recent transactions) and renders:

1. **Greeting header** — Time-of-day message ("Good morning, Fabio") plus today's date. Replaces the generic `PageHeader`. The header also contains two action buttons:
   - A `TrendingUp` icon button (ghost, icon-only) that links to `/analytics`
   - An "Add" outline button that links to `/transactions/new`
2. **Hero card** — A dark gradient card showing total net worth across all accounts in the primary currency. Gives users the one number they care about at a glance.
3. **Account strip** — A horizontally scrollable list of account cards, edge-to-edge (`-mx-4 px-4`) with the scrollbar hidden. Each card shows the account name, balance, and currency. On mobile, users swipe to see more accounts without leaving the dashboard.
4. **Spending meter** — A progress bar showing current month's expenses as a percentage of income. Color shifts from emerald (healthy) → amber (warning at ~75%) → red (over budget) based on the spend percentage.
5. **Recent transactions** — Last 5 transactions in a compact format: a `CategoryIcon` circle (same icon/color system as the Transactions page), description, amount, account name, and a relative date label ("Today", "Yesterday", "Mar 5"). Income amounts are emerald; expense amounts use the default foreground color. Tapping navigates to the full transaction detail page.

Skeleton loading states are shown for all sections while data is fetching, matching the shape of the actual content to reduce layout shift.

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

### Analytics Components

#### `NetWorthChart` (`src/components/analytics/net-worth-chart.tsx`)

A client component that renders the "Net Worth" (Patrimônio Líquido) area chart. On mount and whenever the selected period changes, it fetches from `/api/analytics/net-worth?period=<value>` and renders a Recharts `AreaChart` with an amber gradient fill.

**Hero value**: Above the chart, the card displays the current net worth as a large headline figure plus a delta line — `+€1,200 (+5.3%)` in emerald for growth, `−€300 (−1.2%)` in red for decline — comparing the last data point to the first within the selected period.

**Skeleton states**: While loading, the hero value area shows two `Skeleton` blocks matching the shape of the headline and delta. The chart area shows a full-width skeleton rectangle.

**Cancellation pattern**: The `useEffect` sets a `cancelled` flag in its cleanup function. If the component unmounts (e.g., the user navigates away) while a fetch is in flight, the `cancelled` check prevents calling `setState` on an unmounted component:

```typescript
useEffect(() => {
  let cancelled = false;
  async function fetchData() {
    try {
      const json = await fetch(...).then(r => r.json());
      if (!cancelled) setResponse(json);  // skipped if unmounted
    } catch {
      if (!cancelled) setHasError(true);
    }
  }
  fetchData();
  return () => { cancelled = true; };
}, [period]);
```

**SVG color constraint**: Recharts renders axis ticks as SVG `<text>` elements with `fill="..."` attributes. SVG presentation attributes do not process CSS custom properties — writing `fill="hsl(var(--muted-foreground))"` renders as a literal string (invisible or black). The fix is to read the resolved theme via `useTheme()` and map it to explicit HSL values:

```typescript
const { resolvedTheme } = useTheme();
const isDark = resolvedTheme === "dark";
const axisColor = isDark ? "hsl(240, 5%, 55%)" : "hsl(240, 5%, 45%)";
```

**X-axis tick interval**: With ~300 transaction dates per year, showing every tick would create an unreadable label overlap. The interval is computed to target roughly 6 visible labels:
```typescript
const tickInterval = Math.max(1, Math.floor(data.length / 6));
```

**Tooltip**: Rendered as an HTML `<div>` via `contentStyle`, so CSS custom properties work correctly for border and background colors. The `formatter` callback converts the raw number to a locale-aware currency string.

#### `PeriodSelector` (`src/components/analytics/period-selector.tsx`)

A reusable row of pill buttons for selecting a time period: `1M`, `3M`, `6M`, `1Y`, `ALL`. The active period gets a solid amber background; inactive periods use the muted background with hover state. Used by `NetWorthChart` and designed for reuse by future chart components.

The `Period` type is imported from the API route (`src/app/api/analytics/net-worth/route.ts`) and re-exported, keeping the type definition in one authoritative place:

```typescript
import type { Period } from "@/app/api/analytics/net-worth/route";
export type { Period };
```

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

All formatters accept an optional `locale` parameter (`"en"` or `"pt"`) passed in from components via `useLocale()`. This makes number and date presentation match the user's chosen language.

```typescript
// Full currency with symbol, locale-aware separators
formatCurrency(1234.56, "EUR", "en")  // → "€1,234.56"
formatCurrency(1234.56, "EUR", "pt")  // → "1.234,56 €"

// Amount only — use when only the symbol string is available (not the ISO code)
formatAmount(1234.56, "en")  // → "1,234.56"
formatAmount(1234.56, "pt")  // → "1.234,56"

// Percentage without the % sign (caller appends it via a translation key)
formatPercent(89.5, 1, "en")  // → "89.5"
formatPercent(89.5, 1, "pt")  // → "89,5"

// Dates via date-fns locale objects
formatDate("2026-01-15", "d MMM yyyy", "en")  // → "15 Jan 2026"
formatDate("2026-01-15", "d MMM yyyy", "pt")  // → "15 jan. 2026"
```

**`Intl.NumberFormat`** is a browser/Node built-in for locale-aware number formatting. Given `currencyCode: "EUR"`, it automatically applies the correct symbol and decimal placement. The `locale` param maps `"en"` → `"en-US"` and `"pt"` → `"pt-PT"` for BCP 47 tag compatibility.

**Why accept `string | number`?** Prisma returns Decimal fields as strings (to preserve precision). JSON doesn't have a Decimal type, so `"1234.56"` arrives as a string. The formatter handles both.

**`formatDate` guard**: If `parseISO()` produces an invalid `Date` object (e.g. from a malformed import row), the function checks `isNaN(dateObj.getTime())` and returns the raw string instead of throwing a `RangeError`.

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

**Dark mode chart colors** — SVG presentation attributes (`fill`, `stroke`) do **not** process CSS custom properties. See the [Theme-Aware Recharts Colors pattern](#theme-aware-recharts-colors) in Section 17 for the correct technique.

### Annual Line Chart (`annual-bar-chart.tsx`)

Despite the filename, this component is now a `LineChart` (rewritten from `BarChart`). It operates in two modes:

**Overview mode** (default): Two lines — income (emerald) and expenses (red) — plotted monthly across the year:

```tsx
<LineChart data={data}>
  <XAxis dataKey="month" tick={{ fill: axisColor }} />
  <YAxis orientation="right" tick={{ fill: axisColor }} />
  <Line dataKey="income" stroke="#22c55e" />
  <Line dataKey="expense" stroke="#ef4444" />
</LineChart>
```

**Category detail mode**: A single blue line showing the selected category's monthly spending. Activated when the user clicks a row in `AnnualCategoryTable`. The chart title updates to show the category name with a "← Overview" reset button.

**Y-axis on the right** (`orientation="right"`) — Moving the Y-axis to the right aligns the plot area's left edge flush with the card title text, giving a cleaner visual alignment.

**`maxMonth` prop** — Slices the data array to the current month for the current year, so future months with zero values don't appear as a flat trailing line.

**`margin={{ left: 14 }}`** — Prevents the first X-axis label from being clipped by the SVG boundary.

### Net Worth Area Chart (`net-worth-chart.tsx`)

The analytics page uses a Recharts `AreaChart` to display net worth over time. It combines a gradient fill with a solid amber stroke line:

```tsx
<AreaChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 8 }}>
  <defs>
    <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
    </linearGradient>
  </defs>
  <XAxis
    dataKey="date"
    tickFormatter={(v) => formatXTick(v, period)}
    tick={tickProps}
    tickLine={false}
    axisLine={false}
    interval={tickInterval}
  />
  <YAxis
    orientation="right"
    tick={tickProps}
    tickLine={false}
    axisLine={false}
    width={40}
    tickFormatter={formatYTick}
  />
  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={...} labelFormatter={...} />
  <Area
    type="monotone"
    dataKey="netWorth"
    stroke="#f59e0b"
    strokeWidth={2}
    fill="url(#netWorthGradient)"
    dot={false}
    activeDot={{ r: 4, fill: "#f59e0b" }}
  />
</AreaChart>
```

**`linearGradient`** — Defined in a `<defs>` block inside the SVG. The `id` (`netWorthGradient`) is referenced by `fill="url(#netWorthGradient)"` on the `Area`. The gradient fades from 30% opacity amber at the top to fully transparent at the bottom, creating depth under the line without obscuring the x-axis.

**`type="monotone"`** — Recharts' curve interpolation. `monotone` ensures the line never goes above the highest point or below the lowest between two data points. It's visually smooth without creating artificial peaks/valleys (as `basis` or `cardinal` might).

**`dot={false}`** — Individual dots on every data point are disabled. With 300+ points for a 1-year view, dots would form a solid band. The `activeDot` (shown only on hover) gives precise point-on-hover feedback without visual clutter.

**Y-axis compact formatting** — Raw monetary values (e.g., `1234567`) would overflow the 40px Y-axis width. A formatter compacts them:
```typescript
function formatYTick(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(Math.round(v));
}
```

**X-axis tick format by period** — Shorter periods show day+month (`5 Mar`); longer periods abbreviate to month-only (`Mar`) or month+year (`Mar 26`) to prevent label overlap:
```typescript
function formatXTick(dateStr: string, period: Period): string {
  const date = parseISO(dateStr);
  switch (period) {
    case "1m": case "3m": return format(date, "d MMM");
    case "6m": case "1y": return format(date, "MMM");
    case "all": return format(date, "MMM yy");
  }
}
```

**Recharts v3 `labelFormatter` type**: In Recharts v3, the tooltip's `label` argument is typed as `ReactNode`, not `string`. Passing it to `parseISO` requires an explicit cast: `parseISO(String(label))`. The `labelFormatter` is typed `(label: unknown)` to match this reality.

### Theme-Aware Colors in Recharts

See the dedicated pattern in [Section 17](#theme-aware-recharts-colors).

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
    name: "Ouriva",
    short_name: "Ouriva",
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
    title: "Ouriva",          // Name under the icon
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

## 15. Internationalisation (i18n)

### Overview

The app supports two locales: **English** (`en`, default) and **Portuguese** (`pt`). The active locale is stored in a browser cookie (`NEXT_LOCALE`) and read on every server render. No URL changes — `/dashboard` is `/dashboard` in both locales.

### How next-intl Works

**Message files** (`messages/en.json`, `messages/pt.json`) hold all UI strings, grouped by feature namespace:

```json
{
  "dashboard": {
    "goodMorning": "Good morning",
    "netWorth": "Net Worth"
  },
  "transactions": {
    "pageTitle": "Transactions"
  }
}
```

**`src/i18n/routing.ts`** declares the locales and strategy:

```typescript
export const routing = defineRouting({
  locales: ["en", "pt"],
  defaultLocale: "en",
  localePrefix: "never",   // no /en/ prefix — URLs unchanged
  localeCookie: true,      // read/write NEXT_LOCALE cookie
});
```

**`src/i18n/request.ts`** resolves the locale on the server for every request. It reads the `NEXT_LOCALE` cookie directly (bypassing middleware) and loads the matching message file:

```typescript
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const locale = cookieLocale && routing.locales.includes(cookieLocale)
    ? cookieLocale
    : routing.defaultLocale;
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});
```

**`src/app/layout.tsx`** wraps the entire app in `NextIntlClientProvider`, which distributes the messages to every client component in the tree:

```tsx
const locale = await getLocale();
const messages = await getMessages();

return (
  <html lang={locale}>
    <body>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </body>
  </html>
);
```

### Using Translations in Components

**Client components** use the `useTranslations()` hook:

```tsx
"use client";
import { useTranslations, useLocale } from "next-intl";

export function DashboardContent() {
  const t = useTranslations("dashboard");
  const locale = useLocale();

  return <h1>{t("goodMorning")}</h1>;
  // → "Good morning" (en) or "Bom dia" (pt)
}
```

**Server components and pages** use the async `getTranslations()`:

```tsx
import { getTranslations } from "next-intl/server";

export default async function SummaryPage() {
  const t = await getTranslations("nav");
  return <PageHeader title={t("summary")} />;
}
```

**Interpolated values** (e.g. amounts, counts) use named placeholders:

```json
// messages/en.json
"pctSpent": "{pct}% spent",
"saved": "+{symbol}{amount} saved"
```
```tsx
t("pctSpent", { pct: formatPercent(spentPct, 0, locale) })
t("saved", { symbol: "€", amount: formatAmount(net, locale) })
```

**Arrays** (e.g. month names) are retrieved with `t.raw()`:

```tsx
const monthNames = t.raw("fullMonthNames") as string[];
// → ["January", ...] or ["Janeiro", ...]
```

### Switching Languages

The language picker in **Settings › General** writes the `NEXT_LOCALE` cookie and reloads the page:

```typescript
function handleLocaleChange(newLocale: string) {
  document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
  window.location.reload();
}
```

The `max-age` is one year, so the preference persists across sessions without any database storage.

### Why No URL Prefix?

Standard i18n routes the locale through the URL: `/en/dashboard`, `/pt/dashboard`. This is incompatible with a PWA because:
- The service worker caches `/dashboard` — changing the URL breaks the cache
- The app is installed to the home screen pointing at `/dashboard`
- Changing the installed URL requires the user to reinstall

The cookie-based approach avoids all of this while still serving the correct locale to every request.

### Next.js 16 Proxy

Next.js 16 renamed `middleware.ts` to `proxy.ts` and the exported function from `middleware` to `proxy`. The file lives at `src/proxy.ts` and is a passthrough — locale detection happens entirely in `request.ts` via the cookie, so no middleware logic is needed:

```typescript
export function proxy(request: NextRequest) {
  return NextResponse.next();
}
export const config = { matcher: ["/((?!api|_next|.*\\..*).*)"] };
```

---

## 16. Docker and Deployment

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
    container_name: ouriva-db
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: personal_finance_dev
      POSTGRES_USER: budget_app_dev
      POSTGRES_PASSWORD: dev_password_change_me
    volumes:
      - ouriva_dev_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U budget_app_dev -d personal_finance_dev"]
```

**Named volume** (`ouriva_dev_data`) — Data persists across container restarts. `docker compose down` keeps the volume; `docker compose down -v` deletes it.

**`docker-compose.yml`** — Production deployment:

```yaml
services:
  app:
    image: ouriva:latest
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}  # From .env on the server
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://127.0.0.1:3000/"]
```

**`${DATABASE_URL}`** — Docker Compose reads `.env` from the same directory. The `${}` syntax substitutes the value. This keeps credentials out of the compose file.

**`restart: unless-stopped`** — Restarts the container automatically if it crashes or the server reboots. It only stays stopped if you explicitly `docker compose down`.

**Health check** — Docker periodically hits `http://127.0.0.1:3000/` to verify the app is responsive. If 3 checks fail, Docker marks the container as unhealthy. Uses `127.0.0.1` instead of `localhost` because Alpine's DNS resolves `localhost` to IPv6 (`::1`), but Node.js listens on IPv4.

---

## 17. Key Design Decisions

### Amounts Are Always Positive

Storing `-50` for expenses creates confusion: does negative mean expense or refund? Instead, `amount` is always positive and `type` determines direction. Aggregation queries become simpler:

```sql
SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) AS total_income
SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) AS total_expense
```

### TRANSFER as a First-Class Transaction Type

Transfers between accounts are recorded as `type: TRANSFER` transactions — a dedicated enum value alongside INCOME and EXPENSE. TRANSFER transactions:
- Have no category (the field is nullable and ignored by the UI)
- Are excluded from all income/expense summaries, budget actuals, and monthly/annual reports
- Still count toward account balances (they represent real money movement)
- Are shown in a dedicated Transfer tab in the transaction list

**Why a proper type instead of a "transfer category"?** The previous approach used a configurable category to tag transfers. This had several problems: the category appeared in category dropdowns, budget reports needed to know which category to exclude, and the configuration was easy to lose. A dedicated enum value is explicit, non-configurable, and requires no special-case logic scattered across the codebase.

**Single-entry model** — Users record each side of a transfer independently (one TRANSFER transaction per account involved). This matches how bank CSVs represent transfers and keeps the data model simple. The Transfer Balance in Settings > General shows the total volume moved (not a net figure).

### CategoryType Drives Budget Routing

Each `Category` has a `type: CategoryType` field (`INCOME` | `EXPENSE`, default `EXPENSE`). This is independent of `TransactionType` and determines how transactions are routed in budget reports:

| Transaction type | Category type | Routed to |
|-----------------|--------------|-----------|
| EXPENSE | EXPENSE | Expense actual (spending) |
| INCOME | EXPENSE | Contra-expense — subtracted from the expense actual (reimbursement netting) |
| INCOME | INCOME | Income actual |
| EXPENSE | INCOME | Contra-income — subtracted from the income actual (refund/correction of income already received) |
| TRANSFER | any | Excluded entirely |

**Reimbursement netting example**: A restaurant bill split where a friend pays you back is recorded as an INCOME transaction in the "Restaurants" (EXPENSE) category. The budget report shows your net out-of-pocket cost — the gross expense minus the reimbursement — without any manual adjustment.

**Contra-income example**: A salary overpayment that you pay back is recorded as an EXPENSE transaction in the "Salary" (INCOME) category. The budget report shows your net income — the gross salary minus the correction — without any manual adjustment.

**Category picker**: the transaction form shows a single merged list of INCOME + EXPENSE categories for both INCOME and EXPENSE transactions, so either netting direction is selectable. TRANSFER transactions keep their own restricted list (the two system Transfer In/Out categories).

**Subcategory inheritance**: When creating a subcategory, the API inherits the parent's CategoryType automatically, keeping the tree consistent.

### Soft-Delete for Accounts, Hard-Delete for Categories

Accounts use `isActive: false` instead of deletion. This preserves historical data — you can still see transactions from a closed account. Hard-deleting an account would require cascading deletes or null foreign keys, both problematic.

Categories are hard-deleted via `DELETE /api/categories/:id`, but only when it's safe: the endpoint counts transactions on the category and, for a parent, all of its children, and refuses with `409` if any exist. This sidesteps the "null foreign key" problem entirely — a category is only ever removed once nothing references it. Deleting a parent cascades to its children (and their `Budget`/`CategoryRule` rows) in one transaction, so you never end up with orphaned children under a deleted parent. The `isActive` flag on `Category` is unrelated to this — it's a "hide from pickers" toggle, not a delete mechanism.

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

## 18. Common Patterns in This Codebase

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

### Pattern: Translating Strings

Client components use `useTranslations` + `useLocale`:

```tsx
"use client";
import { useTranslations, useLocale } from "next-intl";
import { formatAmount } from "@/lib/formatters";

function MyComponent() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  return <p>{t("income")}: {formatAmount(1234.56, locale)}</p>;
}
```

Server components/pages use `getTranslations` (async):

```tsx
import { getTranslations } from "next-intl/server";

export default async function MyPage() {
  const t = await getTranslations("nav");
  return <PageHeader title={t("dashboard")} />;
}
```

**Rule of thumb**: if the file has `"use client"` at the top, use `useTranslations`. If it doesn't (default Server Component), use `await getTranslations`.

### Theme-Aware Recharts Colors

SVG presentation attributes (`fill="..."`, `stroke="..."`) do **not** process CSS custom properties. Writing `fill="hsl(var(--foreground))"` will render the literal string, not the resolved color — the result is usually black in both light and dark mode.

**The solution**: use `next-themes`' `useTheme()` hook to read the resolved theme and map it to explicit HSL values:

```typescript
import { useTheme } from "next-themes";

const { resolvedTheme } = useTheme();
const isDark = resolvedTheme === "dark";

// Explicit values — not CSS variables
const axisColor = isDark ? "hsl(240, 5%, 64%)" : "hsl(240, 5%, 34%)";
const gridColor = isDark ? "hsl(240, 5%, 26%)" : "hsl(240, 5%, 90%)";

// Use in SVG attributes
<XAxis tick={{ fill: axisColor }} />
<CartesianGrid stroke={gridColor} />
```

**Why `resolvedTheme` instead of `theme`?** `theme` can be `"system"`, which doesn't tell you the actual light/dark value. `resolvedTheme` always resolves to `"light"` or `"dark"` based on the system preference when the theme is set to `"system"`.

**HTML elements are fine with CSS variables**: Tooltip containers and `wrapperStyle` props render as regular HTML `<div>` elements, so `hsl(var(--foreground))` works correctly there. Only SVG attributes are affected.

---

## 19. Glossary

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
| **BCP 47** | Language tag standard: `"en-US"`, `"pt-PT"`. Used by `Intl.NumberFormat` and `Intl.DateTimeFormat` |
| **Hook** | A React function starting with `use` that adds state/effects to components |
| **Hydration** | The process of making server-rendered HTML interactive by attaching JavaScript |
| **i18n** | Internationalisation — designing software to support multiple languages and locales |
| **Locale** | A combination of language and region, e.g. `"pt-PT"` (Portuguese, Portugal) |
| **Idempotent** | An operation that produces the same result no matter how many times you run it |
| **Index** | A database structure that speeds up queries on specific columns |
| **JSX** | HTML-like syntax in JavaScript: `<div className="foo">text</div>` |
| **Middleware** | Code that runs between the request and the handler. In Next.js 16 this is `proxy.ts` exporting a `proxy` function |
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
