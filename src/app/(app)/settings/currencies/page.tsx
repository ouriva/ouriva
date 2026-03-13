import type { Metadata } from "next";
import { SimpleSettingsList } from "@/components/settings/simple-settings-list";

export const metadata: Metadata = {
  title: "Currencies",
};

const currencyFields = [
  { name: "code", label: "Code", placeholder: "EUR" },
  { name: "name", label: "Name", placeholder: "Euro" },
  { name: "symbol", label: "Symbol", placeholder: "€" },
];

export default function CurrenciesSettingsPage() {
  return (
    <SimpleSettingsList
      apiEndpoint="/api/currencies"
      title="Currency"
      pageTitle="Currencies"
      pageDescription="The default currency is used for aggregated totals and summaries. The first currency added is the default — you can change it with the star button."
      fields={currencyFields}
      displayField="code"
      subtitleField="name"
      badgeField="symbol"
      isDefaultField="isDefault"
      setDefaultAction="set-default"
    />
  );
}
