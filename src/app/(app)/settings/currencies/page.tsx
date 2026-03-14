import type { Metadata } from "next";
import { SimpleSettingsList } from "@/components/settings/simple-settings-list";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Currencies",
};

export default async function CurrenciesSettingsPage() {
  const t = await getTranslations("currencies");

  const currencyFields = [
    { name: "code", label: t("codeLabel"), placeholder: t("codePlaceholder") },
    { name: "name", label: t("nameLabel"), placeholder: t("namePlaceholder") },
    { name: "symbol", label: t("symbolLabel"), placeholder: t("symbolPlaceholder") },
  ];

  return (
    <SimpleSettingsList
      apiEndpoint="/api/currencies"
      title={t("itemTitle")}
      pageTitle={t("pageTitle")}
      pageDescription={t("pageDescription")}
      fields={currencyFields}
      displayField="code"
      subtitleField="name"
      badgeField="symbol"
      isDefaultField="isDefault"
      setDefaultAction="set-default"
    />
  );
}
