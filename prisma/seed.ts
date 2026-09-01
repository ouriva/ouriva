// ============================================================
// Database Seed Script
// ============================================================
// Populates the database with realistic demo data.
// Run with: npx prisma db seed
//
// What is seeded:
//   - Currencies (EUR = default), account types, accounts
//   - Full category tree with icons, colors, and 50·30·20 buckets
//   - Transactions across Oct 2025 – Mar 2026 (6 months)
//   - Multi-currency: USD freelance income + SaaS, BRL salary + expenses
//   - Transfers, proxy purchases, health reimbursements, needsReview flags
//   - Category rules for auto-categorization during import
//   - Annual budgets for 2025 and 2026
// ============================================================

import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  TransactionType,
  CategoryBucket,
  MatchType,
} from "../src/generated/prisma/client.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...\n");

  // ----------------------------------------------------------
  // 1. Currencies
  // ----------------------------------------------------------

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
  // deleteMany + create resets all transactional data each run.

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
      sortOrder: 0,
    },
  });

  const euroSavings = await prisma.account.create({
    data: {
      name: "Euro Savings",
      initialBalance: 10000.0,
      currencyId: eur.id,
      accountTypeId: savings.id,
      sortOrder: 1,
    },
  });

  const wiseUsd = await prisma.account.create({
    data: {
      name: "Wise USD",
      initialBalance: 1500.0,
      currencyId: usd.id,
      accountTypeId: checking.id,
      sortOrder: 2,
    },
  });

  const nubankBrl = await prisma.account.create({
    data: {
      name: "Nubank BRL",
      initialBalance: 5000.0,
      currencyId: brl.id,
      accountTypeId: checking.id,
      sortOrder: 3,
    },
  });

  const euroCreditCard = await prisma.account.create({
    data: {
      name: "Visa Credit Card",
      initialBalance: 0,
      currencyId: eur.id,
      accountTypeId: creditCard.id,
      sortOrder: 4,
    },
  });

  console.log(
    `  ✓ Accounts: ${mainChecking.name}, ${euroSavings.name}, ${wiseUsd.name}, ${nubankBrl.name}, ${euroCreditCard.name}`
  );

  // ----------------------------------------------------------
  // 4. Categories — icons, colors, and 50·30·20 buckets
  // ----------------------------------------------------------
  // bucket is set on parent categories and inherited by children
  // that don't have their own. This powers the 50·30·20 summary.
  //
  // Bucket assignments:
  //   NEEDS  — Housing, Food, Transport, Utilities, Health
  //   WANTS  — Entertainment, Shopping, Tech & Software
  //   SAVINGS — no parent category (savings tracked via transfers)

  // --- Special categories (no children, configured in AppSettings) ---
  const transfer = await prisma.category.create({
    data: {
      name: "Transfer",
      icon: "ArrowLeftRight",
      color: "#94a3b8",
    },
  });

  const proxy = await prisma.category.create({
    data: {
      name: "On Behalf Of Others",
      icon: "Users",
      color: "#64748b",
      excludeFromStats: true,
    },
  });

  // --- Parent categories ---
  const housing = await prisma.category.create({
    data: {
      name: "Housing",
      icon: "House",
      color: "#6366f1",
      bucket: CategoryBucket.NEEDS,
    },
  });

  const food = await prisma.category.create({
    data: {
      name: "Food",
      icon: "Utensils",
      color: "#f59e0b",
      bucket: CategoryBucket.NEEDS,
    },
  });

  const transport = await prisma.category.create({
    data: {
      name: "Transport",
      icon: "Car",
      color: "#3b82f6",
      bucket: CategoryBucket.NEEDS,
    },
  });

  const utilities = await prisma.category.create({
    data: {
      name: "Utilities",
      icon: "Zap",
      color: "#eab308",
      bucket: CategoryBucket.NEEDS,
    },
  });

  const entertainment = await prisma.category.create({
    data: {
      name: "Entertainment",
      icon: "Tv",
      color: "#ec4899",
      bucket: CategoryBucket.WANTS,
    },
  });

  const health = await prisma.category.create({
    data: {
      name: "Health",
      icon: "Heart",
      color: "#ef4444",
      bucket: CategoryBucket.NEEDS,
    },
  });

  const shopping = await prisma.category.create({
    data: {
      name: "Shopping",
      icon: "ShoppingBag",
      color: "#8b5cf6",
      bucket: CategoryBucket.WANTS,
    },
  });

  const income = await prisma.category.create({
    data: {
      name: "Income",
      icon: "TrendingUp",
      color: "#10b981",
    },
  });

  const tech = await prisma.category.create({
    data: {
      name: "Tech & Software",
      icon: "Monitor",
      color: "#06b6d4",
      bucket: CategoryBucket.WANTS,
    },
  });

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
  const events = await prisma.category.create({ data: { name: "Events", parentId: entertainment.id } });

  const pharmacy = await prisma.category.create({ data: { name: "Pharmacy", parentId: health.id } });
  const doctor = await prisma.category.create({ data: { name: "Doctor", parentId: health.id } });

  const clothes = await prisma.category.create({ data: { name: "Clothes", parentId: shopping.id } });
  const electronics = await prisma.category.create({ data: { name: "Electronics", parentId: shopping.id } });
  const gifts = await prisma.category.create({ data: { name: "Gifts", parentId: shopping.id } });

  const salary = await prisma.category.create({ data: { name: "Salary", parentId: income.id } });
  const freelance = await prisma.category.create({ data: { name: "Freelance", parentId: income.id } });
  const bonus = await prisma.category.create({ data: { name: "Bonus", parentId: income.id } });

  const saas = await prisma.category.create({ data: { name: "SaaS & Tools", parentId: tech.id } });
  const hosting = await prisma.category.create({ data: { name: "Hosting & Cloud", parentId: tech.id } });

  console.log(`  ✓ Categories: 2 special + 9 parents + 25 children (icons, colors, buckets set)`);

  // ----------------------------------------------------------
  // 5. Transactions — Oct 2025 through Mar 2026
  // ----------------------------------------------------------
  // 6 months of data populates both the monthly and annual views.
  //
  // Exchange rates used (EUR per 1 unit of foreign currency):
  //   USD: Oct 0.9500 / Nov 0.9520 / Dec 0.9550 / Jan 0.9610 / Feb 0.9580 / Mar 0.9625
  //   BRL: Oct 0.1720 / Nov 0.1715 / Dec 0.1730 / Jan 0.1740 / Feb 0.1725 / Mar 0.1710

  type TxInput = {
    type: TransactionType;
    amount: number;
    description: string;
    friendlyName?: string;
    date: string;
    fromAccountId: string;
    categoryId?: string;
    needsReview?: boolean;
    notes?: string;
    exchangeRate?: number;
    baseCurrencyAmount?: number;
  };

  const transactions: TxInput[] = [

    // ════════════════════════════════════════════════════════════════════════
    // October 2025
    // ════════════════════════════════════════════════════════════════════════

    // Income
    { type: TransactionType.INCOME, amount: 3500, description: "Monthly Salary", date: "2025-10-05", fromAccountId: mainChecking.id, categoryId: salary.id },
    { type: TransactionType.INCOME, amount: 950, description: "Freelance project — dashboard redesign", date: "2025-10-12", fromAccountId: wiseUsd.id, categoryId: freelance.id, exchangeRate: 0.9500, baseCurrencyAmount: 902.50 },
    { type: TransactionType.INCOME, amount: 12000, description: "Salário — contrato remoto", date: "2025-10-05", fromAccountId: nubankBrl.id, categoryId: salary.id, exchangeRate: 0.1720, baseCurrencyAmount: 2064.00 },

    // Housing
    { type: TransactionType.EXPENSE, amount: 950, description: "Rent October", friendlyName: "Rent", date: "2025-10-01", fromAccountId: mainChecking.id, categoryId: rent.id },
    { type: TransactionType.EXPENSE, amount: 45, description: "Home insurance monthly", friendlyName: "Home Insurance", date: "2025-10-01", fromAccountId: mainChecking.id, categoryId: homeInsurance.id },
    { type: TransactionType.EXPENSE, amount: 540, description: "Car insurance annual", friendlyName: "Car Insurance", date: "2025-10-15", fromAccountId: mainChecking.id, categoryId: carInsurance.id, notes: "Annual policy — covers Oct 2025 to Oct 2026" },

    // Food
    { type: TransactionType.EXPENSE, amount: 78.30, description: "Lidl weekly shop", friendlyName: "Lidl", date: "2025-10-04", fromAccountId: mainChecking.id, categoryId: groceries.id },
    { type: TransactionType.EXPENSE, amount: 55.90, description: "Aldi groceries", friendlyName: "Aldi", date: "2025-10-11", fromAccountId: mainChecking.id, categoryId: groceries.id },
    { type: TransactionType.EXPENSE, amount: 83.20, description: "Lidl weekly shop", friendlyName: "Lidl", date: "2025-10-18", fromAccountId: mainChecking.id, categoryId: groceries.id },
    { type: TransactionType.EXPENSE, amount: 71.40, description: "Jumbo groceries", friendlyName: "Jumbo", date: "2025-10-25", fromAccountId: mainChecking.id, categoryId: groceries.id },
    { type: TransactionType.EXPENSE, amount: 38.50, description: "Italian restaurant", date: "2025-10-09", fromAccountId: euroCreditCard.id, categoryId: restaurants.id },
    { type: TransactionType.EXPENSE, amount: 4.50, description: "Morning coffee", date: "2025-10-06", fromAccountId: mainChecking.id, categoryId: coffee.id },
    { type: TransactionType.EXPENSE, amount: 310, description: "Supermercado Extra", date: "2025-10-15", fromAccountId: nubankBrl.id, categoryId: groceries.id, exchangeRate: 0.1720, baseCurrencyAmount: 53.32 },

    // Transport
    { type: TransactionType.EXPENSE, amount: 89, description: "Monthly transit pass", date: "2025-10-02", fromAccountId: mainChecking.id, categoryId: publicTransport.id },
    { type: TransactionType.EXPENSE, amount: 60.10, description: "Gas station", date: "2025-10-08", fromAccountId: euroCreditCard.id, categoryId: fuel.id },

    // Utilities
    { type: TransactionType.EXPENSE, amount: 78, description: "Electricity bill", date: "2025-10-10", fromAccountId: mainChecking.id, categoryId: electricity.id },
    { type: TransactionType.EXPENSE, amount: 39.99, description: "Internet subscription", friendlyName: "Internet", date: "2025-10-10", fromAccountId: mainChecking.id, categoryId: internet.id },
    { type: TransactionType.EXPENSE, amount: 25, description: "Phone plan", date: "2025-10-10", fromAccountId: mainChecking.id, categoryId: phone.id },

    // Entertainment
    { type: TransactionType.EXPENSE, amount: 15.99, description: "Netflix", date: "2025-10-05", fromAccountId: mainChecking.id, categoryId: streaming.id },
    { type: TransactionType.EXPENSE, amount: 9.99, description: "Spotify", date: "2025-10-05", fromAccountId: mainChecking.id, categoryId: streaming.id },

    // Health
    { type: TransactionType.EXPENSE, amount: 8.90, description: "Ibuprofen", date: "2025-10-14", fromAccountId: mainChecking.id, categoryId: pharmacy.id },

    // Tech (USD)
    { type: TransactionType.EXPENSE, amount: 20, description: "Vercel Pro", date: "2025-10-20", fromAccountId: wiseUsd.id, categoryId: hosting.id, exchangeRate: 0.9500, baseCurrencyAmount: 19.00 },
    { type: TransactionType.EXPENSE, amount: 10, description: "GitHub Copilot", date: "2025-10-20", fromAccountId: wiseUsd.id, categoryId: saas.id, exchangeRate: 0.9500, baseCurrencyAmount: 9.50 },

    // Transfers
    { type: TransactionType.EXPENSE, amount: 500, description: "To savings — monthly transfer", date: "2025-10-06", fromAccountId: mainChecking.id, categoryId: transfer.id },
    { type: TransactionType.INCOME, amount: 500, description: "From checking — monthly transfer", date: "2025-10-06", fromAccountId: euroSavings.id, categoryId: transfer.id },

    // ════════════════════════════════════════════════════════════════════════
    // November 2025
    // ════════════════════════════════════════════════════════════════════════

    // Income
    { type: TransactionType.INCOME, amount: 3500, description: "Monthly Salary", date: "2025-11-05", fromAccountId: mainChecking.id, categoryId: salary.id },
    { type: TransactionType.INCOME, amount: 12000, description: "Salário — contrato remoto", date: "2025-11-05", fromAccountId: nubankBrl.id, categoryId: salary.id, exchangeRate: 0.1715, baseCurrencyAmount: 2058.00 },

    // Housing
    { type: TransactionType.EXPENSE, amount: 950, description: "Rent November", friendlyName: "Rent", date: "2025-11-01", fromAccountId: mainChecking.id, categoryId: rent.id },
    { type: TransactionType.EXPENSE, amount: 45, description: "Home insurance monthly", friendlyName: "Home Insurance", date: "2025-11-01", fromAccountId: mainChecking.id, categoryId: homeInsurance.id },

    // Food
    { type: TransactionType.EXPENSE, amount: 92.40, description: "Lidl weekly shop", friendlyName: "Lidl", date: "2025-11-02", fromAccountId: mainChecking.id, categoryId: groceries.id },
    { type: TransactionType.EXPENSE, amount: 68.70, description: "Aldi groceries", friendlyName: "Aldi", date: "2025-11-09", fromAccountId: mainChecking.id, categoryId: groceries.id },
    { type: TransactionType.EXPENSE, amount: 79.50, description: "Lidl weekly shop", friendlyName: "Lidl", date: "2025-11-16", fromAccountId: mainChecking.id, categoryId: groceries.id },
    { type: TransactionType.EXPENSE, amount: 52.00, description: "Thai restaurant", date: "2025-11-15", fromAccountId: euroCreditCard.id, categoryId: restaurants.id },
    { type: TransactionType.EXPENSE, amount: 4.50, description: "Morning coffee", date: "2025-11-03", fromAccountId: mainChecking.id, categoryId: coffee.id },
    { type: TransactionType.EXPENSE, amount: 295, description: "Supermercado Pão de Açúcar", date: "2025-11-15", fromAccountId: nubankBrl.id, categoryId: groceries.id, exchangeRate: 0.1715, baseCurrencyAmount: 50.59 },

    // Transport
    { type: TransactionType.EXPENSE, amount: 89, description: "Monthly transit pass", date: "2025-11-02", fromAccountId: mainChecking.id, categoryId: publicTransport.id },
    { type: TransactionType.EXPENSE, amount: 52.80, description: "Gas station", date: "2025-11-12", fromAccountId: euroCreditCard.id, categoryId: fuel.id },

    // Utilities
    { type: TransactionType.EXPENSE, amount: 88, description: "Electricity bill", date: "2025-11-10", fromAccountId: mainChecking.id, categoryId: electricity.id },
    { type: TransactionType.EXPENSE, amount: 39.99, description: "Internet subscription", friendlyName: "Internet", date: "2025-11-10", fromAccountId: mainChecking.id, categoryId: internet.id },
    { type: TransactionType.EXPENSE, amount: 25, description: "Phone plan", date: "2025-11-10", fromAccountId: mainChecking.id, categoryId: phone.id },

    // Entertainment
    { type: TransactionType.EXPENSE, amount: 15.99, description: "Netflix", date: "2025-11-05", fromAccountId: mainChecking.id, categoryId: streaming.id },
    { type: TransactionType.EXPENSE, amount: 9.99, description: "Spotify", date: "2025-11-05", fromAccountId: mainChecking.id, categoryId: streaming.id },

    // Shopping — Black Friday
    { type: TransactionType.EXPENSE, amount: 245, description: "Black Friday — winter clothes", date: "2025-11-28", fromAccountId: euroCreditCard.id, categoryId: clothes.id },
    { type: TransactionType.EXPENSE, amount: 399, description: "Black Friday — iPad mini", date: "2025-11-29", fromAccountId: euroCreditCard.id, categoryId: electronics.id, needsReview: true, notes: "30-day return window until 2025-12-29 — check if needed" },

    // Tech (USD)
    { type: TransactionType.EXPENSE, amount: 20, description: "Vercel Pro", date: "2025-11-20", fromAccountId: wiseUsd.id, categoryId: hosting.id, exchangeRate: 0.9520, baseCurrencyAmount: 19.04 },
    { type: TransactionType.EXPENSE, amount: 10, description: "GitHub Copilot", date: "2025-11-20", fromAccountId: wiseUsd.id, categoryId: saas.id, exchangeRate: 0.9520, baseCurrencyAmount: 9.52 },

    // Transfers
    { type: TransactionType.EXPENSE, amount: 500, description: "To savings — monthly transfer", date: "2025-11-06", fromAccountId: mainChecking.id, categoryId: transfer.id },
    { type: TransactionType.INCOME, amount: 500, description: "From checking — monthly transfer", date: "2025-11-06", fromAccountId: euroSavings.id, categoryId: transfer.id },

    // ════════════════════════════════════════════════════════════════════════
    // December 2025
    // ════════════════════════════════════════════════════════════════════════

    // Income
    { type: TransactionType.INCOME, amount: 3500, description: "Monthly Salary", date: "2025-12-05", fromAccountId: mainChecking.id, categoryId: salary.id },
    { type: TransactionType.INCOME, amount: 1000, description: "Year-end bonus", date: "2025-12-20", fromAccountId: mainChecking.id, categoryId: bonus.id },
    { type: TransactionType.INCOME, amount: 12000, description: "Salário — contrato remoto", date: "2025-12-05", fromAccountId: nubankBrl.id, categoryId: salary.id, exchangeRate: 0.1730, baseCurrencyAmount: 2076.00 },

    // Housing
    { type: TransactionType.EXPENSE, amount: 950, description: "Rent December", friendlyName: "Rent", date: "2025-12-01", fromAccountId: mainChecking.id, categoryId: rent.id },
    { type: TransactionType.EXPENSE, amount: 45, description: "Home insurance monthly", friendlyName: "Home Insurance", date: "2025-12-01", fromAccountId: mainChecking.id, categoryId: homeInsurance.id },

    // Food
    { type: TransactionType.EXPENSE, amount: 105.30, description: "Lidl weekly shop", friendlyName: "Lidl", date: "2025-12-06", fromAccountId: mainChecking.id, categoryId: groceries.id },
    { type: TransactionType.EXPENSE, amount: 89.20, description: "Aldi groceries", friendlyName: "Aldi", date: "2025-12-13", fromAccountId: mainChecking.id, categoryId: groceries.id },
    { type: TransactionType.EXPENSE, amount: 120, description: "Christmas dinner", date: "2025-12-25", fromAccountId: euroCreditCard.id, categoryId: restaurants.id },
    { type: TransactionType.EXPENSE, amount: 4.50, description: "Morning coffee", date: "2025-12-03", fromAccountId: mainChecking.id, categoryId: coffee.id },
    { type: TransactionType.EXPENSE, amount: 580, description: "Ceia de Natal", date: "2025-12-24", fromAccountId: nubankBrl.id, categoryId: restaurants.id, exchangeRate: 0.1730, baseCurrencyAmount: 100.34 },

    // Transport
    { type: TransactionType.EXPENSE, amount: 89, description: "Monthly transit pass", date: "2025-12-02", fromAccountId: mainChecking.id, categoryId: publicTransport.id },

    // Utilities
    { type: TransactionType.EXPENSE, amount: 95, description: "Electricity bill", date: "2025-12-10", fromAccountId: mainChecking.id, categoryId: electricity.id },
    { type: TransactionType.EXPENSE, amount: 39.99, description: "Internet subscription", friendlyName: "Internet", date: "2025-12-10", fromAccountId: mainChecking.id, categoryId: internet.id },
    { type: TransactionType.EXPENSE, amount: 25, description: "Phone plan", date: "2025-12-10", fromAccountId: mainChecking.id, categoryId: phone.id },

    // Entertainment
    { type: TransactionType.EXPENSE, amount: 15.99, description: "Netflix", date: "2025-12-05", fromAccountId: mainChecking.id, categoryId: streaming.id },
    { type: TransactionType.EXPENSE, amount: 9.99, description: "Spotify", date: "2025-12-05", fromAccountId: mainChecking.id, categoryId: streaming.id },
    { type: TransactionType.EXPENSE, amount: 65, description: "New Year concert tickets", date: "2025-12-12", fromAccountId: euroCreditCard.id, categoryId: events.id },

    // Shopping — Christmas gifts
    { type: TransactionType.EXPENSE, amount: 280, description: "Christmas gifts", date: "2025-12-20", fromAccountId: euroCreditCard.id, categoryId: gifts.id },

    // Tech (USD)
    { type: TransactionType.EXPENSE, amount: 20, description: "Vercel Pro", date: "2025-12-20", fromAccountId: wiseUsd.id, categoryId: hosting.id, exchangeRate: 0.9550, baseCurrencyAmount: 19.10 },
    { type: TransactionType.EXPENSE, amount: 10, description: "GitHub Copilot", date: "2025-12-20", fromAccountId: wiseUsd.id, categoryId: saas.id, exchangeRate: 0.9550, baseCurrencyAmount: 9.55 },

    // Transfers
    { type: TransactionType.EXPENSE, amount: 500, description: "To savings — monthly transfer", date: "2025-12-06", fromAccountId: mainChecking.id, categoryId: transfer.id },
    { type: TransactionType.INCOME, amount: 500, description: "From checking — monthly transfer", date: "2025-12-06", fromAccountId: euroSavings.id, categoryId: transfer.id },

    // ════════════════════════════════════════════════════════════════════════
    // January 2026
    // ════════════════════════════════════════════════════════════════════════

    // Income
    { type: TransactionType.INCOME, amount: 3500, description: "Monthly Salary", date: "2026-01-05", fromAccountId: mainChecking.id, categoryId: salary.id },
    { type: TransactionType.INCOME, amount: 800, description: "Freelance project — client website", date: "2026-01-15", fromAccountId: wiseUsd.id, categoryId: freelance.id, exchangeRate: 0.9610, baseCurrencyAmount: 768.80 },
    { type: TransactionType.INCOME, amount: 12000, description: "Salário — contrato remoto", date: "2026-01-05", fromAccountId: nubankBrl.id, categoryId: salary.id, exchangeRate: 0.1740, baseCurrencyAmount: 2088.00 },

    // Housing
    { type: TransactionType.EXPENSE, amount: 950, description: "Rent January", friendlyName: "Rent", date: "2026-01-01", fromAccountId: mainChecking.id, categoryId: rent.id },
    { type: TransactionType.EXPENSE, amount: 45, description: "Home insurance monthly", friendlyName: "Home Insurance", date: "2026-01-01", fromAccountId: mainChecking.id, categoryId: homeInsurance.id },

    // Food
    { type: TransactionType.EXPENSE, amount: 85.50, description: "Lidl weekly shop", friendlyName: "Lidl", date: "2026-01-03", fromAccountId: mainChecking.id, categoryId: groceries.id },
    { type: TransactionType.EXPENSE, amount: 62.30, description: "Aldi groceries", friendlyName: "Aldi", date: "2026-01-10", fromAccountId: mainChecking.id, categoryId: groceries.id },
    { type: TransactionType.EXPENSE, amount: 92.10, description: "Jumbo groceries", friendlyName: "Jumbo", date: "2026-01-17", fromAccountId: mainChecking.id, categoryId: groceries.id },
    { type: TransactionType.EXPENSE, amount: 78.40, description: "Lidl weekly shop", friendlyName: "Lidl", date: "2026-01-24", fromAccountId: mainChecking.id, categoryId: groceries.id },
    { type: TransactionType.EXPENSE, amount: 35.00, description: "Pizza night", date: "2026-01-08", fromAccountId: euroCreditCard.id, categoryId: restaurants.id },
    { type: TransactionType.EXPENSE, amount: 48.50, description: "Sushi dinner", date: "2026-01-18", fromAccountId: euroCreditCard.id, categoryId: restaurants.id },
    { type: TransactionType.EXPENSE, amount: 4.50, description: "Morning coffee", date: "2026-01-06", fromAccountId: mainChecking.id, categoryId: coffee.id },
    { type: TransactionType.EXPENSE, amount: 4.50, description: "Morning coffee", date: "2026-01-13", fromAccountId: mainChecking.id, categoryId: coffee.id },
    { type: TransactionType.EXPENSE, amount: 350, description: "Supermercado Extra", date: "2026-01-18", fromAccountId: nubankBrl.id, categoryId: groceries.id, exchangeRate: 0.1740, baseCurrencyAmount: 60.90 },
    { type: TransactionType.EXPENSE, amount: 150, description: "Restaurante japonês", date: "2026-01-22", fromAccountId: nubankBrl.id, categoryId: restaurants.id, exchangeRate: 0.1740, baseCurrencyAmount: 26.10 },

    // Transport
    { type: TransactionType.EXPENSE, amount: 89, description: "Monthly transit pass", date: "2026-01-02", fromAccountId: mainChecking.id, categoryId: publicTransport.id },
    { type: TransactionType.EXPENSE, amount: 55.30, description: "Gas station", date: "2026-01-12", fromAccountId: euroCreditCard.id, categoryId: fuel.id },

    // Utilities
    { type: TransactionType.EXPENSE, amount: 75, description: "Electricity bill", date: "2026-01-10", fromAccountId: mainChecking.id, categoryId: electricity.id },
    { type: TransactionType.EXPENSE, amount: 39.99, description: "Internet subscription", friendlyName: "Internet", date: "2026-01-10", fromAccountId: mainChecking.id, categoryId: internet.id },
    { type: TransactionType.EXPENSE, amount: 25, description: "Phone plan", date: "2026-01-10", fromAccountId: mainChecking.id, categoryId: phone.id },

    // Entertainment
    { type: TransactionType.EXPENSE, amount: 15.99, description: "Netflix", date: "2026-01-05", fromAccountId: mainChecking.id, categoryId: streaming.id },
    { type: TransactionType.EXPENSE, amount: 9.99, description: "Spotify", date: "2026-01-05", fromAccountId: mainChecking.id, categoryId: streaming.id },
    { type: TransactionType.EXPENSE, amount: 59.99, description: "Hollow Knight", date: "2026-01-20", fromAccountId: euroCreditCard.id, categoryId: games.id },

    // Health
    { type: TransactionType.EXPENSE, amount: 12.50, description: "Ibuprofen", date: "2026-01-14", fromAccountId: mainChecking.id, categoryId: pharmacy.id },
    { type: TransactionType.EXPENSE, amount: 120, description: "GP consultation", date: "2026-01-22", fromAccountId: mainChecking.id, categoryId: doctor.id, needsReview: true, notes: "Waiting for health insurance reimbursement (~€80 expected)" },

    // Shopping
    { type: TransactionType.EXPENSE, amount: 120, description: "Winter jacket", date: "2026-01-22", fromAccountId: euroCreditCard.id, categoryId: clothes.id },

    // Tech (USD)
    { type: TransactionType.EXPENSE, amount: 20, description: "Vercel Pro", date: "2026-01-20", fromAccountId: wiseUsd.id, categoryId: hosting.id, exchangeRate: 0.9610, baseCurrencyAmount: 19.22 },
    { type: TransactionType.EXPENSE, amount: 10, description: "GitHub Copilot", date: "2026-01-20", fromAccountId: wiseUsd.id, categoryId: saas.id, exchangeRate: 0.9610, baseCurrencyAmount: 9.61 },

    // Transfers
    { type: TransactionType.EXPENSE, amount: 500, description: "To savings — monthly transfer", date: "2026-01-06", fromAccountId: mainChecking.id, categoryId: transfer.id },
    { type: TransactionType.INCOME, amount: 500, description: "From checking — monthly transfer", date: "2026-01-06", fromAccountId: euroSavings.id, categoryId: transfer.id },
    { type: TransactionType.EXPENSE, amount: 200, description: "EUR → USD via Wise", date: "2026-01-10", fromAccountId: mainChecking.id, categoryId: transfer.id },
    { type: TransactionType.INCOME, amount: 200, description: "USD from EUR exchange", date: "2026-01-10", fromAccountId: wiseUsd.id, categoryId: transfer.id },

    // Proxy — concert tickets for João (reimbursed in February)
    { type: TransactionType.EXPENSE, amount: 80, description: "Concert tickets for João", date: "2026-01-25", fromAccountId: euroCreditCard.id, categoryId: proxy.id, needsReview: true, notes: "2 tickets × €40 — João will pay back in Feb" },

    // ════════════════════════════════════════════════════════════════════════
    // February 2026
    // ════════════════════════════════════════════════════════════════════════

    // Income
    { type: TransactionType.INCOME, amount: 3500, description: "Monthly Salary", date: "2026-02-05", fromAccountId: mainChecking.id, categoryId: salary.id },
    { type: TransactionType.INCOME, amount: 80, description: "Health insurance reimbursement — GP Jan", date: "2026-02-12", fromAccountId: mainChecking.id, categoryId: doctor.id, notes: "Partial reimbursement for 2026-01-22 GP consultation" },
    { type: TransactionType.INCOME, amount: 80, description: "João — concert tickets reimbursement", date: "2026-02-14", fromAccountId: mainChecking.id, categoryId: proxy.id },
    { type: TransactionType.INCOME, amount: 1200, description: "Freelance project — e-commerce build", date: "2026-02-10", fromAccountId: wiseUsd.id, categoryId: freelance.id, exchangeRate: 0.9580, baseCurrencyAmount: 1149.60 },
    { type: TransactionType.INCOME, amount: 12000, description: "Salário — contrato remoto", date: "2026-02-05", fromAccountId: nubankBrl.id, categoryId: salary.id, exchangeRate: 0.1725, baseCurrencyAmount: 2070.00 },

    // Housing
    { type: TransactionType.EXPENSE, amount: 950, description: "Rent February", friendlyName: "Rent", date: "2026-02-01", fromAccountId: mainChecking.id, categoryId: rent.id },
    { type: TransactionType.EXPENSE, amount: 45, description: "Home insurance monthly", friendlyName: "Home Insurance", date: "2026-02-01", fromAccountId: mainChecking.id, categoryId: homeInsurance.id },
    { type: TransactionType.EXPENSE, amount: 150, description: "Plumber repair", date: "2026-02-08", fromAccountId: mainChecking.id, categoryId: maintenance.id },

    // Food
    { type: TransactionType.EXPENSE, amount: 95.20, description: "Lidl weekly shop", friendlyName: "Lidl", date: "2026-02-01", fromAccountId: mainChecking.id, categoryId: groceries.id },
    { type: TransactionType.EXPENSE, amount: 72.80, description: "Aldi groceries", friendlyName: "Aldi", date: "2026-02-08", fromAccountId: mainChecking.id, categoryId: groceries.id },
    { type: TransactionType.EXPENSE, amount: 42.00, description: "Thai restaurant", date: "2026-02-06", fromAccountId: euroCreditCard.id, categoryId: restaurants.id },
    { type: TransactionType.EXPENSE, amount: 4.50, description: "Morning coffee", date: "2026-02-03", fromAccountId: mainChecking.id, categoryId: coffee.id },
    { type: TransactionType.EXPENSE, amount: 280, description: "Supermercado Pão de Açúcar", date: "2026-02-15", fromAccountId: nubankBrl.id, categoryId: groceries.id, exchangeRate: 0.1725, baseCurrencyAmount: 48.30 },
    { type: TransactionType.EXPENSE, amount: 200, description: "Rodízio de churrasco", date: "2026-02-22", fromAccountId: nubankBrl.id, categoryId: restaurants.id, exchangeRate: 0.1725, baseCurrencyAmount: 34.50 },

    // Transport
    { type: TransactionType.EXPENSE, amount: 89, description: "Monthly transit pass", date: "2026-02-01", fromAccountId: mainChecking.id, categoryId: publicTransport.id },
    { type: TransactionType.EXPENSE, amount: 48.70, description: "Gas station", date: "2026-02-05", fromAccountId: euroCreditCard.id, categoryId: fuel.id },

    // Utilities
    { type: TransactionType.EXPENSE, amount: 82, description: "Electricity bill", date: "2026-02-10", fromAccountId: mainChecking.id, categoryId: electricity.id },
    { type: TransactionType.EXPENSE, amount: 39.99, description: "Internet subscription", friendlyName: "Internet", date: "2026-02-10", fromAccountId: mainChecking.id, categoryId: internet.id },
    { type: TransactionType.EXPENSE, amount: 25, description: "Phone plan", date: "2026-02-10", fromAccountId: mainChecking.id, categoryId: phone.id },

    // Entertainment
    { type: TransactionType.EXPENSE, amount: 15.99, description: "Netflix", date: "2026-02-05", fromAccountId: mainChecking.id, categoryId: streaming.id },
    { type: TransactionType.EXPENSE, amount: 9.99, description: "Spotify", date: "2026-02-05", fromAccountId: mainChecking.id, categoryId: streaming.id },

    // Health
    { type: TransactionType.EXPENSE, amount: 85, description: "Dentist checkup", date: "2026-02-04", fromAccountId: mainChecking.id, categoryId: doctor.id, needsReview: true, notes: "Check if annual dental plan covers this" },

    // Shopping
    { type: TransactionType.EXPENSE, amount: 249, description: "Wireless headphones", date: "2026-02-03", fromAccountId: euroCreditCard.id, categoryId: electronics.id, needsReview: true, notes: "Might return — 30-day return window until 2026-03-04" },

    // Tech (USD)
    { type: TransactionType.EXPENSE, amount: 20, description: "Vercel Pro", date: "2026-02-20", fromAccountId: wiseUsd.id, categoryId: hosting.id, exchangeRate: 0.9580, baseCurrencyAmount: 19.16 },
    { type: TransactionType.EXPENSE, amount: 10, description: "GitHub Copilot", date: "2026-02-20", fromAccountId: wiseUsd.id, categoryId: saas.id, exchangeRate: 0.9580, baseCurrencyAmount: 9.58 },

    // Transfers
    { type: TransactionType.EXPENSE, amount: 500, description: "To savings — monthly transfer", date: "2026-02-06", fromAccountId: mainChecking.id, categoryId: transfer.id },
    { type: TransactionType.INCOME, amount: 500, description: "From checking — monthly transfer", date: "2026-02-06", fromAccountId: euroSavings.id, categoryId: transfer.id },

    // Proxy — neighbour Ana groceries (outstanding, not yet reimbursed)
    { type: TransactionType.EXPENSE, amount: 45, description: "Groceries for neighbour Ana", date: "2026-02-20", fromAccountId: mainChecking.id, categoryId: proxy.id, needsReview: true, notes: "Ana will pay back — remind her" },

    // ════════════════════════════════════════════════════════════════════════
    // March 2026
    // ════════════════════════════════════════════════════════════════════════

    // Income
    { type: TransactionType.INCOME, amount: 3500, description: "Monthly Salary", date: "2026-03-05", fromAccountId: mainChecking.id, categoryId: salary.id },
    { type: TransactionType.INCOME, amount: 650, description: "Freelance project — landing page", date: "2026-03-08", fromAccountId: wiseUsd.id, categoryId: freelance.id, exchangeRate: 0.9625, baseCurrencyAmount: 625.63 },
    { type: TransactionType.INCOME, amount: 12000, description: "Salário — contrato remoto", date: "2026-03-05", fromAccountId: nubankBrl.id, categoryId: salary.id, exchangeRate: 0.1710, baseCurrencyAmount: 2052.00 },

    // Housing
    { type: TransactionType.EXPENSE, amount: 950, description: "Rent March", friendlyName: "Rent", date: "2026-03-01", fromAccountId: mainChecking.id, categoryId: rent.id },
    { type: TransactionType.EXPENSE, amount: 45, description: "Home insurance monthly", friendlyName: "Home Insurance", date: "2026-03-01", fromAccountId: mainChecking.id, categoryId: homeInsurance.id },

    // Food
    { type: TransactionType.EXPENSE, amount: 88.60, description: "Lidl weekly shop", friendlyName: "Lidl", date: "2026-03-01", fromAccountId: mainChecking.id, categoryId: groceries.id },
    { type: TransactionType.EXPENSE, amount: 67.40, description: "Aldi groceries", friendlyName: "Aldi", date: "2026-03-08", fromAccountId: mainChecking.id, categoryId: groceries.id },
    { type: TransactionType.EXPENSE, amount: 55.90, description: "Restaurant — birthday dinner", date: "2026-03-07", fromAccountId: euroCreditCard.id, categoryId: restaurants.id },
    { type: TransactionType.EXPENSE, amount: 4.50, description: "Morning coffee", date: "2026-03-03", fromAccountId: mainChecking.id, categoryId: coffee.id },
    { type: TransactionType.EXPENSE, amount: 420, description: "Supermercado Extra", date: "2026-03-15", fromAccountId: nubankBrl.id, categoryId: groceries.id, exchangeRate: 0.1710, baseCurrencyAmount: 71.82 },

    // Transport
    { type: TransactionType.EXPENSE, amount: 89, description: "Monthly transit pass", date: "2026-03-01", fromAccountId: mainChecking.id, categoryId: publicTransport.id },

    // Utilities
    { type: TransactionType.EXPENSE, amount: 70, description: "Electricity bill", date: "2026-03-10", fromAccountId: mainChecking.id, categoryId: electricity.id },
    { type: TransactionType.EXPENSE, amount: 39.99, description: "Internet subscription", friendlyName: "Internet", date: "2026-03-10", fromAccountId: mainChecking.id, categoryId: internet.id },
    { type: TransactionType.EXPENSE, amount: 25, description: "Phone plan", date: "2026-03-10", fromAccountId: mainChecking.id, categoryId: phone.id },

    // Entertainment
    { type: TransactionType.EXPENSE, amount: 15.99, description: "Netflix", date: "2026-03-05", fromAccountId: mainChecking.id, categoryId: streaming.id },
    { type: TransactionType.EXPENSE, amount: 9.99, description: "Spotify", date: "2026-03-05", fromAccountId: mainChecking.id, categoryId: streaming.id },

    // Tech (USD)
    { type: TransactionType.EXPENSE, amount: 20, description: "Vercel Pro", date: "2026-03-20", fromAccountId: wiseUsd.id, categoryId: hosting.id, exchangeRate: 0.9625, baseCurrencyAmount: 19.25 },
    { type: TransactionType.EXPENSE, amount: 10, description: "GitHub Copilot", date: "2026-03-20", fromAccountId: wiseUsd.id, categoryId: saas.id, exchangeRate: 0.9625, baseCurrencyAmount: 9.63 },

    // Transfers
    { type: TransactionType.EXPENSE, amount: 500, description: "To savings — monthly transfer", date: "2026-03-06", fromAccountId: mainChecking.id, categoryId: transfer.id },
    { type: TransactionType.INCOME, amount: 500, description: "From checking — monthly transfer", date: "2026-03-06", fromAccountId: euroSavings.id, categoryId: transfer.id },
  ];

  for (const tx of transactions) {
    await prisma.transaction.create({
      data: {
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        friendlyName: tx.friendlyName ?? null,
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
    `  ✓ Transactions: ${transactions.length} records across 6 months (${needsReviewCount} flagged for review, ${multicurrencyCount} with exchange rate)`
  );

  // ----------------------------------------------------------
  // 6. Category Rules — auto-categorization during import
  // ----------------------------------------------------------
  // These rules are applied in priority order (higher = first).
  // They demonstrate the auto-categorization feature during CSV import.

  const rules = [
    { pattern: "Lidl",            matchType: MatchType.STARTS_WITH, categoryId: groceries.id,  friendlyName: "Lidl",           priority: 10 },
    { pattern: "Aldi",            matchType: MatchType.STARTS_WITH, categoryId: groceries.id,  friendlyName: "Aldi",           priority: 10 },
    { pattern: "Jumbo",           matchType: MatchType.STARTS_WITH, categoryId: groceries.id,  friendlyName: "Jumbo",          priority: 10 },
    { pattern: "Supermercado",    matchType: MatchType.STARTS_WITH, categoryId: groceries.id,  friendlyName: null,             priority: 8  },
    { pattern: "Netflix",         matchType: MatchType.CONTAINS,    categoryId: streaming.id,  friendlyName: "Netflix",        priority: 10 },
    { pattern: "Spotify",         matchType: MatchType.CONTAINS,    categoryId: streaming.id,  friendlyName: "Spotify",        priority: 10 },
    { pattern: "Vercel",          matchType: MatchType.CONTAINS,    categoryId: hosting.id,    friendlyName: "Vercel Pro",     priority: 10 },
    { pattern: "GitHub Copilot",  matchType: MatchType.CONTAINS,    categoryId: saas.id,       friendlyName: "GitHub Copilot", priority: 10 },
    { pattern: "Salário",         matchType: MatchType.STARTS_WITH, categoryId: salary.id,     friendlyName: null,             priority: 5  },
    { pattern: "Monthly Salary",  matchType: MatchType.EXACT,       categoryId: salary.id,     friendlyName: null,             priority: 5  },
  ];

  for (const rule of rules) {
    await prisma.categoryRule.create({ data: rule });
  }

  console.log(`  ✓ Category Rules: ${rules.length} rules for auto-categorization`);

  // ----------------------------------------------------------
  // 7. Budgets — 2025 and 2026
  // ----------------------------------------------------------

  const budgetEntries = [
    // 2025
    { year: 2025, categoryId: housing.id,       amount: 12000 },
    { year: 2025, categoryId: food.id,           amount: 6000  },
    { year: 2025, categoryId: transport.id,      amount: 2400  },
    { year: 2025, categoryId: utilities.id,      amount: 1800  },
    { year: 2025, categoryId: entertainment.id,  amount: 1200  },
    { year: 2025, categoryId: health.id,         amount: 1200  },
    { year: 2025, categoryId: shopping.id,       amount: 3600  },
    { year: 2025, categoryId: tech.id,           amount: 600   },
    // 2026
    { year: 2026, categoryId: housing.id,        amount: 12000 },
    { year: 2026, categoryId: food.id,           amount: 6000  },
    { year: 2026, categoryId: transport.id,      amount: 2400  },
    { year: 2026, categoryId: utilities.id,      amount: 1800  },
    { year: 2026, categoryId: entertainment.id,  amount: 1200  },
    { year: 2026, categoryId: health.id,         amount: 1200  },
    { year: 2026, categoryId: shopping.id,       amount: 3600  },
    { year: 2026, categoryId: tech.id,           amount: 600   },
  ];

  for (const budget of budgetEntries) {
    await prisma.budget.upsert({
      where: { year_categoryId: { year: budget.year, categoryId: budget.categoryId } },
      update: { amount: budget.amount },
      create: { ...budget },
    });
  }

  console.log(`  ✓ Budgets: ${budgetEntries.length} entries (2025 + 2026)`);

  console.log(`
  Demo state after seed:
    Default currency:  EUR (isDefault = true)
    Months of data:    Oct 2025 – Mar 2026 (6 months)
    Transfer balance:  €0    (all transfer legs matched)
    Proxy balance:    -€45   (João settled, neighbour Ana outstanding)
    Needs review:      5 transactions

  Categories:
    9 parent categories with icons, colors, and 50·30·20 buckets
    NEEDS: Housing, Food, Transport, Utilities, Health
    WANTS: Entertainment, Shopping, Tech & Software

  Multi-currency:
    USD: freelance income (Oct/Jan/Feb/Mar) + SaaS tools (all months)
    BRL: salary (all months) + groceries/restaurants

  Auto-categorization:
    10 rules covering Lidl, Aldi, Jumbo, Netflix, Spotify,
    Vercel, GitHub Copilot, Supermercado, Salary
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
