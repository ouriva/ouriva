// Settings Page
// =============
// Hub page with links to sub-settings. Uses a card grid layout
// that works well on both mobile (stacked) and wider screens (grid).

import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Settings2,
  Landmark,
  FolderTree,
  Coins,
  CreditCard,
  Wand2,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Settings",
};

const settingsLinks = [
  {
    title: "General",
    description: "Transfer category and app-wide preferences",
    href: "/settings/general",
    icon: Settings2,
  },
  {
    title: "Accounts",
    description: "Manage bank accounts, credit cards, and wallets",
    href: "/settings/accounts",
    icon: Landmark,
  },
  {
    title: "Categories",
    description: "Organize transactions with parent and subcategories",
    href: "/settings/categories",
    icon: FolderTree,
  },
  {
    title: "Currencies",
    description: "Configure currencies for your accounts",
    href: "/settings/currencies",
    icon: Coins,
  },
  {
    title: "Account Types",
    description: "Define types like Checking, Savings, Credit Card",
    href: "/settings/account-types",
    icon: CreditCard,
  },
  {
    title: "Auto-Categorization",
    description: "Rules that auto-assign categories during import",
    href: "/settings/auto-categorization",
    icon: Wand2,
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your accounts, categories, and preferences"
      />

      <div className="grid gap-3">
        {settingsLinks.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="transition-colors hover:bg-muted/50 active:bg-muted">
              <CardHeader className="flex flex-row items-center gap-4 py-4">
                <item.icon className="h-8 w-8 shrink-0 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
