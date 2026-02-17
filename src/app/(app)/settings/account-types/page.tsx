import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { SimpleSettingsList } from "@/components/settings/simple-settings-list";

export const metadata: Metadata = {
  title: "Account Types",
};

const accountTypeFields = [
  { name: "name", label: "Name", placeholder: "e.g., Checking" },
];

export default function AccountTypesSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Account Types" description="Define account classifications" />
      <SimpleSettingsList
        apiEndpoint="/api/account-types"
        title="Account Type"
        fields={accountTypeFields}
        displayField="name"
      />
    </div>
  );
}
