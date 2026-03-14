// Bottom Navigation Bar
// ====================
// Mobile-first navigation with 5 tabs. Uses Next.js `usePathname()`
// to highlight the active tab based on the current URL.
//
// "use client" is required because:
//   1. usePathname() is a React hook (hooks only run in Client Components)
//   2. We need to respond to URL changes in the browser
//
// Design choices:
//   - Fixed to bottom of screen (`fixed bottom-0`)
//   - 44px minimum touch targets (iOS Human Interface Guidelines)
//   - Safe area padding for iPhones with home indicator (pb-safe)
//   - Border top for visual separation
//   - z-50 ensures it stays above page content

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  BarChart3,
  Wallet,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export function BottomNav() {
  const t = useTranslations("nav");

  // Navigation items configuration — single source of truth.
  // Adding a new tab means adding one object here.
  const navItems = [
    {
      label: t("dashboard"),
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: t("transactions"),
      href: "/transactions",
      icon: ArrowLeftRight,
    },
    {
      label: t("summary"),
      href: "/summary",
      icon: BarChart3,
    },
    {
      label: t("budget"),
      href: "/budget",
      icon: Wallet,
    },
    {
      label: t("settings"),
      href: "/settings",
      icon: Settings,
    },
  ];

  // usePathname() returns the current URL path, e.g. "/transactions"
  // It updates automatically when the user navigates.
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <ul className="flex items-center justify-around pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => {
          // Check if current path starts with this nav item's href.
          // This means "/transactions/new" still highlights "Transactions".
          const isActive = pathname.startsWith(item.href);

          return (
            <li key={item.href}>
              {/* Next.js <Link> does client-side navigation (no full page
                  reload). It prefetches the page in the background on hover
                  or when it enters the viewport. */}
              <Link
                href={item.href}
                className={cn(
                  // Base styles — flexbox column, centered, min 44px touch target
                  "flex flex-col items-center gap-1 px-3 py-2 min-h-[44px] min-w-[44px]",
                  "text-xs transition-colors",
                  // Active vs inactive state
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
