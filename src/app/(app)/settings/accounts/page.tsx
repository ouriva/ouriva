// Accounts Management Page
// ========================
// Lists all accounts with their balances and allows CRUD.
// Uses a Client Component for interactive list management.

import type { Metadata } from "next";
import { AccountList } from "@/components/settings/account-list";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Accounts",
};

export default async function AccountsSettingsPage() {
  const t = await getTranslations("accounts");
  return (
    <AccountList
      pageTitle={t("pageTitle")}
      pageDescription={t("pageDescription")}
    />
  );
}
