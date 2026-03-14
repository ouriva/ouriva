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
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const t = await getTranslations("settings");

  const settingsLinks = [
    {
      title: t("general"),
      description: t("generalDescription"),
      href: "/settings/general",
      icon: Settings2,
    },
    {
      title: t("accounts"),
      description: t("accountsDescription"),
      href: "/settings/accounts",
      icon: Landmark,
    },
    {
      title: t("categories"),
      description: t("categoriesDescription"),
      href: "/settings/categories",
      icon: FolderTree,
    },
    {
      title: t("currencies"),
      description: t("currenciesDescription"),
      href: "/settings/currencies",
      icon: Coins,
    },
    {
      title: t("accountTypes"),
      description: t("accountTypesDescription"),
      href: "/settings/account-types",
      icon: CreditCard,
    },
    {
      title: t("autoCategorization"),
      description: t("autoCategorizationDescription"),
      href: "/settings/auto-categorization",
      icon: Wand2,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pageTitle")}
        description={t("pageDescription")}
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
