import type { Metadata } from "next";
import { SimpleSettingsList } from "@/components/settings/simple-settings-list";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Account Types",
};

export default async function AccountTypesSettingsPage() {
  const t = await getTranslations("settings");
  const tCategories = await getTranslations("categories");

  const accountTypeFields = [
    { name: "name", label: tCategories("nameLabel"), placeholder: "e.g., Checking" },
  ];

  return (
    <SimpleSettingsList
      apiEndpoint="/api/account-types"
      title={t("accountTypesItem")}
      pageTitle={t("accountTypes")}
      pageDescription={t("accountTypesDescription")}
      fields={accountTypeFields}
      displayField="name"
    />
  );
}
