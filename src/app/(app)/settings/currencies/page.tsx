import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
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
    <div className="space-y-6">
      <PageHeader title="Currencies" description="Configure available currencies" />
      <SimpleSettingsList
        apiEndpoint="/api/currencies"
        title="Currency"
        fields={currencyFields}
        displayField="code"
        subtitleField="name"
        badgeField="symbol"
      />
    </div>
  );
}
