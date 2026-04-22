// Summary Nav
// ===========
// Segmented Monthly | Annual toggle rendered above the Suspense boundary
// in both summary pages. Accepts the active mode as a prop so it can be
// a plain Server Component — no hooks, no client JS needed.

import Link from "next/link";
import { cn } from "@/lib/utils";
import { getTranslations } from "next-intl/server";

interface SummaryNavProps {
  mode: "monthly" | "annual";
}

export async function SummaryNav({ mode }: Readonly<SummaryNavProps>) {
  const t = await getTranslations("summary");

  return (
    <div className="flex rounded-lg border bg-muted p-1">
      <Link
        href="/summary"
        className={cn(
          "flex-1 rounded-md py-1.5 text-center text-sm font-medium transition-colors",
          mode === "monthly"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {t("tabMonthly")}
      </Link>
      <Link
        href="/summary/annual"
        className={cn(
          "flex-1 rounded-md py-1.5 text-center text-sm font-medium transition-colors",
          mode === "annual"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {t("tabAnnual")}
      </Link>
    </div>
  );
}
