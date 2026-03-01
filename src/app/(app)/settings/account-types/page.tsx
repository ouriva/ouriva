import type { Metadata } from "next";
import { SimpleSettingsList } from "@/components/settings/simple-settings-list";

export const metadata: Metadata = {
  title: "Account Types",
};

const accountTypeFields = [
  { name: "name", label: "Name", placeholder: "e.g., Checking" },
];

export default function AccountTypesSettingsPage() {
  return (
    <SimpleSettingsList
      apiEndpoint="/api/account-types"
      title="Account Type"
      pageTitle="Account Types"
      pageDescription="Define account classifications"
      fields={accountTypeFields}
      displayField="name"
    />
  );
}
