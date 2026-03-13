// ============================================================
// Database Seed Script
// ============================================================
// Populates the database with initial reference data and sample
// transactions for development. Run with: npx prisma db seed
//
// What is seeded:
//   - Currencies (EUR = default), account types, accounts
//   - Full category tree (parents + children)
//   - Two special categories configured in AppSettings:
//       · Transfer  — excluded from summaries (transfers between accounts)
//       · On Behalf Of Others — excluded from summaries (proxy purchases)
//   - Transactions across Jan–Mar 2026:
//       · EUR-only regular expenses and income
//       · USD freelance income + SaaS expenses (exchangeRate + baseCurrencyAmount stored)
//       · BRL salary income + daily expenses (exchangeRate + baseCurrencyAmount stored)
//       · Transfers using the Transfer category
//       · Proxy purchases: one settled (balance €0), one outstanding
//       · Health insurance reimbursement via same-category approach
//       · Several transactions flagged as needsReview
//   - Annual budgets for 2026
//
// Multi-currency design:
//   exchangeRate      — how many EUR per 1 unit of the account currency at tx date
//   baseCurrencyAmount — amount × exchangeRate, stored at entry time, never recalculated
// ============================================================

import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TransactionType } from "../src/generated/prisma/client.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...\n");

  // ----------------------------------------------------------
  // 1. Currencies
  // ----------------------------------------------------------
  // EUR is marked as the default currency. All summary APIs use
  // baseCurrencyAmount (or today's rate for the dashboard) to
  // convert non-EUR balances and transactions into EUR totals.

  const eur = await prisma.currency.upsert({
    where: { code: "EUR" },
    update: { isDefault: true },
    create: { code: "EUR", name: "Euro", symbol: "€", isDefault: true },
  });

  const usd = await prisma.currency.upsert({
    where: { code: "USD" },
    update: { isDefault: false },
    create: { code: "USD", name: "US Dollar", symbol: "$", isDefault: false },
  });

  const brl = await prisma.currency.upsert({
    where: { code: "BRL" },
    update: { isDefault: false },
    create: { code: "BRL", name: "Brazilian Real", symbol: "R$", isDefault: false },
  });

  console.log(`  ✓ Currencies: ${eur.code} (default), ${usd.code}, ${brl.code}`);

  // ----------------------------------------------------------
  // 2. Account Types
  // ----------------------------------------------------------

  const checking = await prisma.accountType.upsert({
    where: { name: "Checking" },
    update: {},
    create: { name: "Checking" },
  });

  const savings = await prisma.accountType.upsert({
    where: { name: "Savings" },
    update: {},
    create: { name: "Savings" },
  });

  const creditCard = await prisma.accountType.upsert({
    where: { name: "Credit Card" },
    update: {},
    create: { name: "Credit Card" },
  });

  const cash = await prisma.accountType.upsert({
    where: { name: "Cash" },
    update: {},
    create: { name: "Cash" },
  });

  console.log(
    `  ✓ Account Types: ${checking.name}, ${savings.name}, ${creditCard.name}, ${cash.name}`
  );

  // ----------------------------------------------------------
  // 3. Accounts
  // ----------------------------------------------------------
  // deleteMany + create (not upsert) because account name is not unique.
  // This resets all transactional data to a known state each run.

  await prisma.transaction.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.account.deleteMany();
  await prisma.category.deleteMany();

  const mainChecking = await prisma.account.create({
    data: {
      name: "Main Checking",
      initialBalance: 2500.0,
      currencyId: eur.id,
      accountTypeId: checking.id,
    },
  });

  const euroSavings = await prisma.account.create({
    data: {
      name: "Euro Savings",
      initialBalance: 10000.0,
      currencyId: eur.id,
      accountTypeId: savings.id,
    },
  });

  const wiseUsd = await prisma.account.create({
    data: {
      name: "Wise USD",
      initialBalance: 1500.0,
      currencyId: usd.id,
      accountTypeId: checking.id,
    },
  });

  const nubankBrl = await prisma.account.create({
    data: {
      name: "Nubank BRL",
      initialBalance: 5000.0,
      currencyId: brl.id,
      accountTypeId: checking.id,
    },
  });

  const euroCreditCard = await prisma.account.create({
    data: {
      name: "Visa Credit Card",
      initialBalance: 0,
      currencyId: eur.id,
      accountTypeId: creditCard.id,
    },
  });

  console.log(
    `  ✓ Accounts: ${mainChecking.name}, ${euroSavings.name}, ${wiseUsd.name}, ${nubankBrl.name}, ${euroCreditCard.name}`
  );

  // ----------------------------------------------------------
  // 4. Categories (parent + children)
  // ----------------------------------------------------------

  // --- Special categories (no children, configured in AppSettings) ---
  const transfer = await prisma.category.create({
    data: { name: "Transfer" },
  });

  const proxy = await prisma.category.create({
    data: { name: "On Behalf Of Others", excludeFromStats: true },
  });

  // --- Regular parent categories ---
  const housing = await prisma.category.create({ data: { name: "Housing" } });
  const food = await prisma.category.create({ data: { name: "Food" } });
  const transport = await prisma.category.create({ data: { name: "Transport" } });
  const utilities = await prisma.category.create({ data: { name: "Utilities" } });
  const entertainment = await prisma.category.create({ data: { name: "Entertainment" } });
  const health = await prisma.category.create({ data: { name: "Health" } });
  const shopping = await prisma.category.create({ data: { name: "Shopping" } });
  const income = await prisma.category.create({ data: { name: "Income" } });
  const tech = await prisma.category.create({ data: { name: "Tech & Software" } });

  // --- Child categories ---
  const rent = await prisma.category.create({ data: { name: "Rent", parentId: housing.id } });
  const homeInsurance = await prisma.category.create({ data: { name: "Home Insurance", parentId: housing.id } });
  const maintenance = await prisma.category.create({ data: { name: "Maintenance", parentId: housing.id } });

  const groceries = await prisma.category.create({ data: { name: "Groceries", parentId: food.id } });
  const restaurants = await prisma.category.create({ data: { name: "Restaurants", parentId: food.id } });
  const coffee = await prisma.category.create({ data: { name: "Coffee & Snacks", parentId: food.id } });

  const publicTransport = await prisma.category.create({ data: { name: "Public Transport", parentId: transport.id } });
  const fuel = await prisma.category.create({ data: { name: "Fuel", parentId: transport.id } });
  const carInsurance = await prisma.category.create({ data: { name: "Car Insurance", parentId: transport.id } });

  const electricity = await prisma.category.create({ data: { name: "Electricity", parentId: utilities.id } });
  const internet = await prisma.category.create({ data: { name: "Internet", parentId: utilities.id } });
  const phone = await prisma.category.create({ data: { name: "Phone", parentId: utilities.id } });

  const streaming = await prisma.category.create({ data: { name: "Streaming", parentId: entertainment.id } });
  const games = await prisma.category.create({ data: { name: "Games", parentId: entertainment.id } });

  const pharmacy = await prisma.category.create({ data: { name: "Pharmacy", parentId: health.id } });
  const doctor = await prisma.category.create({ data: { name: "Doctor", parentId: health.id } });

  const clothes = await prisma.category.create({ data: { name: "Clothes", parentId: shopping.id } });
  const electronics = await prisma.category.create({ data: { name: "Electronics", parentId: shopping.id } });

  const salary = await prisma.category.create({ data: { name: "Salary", parentId: income.id } });
  const freelance = await prisma.category.create({ data: { name: "Freelance", parentId: income.id } });

  const saas = await prisma.category.create({ data: { name: "SaaS & Tools", parentId: tech.id } });
  const hosting = await prisma.category.create({ data: { name: "Hosting & Cloud", parentId: tech.id } });

  console.log(`  ✓ Categories: 2 special + 9 parents + 22 children`);

  // ----------------------------------------------------------
  // 5. App Settings
  // ----------------------------------------------------------

  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: { transferCategoryId: transfer.id },
    create: { id: "singleton", transferCategoryId: transfer.id },
  });

  console.log(`  ✓ AppSettings: Transfer = "${transfer.name}"`);
  console.log(`  ✓ Non-tracked: "${proxy.name}" (excludeFromStats = true)`);

  // ----------------------------------------------------------
  // 6. Transactions
  // ----------------------------------------------------------
  // Spread across Jan–Mar 2026 to populate both monthly and annual views.
  //
  // MULTI-CURRENCY SCENARIOS:
  //
  //   USD (Wise USD account)
  //     Freelance income paid in USD is received monthly. The client also
  //     charges a SaaS tool ($20/month). exchangeRate = EUR per 1 USD at
  //     that date (ECB-like rate). baseCurrencyAmount = amount × exchangeRate.
  //     Rates used: Jan ≈ 0.9610, Feb ≈ 0.9580, Mar ≈ 0.9625
  //
  //   BRL (Nubank BRL account)
  //     A secondary salary paid in BRL (remote contract). Daily expenses
  //     in Brazil (supermarket, restaurants) paid from this account.
  //     Rates used: Jan ≈ 0.1740, Feb ≈ 0.1725, Mar ≈ 0.1710
  //
  //   EUR (Main Checking + Credit Card + Savings)
  //     No exchangeRate / baseCurrencyAmount needed — same currency as default.
  //
  // SPECIAL SCENARIOS:
  //
  //   TRANSFERS — both legs recorded so net = €0
  //   PROXY — settled (João, €0 net) + outstanding (Ana, -€45)
  //   HEALTH REIMBURSEMENT — GP visit €120 in Jan, insurance €80 in Feb
  //   NEEDS REVIEW — flagged transactions visible via filter

  type TxInput = {
    type: TransactionType;
    amount: number;
    description: string;
    date: string;
    fromAccountId: string;
    categoryId?: string;
    needsReview?: boolean;
    notes?: string;
    // Multi-currency fields — only set when account currency ≠ default currency.
    // exchangeRate: how many EUR per 1 unit of the account currency at this date.
    // baseCurrencyAmount: amount × exchangeRate, used by summary APIs.
    exchangeRate?: number;
    baseCurrencyAmount?: number;
  };

  const transactions: TxInput[] = [

    // ── January 2026: EUR Income ──────────────────────────────────────────
    {
      type: TransactionType.INCOME,
      amount: 3500,
      description: "Monthly Salary",
      date: "2026-01-05",
      fromAccountId: mainChecking.id,
      categoryId: salary.id,
    },

    // ── January 2026: USD Income (Wise) ──────────────────────────────────
    // Freelance project paid in USD. Rate on 2026-01-15: 1 USD = 0.9610 EUR.
    {
      type: TransactionType.INCOME,
      amount: 800,
      description: "Freelance project — client website",
      date: "2026-01-15",
      fromAccountId: wiseUsd.id,
      categoryId: freelance.id,
      exchangeRate: 0.9610,
      baseCurrencyAmount: 768.80, // 800 × 0.9610
    },

    // ── January 2026: BRL Income (Nubank) ────────────────────────────────
    // Secondary salary from a Brazilian remote contract.
    // Rate on 2026-01-05: 1 BRL = 0.1740 EUR.
    {
      type: TransactionType.INCOME,
      amount: 12000,
      description: "Salário — contrato remoto",
      date: "2026-01-05",
      fromAccountId: nubankBrl.id,
      categoryId: salary.id,
      exchangeRate: 0.1740,
      baseCurrencyAmount: 2088.00, // 12000 × 0.1740
    },

    // ── January 2026: Housing (EUR) ───────────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 950,
      description: "Rent January",
      date: "2026-01-01",
      fromAccountId: mainChecking.id,
      categoryId: rent.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 45,
      description: "Home insurance monthly",
      date: "2026-01-01",
      fromAccountId: mainChecking.id,
      categoryId: homeInsurance.id,
    },

    // ── January 2026: Food (EUR) ──────────────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 85.50,
      description: "Lidl weekly shop",
      date: "2026-01-03",
      fromAccountId: mainChecking.id,
      categoryId: groceries.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 62.30,
      description: "Aldi groceries",
      date: "2026-01-10",
      fromAccountId: mainChecking.id,
      categoryId: groceries.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 92.10,
      description: "Jumbo groceries",
      date: "2026-01-17",
      fromAccountId: mainChecking.id,
      categoryId: groceries.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 78.40,
      description: "Weekly groceries",
      date: "2026-01-24",
      fromAccountId: mainChecking.id,
      categoryId: groceries.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 35.00,
      description: "Pizza night",
      date: "2026-01-08",
      fromAccountId: euroCreditCard.id,
      categoryId: restaurants.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 48.50,
      description: "Sushi dinner",
      date: "2026-01-18",
      fromAccountId: euroCreditCard.id,
      categoryId: restaurants.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 4.50,
      description: "Morning coffee",
      date: "2026-01-06",
      fromAccountId: mainChecking.id,
      categoryId: coffee.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 4.50,
      description: "Morning coffee",
      date: "2026-01-13",
      fromAccountId: mainChecking.id,
      categoryId: coffee.id,
    },

    // ── January 2026: Food (BRL) ──────────────────────────────────────────
    // Supermarket and restaurant expenses in Brazil paid from Nubank.
    // Rate on 2026-01-18: 1 BRL = 0.1740 EUR.
    {
      type: TransactionType.EXPENSE,
      amount: 350,
      description: "Supermercado Extra",
      date: "2026-01-18",
      fromAccountId: nubankBrl.id,
      categoryId: groceries.id,
      exchangeRate: 0.1740,
      baseCurrencyAmount: 60.90, // 350 × 0.1740
    },
    {
      type: TransactionType.EXPENSE,
      amount: 150,
      description: "Restaurante japonês",
      date: "2026-01-22",
      fromAccountId: nubankBrl.id,
      categoryId: restaurants.id,
      exchangeRate: 0.1740,
      baseCurrencyAmount: 26.10, // 150 × 0.1740
    },

    // ── January 2026: Transport (EUR) ─────────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 89,
      description: "Monthly transit pass",
      date: "2026-01-02",
      fromAccountId: mainChecking.id,
      categoryId: publicTransport.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 55.30,
      description: "Gas station",
      date: "2026-01-12",
      fromAccountId: euroCreditCard.id,
      categoryId: fuel.id,
    },

    // ── January 2026: Utilities (EUR) ─────────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 75,
      description: "Electricity bill",
      date: "2026-01-10",
      fromAccountId: mainChecking.id,
      categoryId: electricity.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 39.99,
      description: "Internet subscription",
      date: "2026-01-10",
      fromAccountId: mainChecking.id,
      categoryId: internet.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 25,
      description: "Phone plan",
      date: "2026-01-10",
      fromAccountId: mainChecking.id,
      categoryId: phone.id,
    },

    // ── January 2026: Entertainment (EUR) ────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 15.99,
      description: "Netflix",
      date: "2026-01-05",
      fromAccountId: mainChecking.id,
      categoryId: streaming.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 9.99,
      description: "Spotify",
      date: "2026-01-05",
      fromAccountId: mainChecking.id,
      categoryId: streaming.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 59.99,
      description: "Hollow Knight",
      date: "2026-01-20",
      fromAccountId: euroCreditCard.id,
      categoryId: games.id,
    },

    // ── January 2026: Tech & Software (USD) ──────────────────────────────
    // SaaS tools paid from USD account.
    // Rate on 2026-01-20: 1 USD = 0.9610 EUR.
    {
      type: TransactionType.EXPENSE,
      amount: 20,
      description: "Vercel Pro",
      date: "2026-01-20",
      fromAccountId: wiseUsd.id,
      categoryId: hosting.id,
      exchangeRate: 0.9610,
      baseCurrencyAmount: 19.22, // 20 × 0.9610
    },
    {
      type: TransactionType.EXPENSE,
      amount: 10,
      description: "GitHub Copilot",
      date: "2026-01-20",
      fromAccountId: wiseUsd.id,
      categoryId: saas.id,
      exchangeRate: 0.9610,
      baseCurrencyAmount: 9.61, // 10 × 0.9610
    },

    // ── January 2026: Health (EUR) ────────────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 12.50,
      description: "Ibuprofen",
      date: "2026-01-14",
      fromAccountId: mainChecking.id,
      categoryId: pharmacy.id,
    },
    // Doctor visit — marked needsReview while waiting for insurance reimbursement.
    {
      type: TransactionType.EXPENSE,
      amount: 120,
      description: "GP consultation",
      date: "2026-01-22",
      fromAccountId: mainChecking.id,
      categoryId: doctor.id,
      needsReview: true,
      notes: "Waiting for health insurance reimbursement (~€80 expected)",
    },

    // ── January 2026: Shopping (EUR) ──────────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 120,
      description: "Winter jacket",
      date: "2026-01-22",
      fromAccountId: euroCreditCard.id,
      categoryId: clothes.id,
    },

    // ── January 2026: Transfers ───────────────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 500,
      description: "To savings — monthly transfer",
      date: "2026-01-06",
      fromAccountId: mainChecking.id,
      categoryId: transfer.id,
    },
    {
      type: TransactionType.INCOME,
      amount: 500,
      description: "From checking — monthly transfer",
      date: "2026-01-06",
      fromAccountId: euroSavings.id,
      categoryId: transfer.id,
    },
    // EUR → USD currency exchange via Wise (transfer between own accounts)
    {
      type: TransactionType.EXPENSE,
      amount: 200,
      description: "EUR → USD via Wise",
      date: "2026-01-10",
      fromAccountId: mainChecking.id,
      categoryId: transfer.id,
    },
    {
      type: TransactionType.INCOME,
      amount: 200,
      description: "USD from EUR exchange",
      date: "2026-01-10",
      fromAccountId: wiseUsd.id,
      categoryId: transfer.id,
    },

    // ── January 2026: Proxy (On Behalf Of Others) ─────────────────────────
    // Concert tickets for João — paid now, João reimburses in February.
    {
      type: TransactionType.EXPENSE,
      amount: 80,
      description: "Concert tickets for João",
      date: "2026-01-25",
      fromAccountId: euroCreditCard.id,
      categoryId: proxy.id,
      needsReview: true,
      notes: "2 tickets × €40 — João will pay back in Feb",
    },

    // ════════════════════════════════════════════════════════════════════════
    // February 2026
    // ════════════════════════════════════════════════════════════════════════

    // ── February 2026: EUR Income ─────────────────────────────────────────
    {
      type: TransactionType.INCOME,
      amount: 3500,
      description: "Monthly Salary",
      date: "2026-02-05",
      fromAccountId: mainChecking.id,
      categoryId: salary.id,
    },
    // Health insurance partial reimbursement for January GP visit
    {
      type: TransactionType.INCOME,
      amount: 80,
      description: "Health insurance reimbursement — GP Jan",
      date: "2026-02-12",
      fromAccountId: mainChecking.id,
      categoryId: doctor.id,
      notes: "Partial reimbursement for 2026-01-22 GP consultation",
    },
    // João reimburses concert tickets — proxy balance for João back to €0
    {
      type: TransactionType.INCOME,
      amount: 80,
      description: "João — concert tickets reimbursement",
      date: "2026-02-14",
      fromAccountId: mainChecking.id,
      categoryId: proxy.id,
    },

    // ── February 2026: USD Income (Wise) ─────────────────────────────────
    // Rate on 2026-02-10: 1 USD = 0.9580 EUR.
    {
      type: TransactionType.INCOME,
      amount: 1200,
      description: "Freelance project — e-commerce build",
      date: "2026-02-10",
      fromAccountId: wiseUsd.id,
      categoryId: freelance.id,
      exchangeRate: 0.9580,
      baseCurrencyAmount: 1149.60, // 1200 × 0.9580
    },

    // ── February 2026: BRL Income (Nubank) ───────────────────────────────
    // Rate on 2026-02-05: 1 BRL = 0.1725 EUR.
    {
      type: TransactionType.INCOME,
      amount: 12000,
      description: "Salário — contrato remoto",
      date: "2026-02-05",
      fromAccountId: nubankBrl.id,
      categoryId: salary.id,
      exchangeRate: 0.1725,
      baseCurrencyAmount: 2070.00, // 12000 × 0.1725
    },

    // ── February 2026: Housing (EUR) ──────────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 950,
      description: "Rent February",
      date: "2026-02-01",
      fromAccountId: mainChecking.id,
      categoryId: rent.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 45,
      description: "Home insurance monthly",
      date: "2026-02-01",
      fromAccountId: mainChecking.id,
      categoryId: homeInsurance.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 150,
      description: "Plumber repair",
      date: "2026-02-08",
      fromAccountId: mainChecking.id,
      categoryId: maintenance.id,
    },

    // ── February 2026: Food (EUR) ─────────────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 95.20,
      description: "Lidl weekly shop",
      date: "2026-02-01",
      fromAccountId: mainChecking.id,
      categoryId: groceries.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 72.80,
      description: "Aldi groceries",
      date: "2026-02-08",
      fromAccountId: mainChecking.id,
      categoryId: groceries.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 42.00,
      description: "Thai restaurant",
      date: "2026-02-06",
      fromAccountId: euroCreditCard.id,
      categoryId: restaurants.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 4.50,
      description: "Morning coffee",
      date: "2026-02-03",
      fromAccountId: mainChecking.id,
      categoryId: coffee.id,
    },

    // ── February 2026: Food (BRL) ─────────────────────────────────────────
    // Rate on 2026-02-15: 1 BRL = 0.1725 EUR.
    {
      type: TransactionType.EXPENSE,
      amount: 280,
      description: "Supermercado Pão de Açúcar",
      date: "2026-02-15",
      fromAccountId: nubankBrl.id,
      categoryId: groceries.id,
      exchangeRate: 0.1725,
      baseCurrencyAmount: 48.30, // 280 × 0.1725
    },
    {
      type: TransactionType.EXPENSE,
      amount: 200,
      description: "Rodízio de churrasco",
      date: "2026-02-22",
      fromAccountId: nubankBrl.id,
      categoryId: restaurants.id,
      exchangeRate: 0.1725,
      baseCurrencyAmount: 34.50, // 200 × 0.1725
    },

    // ── February 2026: Transport (EUR) ────────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 89,
      description: "Monthly transit pass",
      date: "2026-02-01",
      fromAccountId: mainChecking.id,
      categoryId: publicTransport.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 48.70,
      description: "Gas station",
      date: "2026-02-05",
      fromAccountId: euroCreditCard.id,
      categoryId: fuel.id,
    },

    // ── February 2026: Utilities (EUR) ────────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 82,
      description: "Electricity bill",
      date: "2026-02-10",
      fromAccountId: mainChecking.id,
      categoryId: electricity.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 39.99,
      description: "Internet subscription",
      date: "2026-02-10",
      fromAccountId: mainChecking.id,
      categoryId: internet.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 25,
      description: "Phone plan",
      date: "2026-02-10",
      fromAccountId: mainChecking.id,
      categoryId: phone.id,
    },

    // ── February 2026: Entertainment (EUR) ───────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 15.99,
      description: "Netflix",
      date: "2026-02-05",
      fromAccountId: mainChecking.id,
      categoryId: streaming.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 9.99,
      description: "Spotify",
      date: "2026-02-05",
      fromAccountId: mainChecking.id,
      categoryId: streaming.id,
    },

    // ── February 2026: Tech & Software (USD) ─────────────────────────────
    // Rate on 2026-02-20: 1 USD = 0.9580 EUR.
    {
      type: TransactionType.EXPENSE,
      amount: 20,
      description: "Vercel Pro",
      date: "2026-02-20",
      fromAccountId: wiseUsd.id,
      categoryId: hosting.id,
      exchangeRate: 0.9580,
      baseCurrencyAmount: 19.16, // 20 × 0.9580
    },
    {
      type: TransactionType.EXPENSE,
      amount: 10,
      description: "GitHub Copilot",
      date: "2026-02-20",
      fromAccountId: wiseUsd.id,
      categoryId: saas.id,
      exchangeRate: 0.9580,
      baseCurrencyAmount: 9.58, // 10 × 0.9580
    },

    // ── February 2026: Health (EUR) ───────────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 85,
      description: "Dentist checkup",
      date: "2026-02-04",
      fromAccountId: mainChecking.id,
      categoryId: doctor.id,
      needsReview: true,
      notes: "Check if annual dental plan covers this",
    },

    // ── February 2026: Shopping (EUR) ─────────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 249,
      description: "Wireless headphones",
      date: "2026-02-03",
      fromAccountId: euroCreditCard.id,
      categoryId: electronics.id,
      needsReview: true,
      notes: "Might return — 30-day return window until 2026-03-04",
    },

    // ── February 2026: Transfers ──────────────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 500,
      description: "To savings — monthly transfer",
      date: "2026-02-06",
      fromAccountId: mainChecking.id,
      categoryId: transfer.id,
    },
    {
      type: TransactionType.INCOME,
      amount: 500,
      description: "From checking — monthly transfer",
      date: "2026-02-06",
      fromAccountId: euroSavings.id,
      categoryId: transfer.id,
    },

    // ── February 2026: Proxy (outstanding — balance = -€45) ──────────────
    // Groceries for neighbour Ana. Not reimbursed yet.
    {
      type: TransactionType.EXPENSE,
      amount: 45,
      description: "Groceries for neighbour Ana",
      date: "2026-02-20",
      fromAccountId: mainChecking.id,
      categoryId: proxy.id,
      needsReview: true,
      notes: "Ana will pay back — remind her",
    },

    // ════════════════════════════════════════════════════════════════════════
    // March 2026
    // ════════════════════════════════════════════════════════════════════════

    // ── March 2026: EUR Income ────────────────────────────────────────────
    {
      type: TransactionType.INCOME,
      amount: 3500,
      description: "Monthly Salary",
      date: "2026-03-05",
      fromAccountId: mainChecking.id,
      categoryId: salary.id,
    },

    // ── March 2026: USD Income (Wise) ─────────────────────────────────────
    // Rate on 2026-03-08: 1 USD = 0.9625 EUR.
    {
      type: TransactionType.INCOME,
      amount: 650,
      description: "Freelance project — landing page",
      date: "2026-03-08",
      fromAccountId: wiseUsd.id,
      categoryId: freelance.id,
      exchangeRate: 0.9625,
      baseCurrencyAmount: 625.63, // 650 × 0.9625
    },

    // ── March 2026: BRL Income (Nubank) ──────────────────────────────────
    // Rate on 2026-03-05: 1 BRL = 0.1710 EUR.
    {
      type: TransactionType.INCOME,
      amount: 12000,
      description: "Salário — contrato remoto",
      date: "2026-03-05",
      fromAccountId: nubankBrl.id,
      categoryId: salary.id,
      exchangeRate: 0.1710,
      baseCurrencyAmount: 2052.00, // 12000 × 0.1710
    },

    // ── March 2026: Housing (EUR) ─────────────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 950,
      description: "Rent March",
      date: "2026-03-01",
      fromAccountId: mainChecking.id,
      categoryId: rent.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 45,
      description: "Home insurance monthly",
      date: "2026-03-01",
      fromAccountId: mainChecking.id,
      categoryId: homeInsurance.id,
    },

    // ── March 2026: Food (EUR) ────────────────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 88.60,
      description: "Lidl weekly shop",
      date: "2026-03-01",
      fromAccountId: mainChecking.id,
      categoryId: groceries.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 67.40,
      description: "Aldi groceries",
      date: "2026-03-08",
      fromAccountId: mainChecking.id,
      categoryId: groceries.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 55.90,
      description: "Restaurant — birthday dinner",
      date: "2026-03-07",
      fromAccountId: euroCreditCard.id,
      categoryId: restaurants.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 4.50,
      description: "Morning coffee",
      date: "2026-03-03",
      fromAccountId: mainChecking.id,
      categoryId: coffee.id,
    },

    // ── March 2026: Food (BRL) ────────────────────────────────────────────
    // Rate on 2026-03-15: 1 BRL = 0.1710 EUR.
    {
      type: TransactionType.EXPENSE,
      amount: 420,
      description: "Supermercado Extra",
      date: "2026-03-15",
      fromAccountId: nubankBrl.id,
      categoryId: groceries.id,
      exchangeRate: 0.1710,
      baseCurrencyAmount: 71.82, // 420 × 0.1710
    },

    // ── March 2026: Transport (EUR) ───────────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 89,
      description: "Monthly transit pass",
      date: "2026-03-01",
      fromAccountId: mainChecking.id,
      categoryId: publicTransport.id,
    },

    // ── March 2026: Utilities (EUR) ───────────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 70,
      description: "Electricity bill",
      date: "2026-03-10",
      fromAccountId: mainChecking.id,
      categoryId: electricity.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 39.99,
      description: "Internet subscription",
      date: "2026-03-10",
      fromAccountId: mainChecking.id,
      categoryId: internet.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 25,
      description: "Phone plan",
      date: "2026-03-10",
      fromAccountId: mainChecking.id,
      categoryId: phone.id,
    },

    // ── March 2026: Entertainment (EUR) ──────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 15.99,
      description: "Netflix",
      date: "2026-03-05",
      fromAccountId: mainChecking.id,
      categoryId: streaming.id,
    },
    {
      type: TransactionType.EXPENSE,
      amount: 9.99,
      description: "Spotify",
      date: "2026-03-05",
      fromAccountId: mainChecking.id,
      categoryId: streaming.id,
    },

    // ── March 2026: Tech & Software (USD) ────────────────────────────────
    // Rate on 2026-03-20: 1 USD = 0.9625 EUR.
    {
      type: TransactionType.EXPENSE,
      amount: 20,
      description: "Vercel Pro",
      date: "2026-03-20",
      fromAccountId: wiseUsd.id,
      categoryId: hosting.id,
      exchangeRate: 0.9625,
      baseCurrencyAmount: 19.25, // 20 × 0.9625
    },
    {
      type: TransactionType.EXPENSE,
      amount: 10,
      description: "GitHub Copilot",
      date: "2026-03-20",
      fromAccountId: wiseUsd.id,
      categoryId: saas.id,
      exchangeRate: 0.9625,
      baseCurrencyAmount: 9.63, // 10 × 0.9625
    },

    // ── March 2026: Transfers ─────────────────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 500,
      description: "To savings — monthly transfer",
      date: "2026-03-06",
      fromAccountId: mainChecking.id,
      categoryId: transfer.id,
    },
    {
      type: TransactionType.INCOME,
      amount: 500,
      description: "From checking — monthly transfer",
      date: "2026-03-06",
      fromAccountId: euroSavings.id,
      categoryId: transfer.id,
    },
  ];

  for (const tx of transactions) {
    await prisma.transaction.create({
      data: {
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        date: new Date(tx.date),
        fromAccountId: tx.fromAccountId,
        categoryId: tx.categoryId,
        needsReview: tx.needsReview ?? false,
        notes: tx.notes,
        exchangeRate: tx.exchangeRate ?? null,
        baseCurrencyAmount: tx.baseCurrencyAmount ?? null,
      },
    });
  }

  const needsReviewCount = transactions.filter((t) => t.needsReview).length;
  const multicurrencyCount = transactions.filter((t) => t.exchangeRate != null).length;
  console.log(
    `  ✓ Transactions: ${transactions.length} records (${needsReviewCount} flagged for review, ${multicurrencyCount} with exchange rate)`
  );

  // ----------------------------------------------------------
  // 7. Budgets (2026)
  // ----------------------------------------------------------

  const budgets = [
    { year: 2026, categoryId: housing.id, amount: 12000 },
    { year: 2026, categoryId: food.id, amount: 6000 },
    { year: 2026, categoryId: transport.id, amount: 2400 },
    { year: 2026, categoryId: utilities.id, amount: 1800 },
    { year: 2026, categoryId: entertainment.id, amount: 1200 },
    { year: 2026, categoryId: health.id, amount: 1200 },
    { year: 2026, categoryId: shopping.id, amount: 3600 },
    { year: 2026, categoryId: tech.id, amount: 600 },
  ];

  for (const budget of budgets) {
    await prisma.budget.upsert({
      where: { year_categoryId_type: { year: budget.year, categoryId: budget.categoryId, type: "EXPENSE" } },
      update: { amount: budget.amount },
      create: budget,
    });
  }

  console.log(`  ✓ Budgets: ${budgets.length} entries for 2026`);

  console.log(`
  Expected state after seed:
    Default currency:  EUR (isDefault = true)
    Transfer balance:  €0    (both legs of each transfer recorded)
    Proxy balance:    -€45   (João settled, neighbour Ana still outstanding)
    Needs review:      4 transactions (GP visit, dentist, headphones, Ana groceries)

  Multi-currency coverage:
    USD transactions:  freelance income (Jan/Feb/Mar) + SaaS tools (Jan/Feb/Mar)
                       exchangeRate stored (≈0.961–0.963 EUR/USD)
    BRL transactions:  salary income (Jan/Feb/Mar) + groceries + restaurants
                       exchangeRate stored (≈0.171–0.174 EUR/BRL)
    EUR transactions:  all other transactions (no exchangeRate needed)

  Summary API behaviour:
    effectiveAmount() uses baseCurrencyAmount for USD/BRL transactions,
    so monthly and annual summaries show all amounts in EUR.
  `);
  console.log("✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
