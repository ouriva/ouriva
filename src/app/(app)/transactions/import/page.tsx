// Import Transactions Page
// ========================
// Server Component that renders the import wizard.
// Follows the "donut pattern" — Server Component wraps the
// Client Component (ImportWizard) that handles all interactivity.

import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ImportWizard } from "@/components/import/import-wizard";

export const metadata: Metadata = {
  title: "Import Transactions",
};

export default function ImportTransactionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Import Transactions"
        description="Import from a CSV or XLSX bank statement"
      />
      <ImportWizard />
    </div>
  );
}
