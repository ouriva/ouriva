// Import Transactions Page
// ========================
// Server Component that renders the import wizard.
// Follows the "donut pattern" — Server Component wraps the
// Client Component (ImportWizard) that handles all interactivity.

import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ImportWizard } from "@/components/import/import-wizard";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Import Transactions",
};

export default async function ImportTransactionsPage() {
  const t = await getTranslations("import");
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pageTitle")}
        description={t("pageDescription")}
      />
      <ImportWizard />
    </div>
  );
}
