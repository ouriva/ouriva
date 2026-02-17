// ============================================================
// Database Seed Script
// ============================================================
// Populates the database with initial reference data and sample
// transactions for development. Run with: npx prisma db seed
//
// This script is IDEMPOTENT — it uses upsert (update-or-create)
// so running it multiple times won't create duplicates.
// ============================================================

import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TransactionType } from "../src/generated/prisma/client.js";

// Prisma 7 uses driver adapters instead of a built-in engine.
// We create a pg Pool (standard Node.js PostgreSQL driver) and
// wrap it with PrismaPg so Prisma can use it.
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...\n");

  // ----------------------------------------------------------
  // 1. Currencies
  // ----------------------------------------------------------
  // Using upsert: if a record with this unique field exists,
  // update it; otherwise create it. This makes the seed safe
  // to run multiple times.

  const eur = await prisma.currency.upsert({
    where: { code: "EUR" },
    update: {},
    create: { code: "EUR", name: "Euro", symbol: "€" },
  });

  const usd = await prisma.currency.upsert({
    where: { code: "USD" },
    update: {},
    create: { code: "USD", name: "US Dollar", symbol: "$" },
  });

  const brl = await prisma.currency.upsert({
    where: { code: "BRL" },
    update: {},
    create: { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  });

  console.log(`  ✓ Currencies: ${eur.code}, ${usd.code}, ${brl.code}`);

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
  // We can't upsert by name (it's not unique), so we use
  // deleteMany + create for accounts and below.
  // The seed is meant to reset to a known state.

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
  // Created in two passes: parents first, then children
  // (because children reference parent IDs).

  // --- Parent categories ---
  const housing = await prisma.category.create({
    data: { name: "Housing" },
  });
  const food = await prisma.category.create({
    data: { name: "Food" },
  });
  const transport = await prisma.category.create({
    data: { name: "Transport" },
  });
  const utilities = await prisma.category.create({
    data: { name: "Utilities" },
  });
  const entertainment = await prisma.category.create({
    data: { name: "Entertainment" },
  });
  const health = await prisma.category.create({
    data: { name: "Health" },
  });
  const shopping = await prisma.category.create({
    data: { name: "Shopping" },
  });
  const income = await prisma.category.create({
    data: { name: "Income" },
  });

  // --- Child categories ---
  const rent = await prisma.category.create({
    data: { name: "Rent", parentId: housing.id },
  });
  const homeInsurance = await prisma.category.create({
    data: { name: "Home Insurance", parentId: housing.id },
  });
  const maintenance = await prisma.category.create({
    data: { name: "Maintenance", parentId: housing.id },
  });

  const groceries = await prisma.category.create({
    data: { name: "Groceries", parentId: food.id },
  });
  const restaurants = await prisma.category.create({
    data: { name: "Restaurants", parentId: food.id },
  });
  const coffee = await prisma.category.create({
    data: { name: "Coffee & Snacks", parentId: food.id },
  });

  const publicTransport = await prisma.category.create({
    data: { name: "Public Transport", parentId: transport.id },
  });
  const fuel = await prisma.category.create({
    data: { name: "Fuel", parentId: transport.id },
  });
  const carInsurance = await prisma.category.create({
    data: { name: "Car Insurance", parentId: transport.id },
  });

  const electricity = await prisma.category.create({
    data: { name: "Electricity", parentId: utilities.id },
  });
  const internet = await prisma.category.create({
    data: { name: "Internet", parentId: utilities.id },
  });
  const phone = await prisma.category.create({
    data: { name: "Phone", parentId: utilities.id },
  });

  const streaming = await prisma.category.create({
    data: { name: "Streaming", parentId: entertainment.id },
  });
  const games = await prisma.category.create({
    data: { name: "Games", parentId: entertainment.id },
  });

  const pharmacy = await prisma.category.create({
    data: { name: "Pharmacy", parentId: health.id },
  });
  const doctor = await prisma.category.create({
    data: { name: "Doctor", parentId: health.id },
  });

  const clothes = await prisma.category.create({
    data: { name: "Clothes", parentId: shopping.id },
  });
  const electronics = await prisma.category.create({
    data: { name: "Electronics", parentId: shopping.id },
  });

  const salary = await prisma.category.create({
    data: { name: "Salary", parentId: income.id },
  });
  const freelance = await prisma.category.create({
    data: { name: "Freelance", parentId: income.id },
  });

  console.log(
    `  ✓ Categories: 8 parents, 20 children`
  );

  // ----------------------------------------------------------
  // 5. Transactions
  // ----------------------------------------------------------
  // Sample transactions spread across Jan-Feb 2026 to simulate
  // real usage. Amounts are always positive; the type determines
  // direction (INCOME adds, EXPENSE subtracts).

  const transactions = [
    // --- January 2026 Income ---
    { type: TransactionType.INCOME, amount: 3500, description: "Monthly Salary", date: "2026-01-05", fromAccountId: mainChecking.id, categoryId: salary.id },
    { type: TransactionType.INCOME, amount: 800, description: "Freelance project", date: "2026-01-15", fromAccountId: wiseUsd.id, categoryId: freelance.id },

    // --- January 2026 Housing ---
    { type: TransactionType.EXPENSE, amount: 950, description: "Rent January", date: "2026-01-01", fromAccountId: mainChecking.id, categoryId: rent.id },
    { type: TransactionType.EXPENSE, amount: 45, description: "Home insurance", date: "2026-01-01", fromAccountId: mainChecking.id, categoryId: homeInsurance.id },

    // --- January 2026 Food ---
    { type: TransactionType.EXPENSE, amount: 85.50, description: "Lidl weekly shop", date: "2026-01-03", fromAccountId: mainChecking.id, categoryId: groceries.id },
    { type: TransactionType.EXPENSE, amount: 62.30, description: "Aldi groceries", date: "2026-01-10", fromAccountId: mainChecking.id, categoryId: groceries.id },
    { type: TransactionType.EXPENSE, amount: 92.10, description: "Jumbo groceries", date: "2026-01-17", fromAccountId: mainChecking.id, categoryId: groceries.id },
    { type: TransactionType.EXPENSE, amount: 78.40, description: "Weekly groceries", date: "2026-01-24", fromAccountId: mainChecking.id, categoryId: groceries.id },
    { type: TransactionType.EXPENSE, amount: 35.00, description: "Pizza night", date: "2026-01-08", fromAccountId: euroCreditCard.id, categoryId: restaurants.id },
    { type: TransactionType.EXPENSE, amount: 48.50, description: "Sushi dinner", date: "2026-01-18", fromAccountId: euroCreditCard.id, categoryId: restaurants.id },
    { type: TransactionType.EXPENSE, amount: 4.50, description: "Morning coffee", date: "2026-01-06", fromAccountId: mainChecking.id, categoryId: coffee.id },
    { type: TransactionType.EXPENSE, amount: 4.50, description: "Morning coffee", date: "2026-01-13", fromAccountId: mainChecking.id, categoryId: coffee.id },

    // --- January 2026 Transport ---
    { type: TransactionType.EXPENSE, amount: 89, description: "Monthly transit pass", date: "2026-01-02", fromAccountId: mainChecking.id, categoryId: publicTransport.id },
    { type: TransactionType.EXPENSE, amount: 55.30, description: "Gas station", date: "2026-01-12", fromAccountId: euroCreditCard.id, categoryId: fuel.id },

    // --- January 2026 Utilities ---
    { type: TransactionType.EXPENSE, amount: 75, description: "Electricity bill", date: "2026-01-10", fromAccountId: mainChecking.id, categoryId: electricity.id },
    { type: TransactionType.EXPENSE, amount: 39.99, description: "Internet", date: "2026-01-10", fromAccountId: mainChecking.id, categoryId: internet.id },
    { type: TransactionType.EXPENSE, amount: 25, description: "Phone plan", date: "2026-01-10", fromAccountId: mainChecking.id, categoryId: phone.id },

    // --- January 2026 Entertainment ---
    { type: TransactionType.EXPENSE, amount: 15.99, description: "Netflix", date: "2026-01-05", fromAccountId: mainChecking.id, categoryId: streaming.id },
    { type: TransactionType.EXPENSE, amount: 9.99, description: "Spotify", date: "2026-01-05", fromAccountId: mainChecking.id, categoryId: streaming.id },
    { type: TransactionType.EXPENSE, amount: 59.99, description: "New game", date: "2026-01-20", fromAccountId: euroCreditCard.id, categoryId: games.id },

    // --- January 2026 Health ---
    { type: TransactionType.EXPENSE, amount: 12.50, description: "Ibuprofen", date: "2026-01-14", fromAccountId: mainChecking.id, categoryId: pharmacy.id },

    // --- January 2026 Shopping ---
    { type: TransactionType.EXPENSE, amount: 120, description: "Winter jacket", date: "2026-01-22", fromAccountId: euroCreditCard.id, categoryId: clothes.id },

    // --- January 2026 Transfers ---
    { type: TransactionType.TRANSFER, amount: 500, description: "To savings", date: "2026-01-06", fromAccountId: mainChecking.id, toAccountId: euroSavings.id },
    { type: TransactionType.TRANSFER, amount: 200, description: "EUR to USD", date: "2026-01-10", fromAccountId: mainChecking.id, toAccountId: wiseUsd.id, toAmount: 218.50 },

    // --- February 2026 Income ---
    { type: TransactionType.INCOME, amount: 3500, description: "Monthly Salary", date: "2026-02-05", fromAccountId: mainChecking.id, categoryId: salary.id },

    // --- February 2026 Housing ---
    { type: TransactionType.EXPENSE, amount: 950, description: "Rent February", date: "2026-02-01", fromAccountId: mainChecking.id, categoryId: rent.id },
    { type: TransactionType.EXPENSE, amount: 45, description: "Home insurance", date: "2026-02-01", fromAccountId: mainChecking.id, categoryId: homeInsurance.id },
    { type: TransactionType.EXPENSE, amount: 150, description: "Plumber repair", date: "2026-02-08", fromAccountId: mainChecking.id, categoryId: maintenance.id },

    // --- February 2026 Food ---
    { type: TransactionType.EXPENSE, amount: 95.20, description: "Lidl weekly shop", date: "2026-02-01", fromAccountId: mainChecking.id, categoryId: groceries.id },
    { type: TransactionType.EXPENSE, amount: 72.80, description: "Aldi groceries", date: "2026-02-08", fromAccountId: mainChecking.id, categoryId: groceries.id },
    { type: TransactionType.EXPENSE, amount: 42.00, description: "Thai restaurant", date: "2026-02-06", fromAccountId: euroCreditCard.id, categoryId: restaurants.id },
    { type: TransactionType.EXPENSE, amount: 4.50, description: "Morning coffee", date: "2026-02-03", fromAccountId: mainChecking.id, categoryId: coffee.id },

    // --- February 2026 Transport ---
    { type: TransactionType.EXPENSE, amount: 89, description: "Monthly transit pass", date: "2026-02-01", fromAccountId: mainChecking.id, categoryId: publicTransport.id },
    { type: TransactionType.EXPENSE, amount: 48.70, description: "Gas station", date: "2026-02-05", fromAccountId: euroCreditCard.id, categoryId: fuel.id },

    // --- February 2026 Utilities ---
    { type: TransactionType.EXPENSE, amount: 82, description: "Electricity bill", date: "2026-02-10", fromAccountId: mainChecking.id, categoryId: electricity.id },
    { type: TransactionType.EXPENSE, amount: 39.99, description: "Internet", date: "2026-02-10", fromAccountId: mainChecking.id, categoryId: internet.id },
    { type: TransactionType.EXPENSE, amount: 25, description: "Phone plan", date: "2026-02-10", fromAccountId: mainChecking.id, categoryId: phone.id },

    // --- February 2026 Entertainment ---
    { type: TransactionType.EXPENSE, amount: 15.99, description: "Netflix", date: "2026-02-05", fromAccountId: mainChecking.id, categoryId: streaming.id },
    { type: TransactionType.EXPENSE, amount: 9.99, description: "Spotify", date: "2026-02-05", fromAccountId: mainChecking.id, categoryId: streaming.id },

    // --- February 2026 Health ---
    { type: TransactionType.EXPENSE, amount: 85, description: "Dentist checkup", date: "2026-02-04", fromAccountId: mainChecking.id, categoryId: doctor.id },

    // --- February 2026 Shopping ---
    { type: TransactionType.EXPENSE, amount: 249, description: "Wireless headphones", date: "2026-02-03", fromAccountId: euroCreditCard.id, categoryId: electronics.id },

    // --- February 2026 Transfers ---
    { type: TransactionType.TRANSFER, amount: 500, description: "To savings", date: "2026-02-06", fromAccountId: mainChecking.id, toAccountId: euroSavings.id },
  ];

  for (const tx of transactions) {
    await prisma.transaction.create({
      data: {
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        date: new Date(tx.date),
        fromAccountId: tx.fromAccountId,
        toAccountId: tx.toAccountId ?? undefined,
        toAmount: tx.toAmount ?? undefined,
        categoryId: tx.categoryId ?? undefined,
      },
    });
  }

  console.log(`  ✓ Transactions: ${transactions.length} records`);

  // ----------------------------------------------------------
  // 6. Budgets (2026)
  // ----------------------------------------------------------
  // Annual budget per category. We set budgets on parent
  // categories — the app will aggregate children into these.

  const budgets = [
    { year: 2026, categoryId: housing.id, amount: 12000 },
    { year: 2026, categoryId: food.id, amount: 6000 },
    { year: 2026, categoryId: transport.id, amount: 2400 },
    { year: 2026, categoryId: utilities.id, amount: 1800 },
    { year: 2026, categoryId: entertainment.id, amount: 1200 },
    { year: 2026, categoryId: health.id, amount: 1200 },
    { year: 2026, categoryId: shopping.id, amount: 3600 },
  ];

  for (const budget of budgets) {
    await prisma.budget.upsert({
      where: {
        year_categoryId: {
          year: budget.year,
          categoryId: budget.categoryId,
        },
      },
      update: { amount: budget.amount },
      create: budget,
    });
  }

  console.log(`  ✓ Budgets: ${budgets.length} entries for 2026`);

  console.log("\n✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
