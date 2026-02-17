// Month/Year Picker
// =================
// Navigation component for summary pages. Lets the user step
// through months or years using left/right chevron buttons.
//
// Instead of keeping selection in local state, we use URL search
// params (?year=2026&month=1). This way:
//   - URLs are shareable and bookmarkable
//   - Browser back/forward buttons navigate naturally
//   - The server can also read the selected period
//
// useSearchParams() reads the current URL params.
// useRouter().push() navigates without a full page reload.

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface MonthYearPickerProps {
  // "month" mode shows "January 2026" with month-level navigation
  // "year" mode shows "2026" with year-level navigation
  mode: "month" | "year";
  basePath: string; // e.g. "/summary" or "/summary/annual"
}

export function MonthYearPicker({ mode, basePath }: MonthYearPickerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read current selection from URL, defaulting to current date
  const now = new Date();
  const year = parseInt(searchParams.get("year") || String(now.getFullYear()));
  const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1));

  // Build a URL with updated params
  function navigate(newYear: number, newMonth: number) {
    const params = new URLSearchParams();
    params.set("year", String(newYear));
    if (mode === "month") {
      params.set("month", String(newMonth));
    }
    router.push(`${basePath}?${params.toString()}`);
  }

  function handlePrev() {
    if (mode === "year") {
      navigate(year - 1, month);
    } else {
      // Go to previous month, wrapping around to December of previous year
      if (month === 1) {
        navigate(year - 1, 12);
      } else {
        navigate(year, month - 1);
      }
    }
  }

  function handleNext() {
    if (mode === "year") {
      navigate(year + 1, month);
    } else {
      // Go to next month, wrapping around to January of next year
      if (month === 12) {
        navigate(year + 1, 1);
      } else {
        navigate(year, month + 1);
      }
    }
  }

  // Display text: "January 2026" for month mode, "2026" for year mode
  const label =
    mode === "month"
      ? `${MONTH_NAMES[month - 1]} ${year}`
      : String(year);

  return (
    <div className="flex items-center justify-center gap-4">
      <Button variant="ghost" size="icon" onClick={handlePrev}>
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <span className="min-w-[160px] text-center text-lg font-semibold">
        {label}
      </span>
      <Button variant="ghost" size="icon" onClick={handleNext}>
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
