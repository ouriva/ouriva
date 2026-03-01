// Accounts Management Page
// ========================
// Lists all accounts with their balances and allows CRUD.
// Uses a Client Component for interactive list management.

import type { Metadata } from "next";
import { AccountList } from "@/components/settings/account-list";

export const metadata: Metadata = {
  title: "Accounts",
};

export default function AccountsSettingsPage() {
  return (
    <AccountList
      pageTitle="Accounts"
      pageDescription="Manage your bank accounts and wallets"
    />
  );
}
