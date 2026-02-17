// Accounts Management Page
// ========================
// Lists all accounts with their balances and allows CRUD.
// Uses a Client Component for interactive list management.

import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { AccountList } from "@/components/settings/account-list";

export const metadata: Metadata = {
  title: "Accounts",
};

export default function AccountsSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Accounts" description="Manage your bank accounts and wallets" />
      <AccountList />
    </div>
  );
}
