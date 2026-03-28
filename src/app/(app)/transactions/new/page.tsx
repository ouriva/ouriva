// New Transaction Page
// ====================
// Full-screen form for creating a new transaction.
//
// Supports an optional `?from=<id>` query param that pre-fills the form
// with the data of an existing transaction — used by the Duplicate action.
// The form will still submit a POST (create), not a PUT (edit), because
// no `id` is included in the initialData passed to TransactionForm.

import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { TransactionForm } from "@/components/transactions/transaction-form";

export const metadata: Metadata = {
  title: "New Transaction",
};

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;

  // If a `from` id was provided, fetch the source transaction so we can
  // pre-fill the form. This is the duplicate flow.
  let initialData: React.ComponentProps<typeof TransactionForm>["initialData"];

  if (from) {
    const source = await prisma.transaction.findUnique({
      where: { id: from },
      include: {
        splits: true,
      },
    });

    if (source) {
      // Copy all user-visible fields but:
      //   - omit `id` so the form POSTs a new record instead of PUTting
      //   - set date to today so the duplicate starts on the current date
      initialData = {
        type: source.type as "INCOME" | "EXPENSE",
        amount: Number(source.amount),
        description: source.description || "",
        friendlyName: source.friendlyName || "",
        notes: source.notes || "",
        date: new Date(),
        fromAccountId: source.fromAccountId,
        ...(source.categoryId && { categoryId: source.categoryId }),
        needsReview: source.needsReview,
        exchangeRate: source.exchangeRate ?? null,
        splits: source.splits.map((s) => ({
          categoryId: s.categoryId ?? "",
          amount: Number(s.amount),
        })),
      };
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={initialData ? "Duplicate Transaction" : "New Transaction"} />
      <TransactionForm initialData={initialData} />
    </div>
  );
}
