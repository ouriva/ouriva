// Edit Transaction Page
// =====================
// Fetches an existing transaction and renders the form in edit mode.
//
// This is a SERVER component that fetches data on the server side,
// then passes it to the TransactionForm (Client Component).
// This pattern avoids showing a loading spinner — the page arrives
// with the data already loaded.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { DeleteTransactionButton } from "@/components/transactions/delete-transaction-button";
import { Button } from "@/components/ui/button";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Edit Transaction",
};

export default async function EditTransactionPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const t = await getTranslations("transactions");

  // Fetch directly from the database on the server.
  // No API call needed — Server Components can access the DB directly.
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      fromAccount: { include: { currency: true } },
      category: true,
      splits: { include: { category: { include: { parent: true } } } },
    },
  });

  // notFound() triggers Next.js's built-in 404 page
  if (!transaction) {
    notFound();
  }

  // Transform the Prisma result into the shape the form expects
  const initialData = {
    id: transaction.id,
    type: transaction.type as "INCOME" | "EXPENSE" | "TRANSFER",
    amount: Number(transaction.amount),
    description: transaction.description || "",
    friendlyName: transaction.friendlyName || "",
    notes: transaction.notes || "",
    date: transaction.date,
    fromAccountId: transaction.fromAccountId,
    // TRANSFER transactions intentionally have no category
    ...(transaction.categoryId && transaction.type !== "TRANSFER" && { categoryId: transaction.categoryId }),
    needsReview: transaction.needsReview,
    exchangeRate: transaction.exchangeRate ?? null,
    // Pre-populate split rows so the form can enter split mode on load
    splits: transaction.splits.map((s) => ({
      categoryId: s.categoryId ?? "",
      amount: Number(s.amount),
    })),
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("editTitle")}>
        <div className="flex items-center gap-1">
          {/* Duplicate: navigates to /transactions/new with the current id as
              a `from` param. The new page fetches the source and pre-fills
              the form, but omits the id so it saves as a brand-new record. */}
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/transactions/new?from=${id}`}>
              <Copy className="h-5 w-5" />
              <span className="sr-only">Duplicate transaction</span>
            </Link>
          </Button>
          <DeleteTransactionButton transactionId={id} />
        </div>
      </PageHeader>
      <TransactionForm initialData={initialData} />
    </div>
  );
}
