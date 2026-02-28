// ============================================================
// Database Seed Script
// ============================================================
// Populates the database with initial reference data and sample
// transactions for development. Run with: npx prisma db seed
//
// What is seeded:
//   - Currencies, account types, accounts
//   - Full category tree (parents + children)
//   - Two special categories configured in AppSettings:
//       · Transfer  — excluded from summaries (transfers between accounts)
//       · On Behalf Of Others — excluded from summaries (proxy purchases)
//   - Transactions across Jan–Feb 2026:
//       · Regular expenses and income
//       · Transfers using the Transfer category
//       · Proxy purchases: one settled (balance €0), one outstanding
//       · Health insurance reimbursement via same-category approach
//       · Several transactions flagged as needsReview
//   - Annual budgets for 2026
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
  // Two passes: parents first, then children (children reference parent IDs).
  // Two special parent categories are created for AppSettings:
  //   · transfer — excluded from summaries (account-to-account moves)
  //   · proxy    — excluded from summaries (on-behalf-of-others purchases)

  // --- Special categories (no children, configured in AppSettings) ---
  const transfer = await prisma.category.create({
    data: { name: "Transfer" },
  });

  const proxy = await prisma.category.create({
    data: { name: "On Behalf Of Others" },
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

  console.log(`  ✓ Categories: 2 special + 8 parents + 20 children`);

  // ----------------------------------------------------------
  // 5. App Settings
  // ----------------------------------------------------------
  // Configure the two special categories so summaries exclude them.
  // This mirrors what a user would set in Settings > General.

  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: {
      transferCategoryId: transfer.id,
      proxyCategoryId: proxy.id,
    },
    create: {
      id: "singleton",
      transferCategoryId: transfer.id,
      proxyCategoryId: proxy.id,
    },
  });

  console.log(`  ✓ AppSettings: Transfer = "${transfer.name}", Proxy = "${proxy.name}"`);

  // ----------------------------------------------------------
  // 6. Transactions
  // ----------------------------------------------------------
  // Spread across Jan–Feb 2026 to populate both monthly and annual views.
  //
  // Special scenarios included:
  //
  //   TRANSFERS (Transfer category — excluded from summaries)
  //     Both the "send" and "receive" sides are recorded, so the
  //     transfer balance should be €0.
  //
  //   PROXY PURCHASES (On Behalf Of Others — excluded from summaries)
  //     · Settled:    Concert tickets for João — paid Jan, reimbursed Feb → balance €0
  //     · Unsettled:  Groceries for neighbour — paid Feb, not reimbursed yet → balance -€45
  //     The proxy balance should show -€45 (outstanding).
  //
  //   HEALTH REIMBURSEMENT (same-category approach — stays in summaries)
  //     · Jan: Doctor visit €120 (EXPENSE, Health > Doctor, needsReview while waiting for insurance)
  //     · Feb: Insurance reimbursement €80 (INCOME, Health > Doctor)
  //     The monthly income tab in February will show €80 under Health > Doctor.
  //
  //   NEEDS REVIEW (needsReview: true)
  //     Several transactions flagged for follow-up, visible via the
  //     "Needs review" filter in the transaction list.

  type TxInput = {
    type: TransactionType;
    amount: number;
    description: string;
    date: string;
    fromAccountId: string;
    categoryId?: string;
    needsReview?: boolean;
    notes?: string;
  };

  const transactions: TxInput[] = [
    // ── January 2026: Income ──────────────────────────────────────────────
    {
      type: TransactionType.INCOME,
      amount: 3500,
      description: "Monthly Salary",
      date: "2026-01-05",
      fromAccountId: mainChecking.id,
      categoryId: salary.id,
    },
    {
      type: TransactionType.INCOME,
      amount: 800,
      description: "Freelance project - client website",
      date: "2026-01-15",
      fromAccountId: wiseUsd.id,
      categoryId: freelance.id,
    },

    // ── January 2026: Housing ─────────────────────────────────────────────
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

    // ── January 2026: Food ────────────────────────────────────────────────
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

    // ── January 2026: Transport ───────────────────────────────────────────
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

    // ── January 2026: Utilities ───────────────────────────────────────────
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

    // ── January 2026: Entertainment ───────────────────────────────────────
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
      description: "New game - Hollow Knight",
      date: "2026-01-20",
      fromAccountId: euroCreditCard.id,
      categoryId: games.id,
    },

    // ── January 2026: Health ──────────────────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 12.50,
      description: "Ibuprofen",
      date: "2026-01-14",
      fromAccountId: mainChecking.id,
      categoryId: pharmacy.id,
    },
    // Doctor visit — marked needsReview while waiting for insurance reimbursement.
    // The insurance pays back partially in February (see below).
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

    // ── January 2026: Shopping ────────────────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 120,
      description: "Winter jacket",
      date: "2026-01-22",
      fromAccountId: euroCreditCard.id,
      categoryId: clothes.id,
    },

    // ── January 2026: Transfers (Transfer category — excluded from summaries) ──
    // Both legs of each transfer are recorded so the net balance stays at €0.
    // "To savings" — money leaves checking, arrives at savings.
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
    // "EUR to USD" — currency exchange via Wise.
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

    // ── January 2026: Proxy purchases (On Behalf Of Others — excluded from summaries) ──
    // SCENARIO: Concert tickets for João. Paid in January, João reimburses in February.
    // After reimbursement the proxy balance contribution from this is €0.
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

    // ── February 2026: Income ─────────────────────────────────────────────
    {
      type: TransactionType.INCOME,
      amount: 3500,
      description: "Monthly Salary",
      date: "2026-02-05",
      fromAccountId: mainChecking.id,
      categoryId: salary.id,
    },
    // Health insurance reimbursement — categorised under Health > Doctor
    // so the summary income tab shows the net cost of the January GP visit.
    // €120 expense in Jan, €80 reimbursed in Feb → net cost €40 visible in category view.
    {
      type: TransactionType.INCOME,
      amount: 80,
      description: "Health insurance reimbursement — GP Jan",
      date: "2026-02-12",
      fromAccountId: mainChecking.id,
      categoryId: doctor.id,
      notes: "Partial reimbursement for 2026-01-22 GP consultation",
    },
    // João reimburses for concert tickets — proxy balance for João now €0.
    {
      type: TransactionType.INCOME,
      amount: 80,
      description: "João — concert tickets reimbursement",
      date: "2026-02-14",
      fromAccountId: mainChecking.id,
      categoryId: proxy.id,
    },

    // ── February 2026: Housing ────────────────────────────────────────────
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

    // ── February 2026: Food ───────────────────────────────────────────────
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

    // ── February 2026: Transport ──────────────────────────────────────────
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

    // ── February 2026: Utilities ──────────────────────────────────────────
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

    // ── February 2026: Entertainment ──────────────────────────────────────
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

    // ── February 2026: Health ─────────────────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 85,
      description: "Dentist checkup",
      date: "2026-02-04",
      fromAccountId: mainChecking.id,
      categoryId: doctor.id,
      // Marked for review — need to check if insurance covers any of this
      needsReview: true,
      notes: "Check if annual dental plan covers this",
    },

    // ── February 2026: Shopping ───────────────────────────────────────────
    {
      type: TransactionType.EXPENSE,
      amount: 249,
      description: "Wireless headphones",
      date: "2026-02-03",
      fromAccountId: euroCreditCard.id,
      categoryId: electronics.id,
      // Marked for review — considering returning them
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

    // ── February 2026: Proxy purchases (outstanding — proxy balance = -€45) ──
    // SCENARIO: Bought groceries for the neighbour. Not reimbursed yet.
    // This makes the proxy balance -€45, showing in amber in Settings > General.
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
      },
    });
  }

  const needsReviewCount = transactions.filter((t) => t.needsReview).length;
  console.log(
    `  ✓ Transactions: ${transactions.length} records (${needsReviewCount} flagged for review)`
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
  ];

  for (const budget of budgets) {
    await prisma.budget.upsert({
      where: { year_categoryId: { year: budget.year, categoryId: budget.categoryId } },
      update: { amount: budget.amount },
      create: budget,
    });
  }

  console.log(`  ✓ Budgets: ${budgets.length} entries for 2026`);

  console.log(`
  Expected state after seed:
    Transfer balance:  €0    (both legs of each transfer recorded)
    Proxy balance:    -€45   (João settled, neighbour Ana still outstanding)
    Needs review:      4 transactions (GP visit, dentist, headphones, Ana groceries)
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
