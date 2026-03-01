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
      pageDescription="Configure available currencies"
      fields={currencyFields}
      displayField="code"
      subtitleField="name"
      badgeField="symbol"
    />
  );
}
