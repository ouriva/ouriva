import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { NetWorthChart } from "@/components/analytics/net-worth-chart";
import { Card, CardContent } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Analytics",
};

export default async function AnalyticsPage() {
  const t = await getTranslations("nav");
  return (
    <div className="space-y-4">
      <PageHeader title={t("analytics")} />
      <NetWorthChart />
      {/* Placeholder — more charts will be added here */}
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">More charts coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
