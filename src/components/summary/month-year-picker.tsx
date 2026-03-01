// Month/Year Picker
// =================
// Navigation component for summary pages. Steps through months or years
// using chevron buttons. State lives in URL search params so it survives
// navigation and browser back/forward.
//
// "Today" / "This year" shortcut: appears as a small pill when the
// selected period differs from the current one, giving a one-tap way
// back to the present without repeated chevron presses.

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface MonthYearPickerProps {
  mode: "month" | "year";
  basePath: string;
}

export function MonthYearPicker({ mode, basePath }: MonthYearPickerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const year = parseInt(searchParams.get("year") || String(currentYear));
  const month = parseInt(searchParams.get("month") || String(currentMonth));

  function navigate(newYear: number, newMonth: number) {
    const params = new URLSearchParams();
    params.set("year", String(newYear));
    if (mode === "month") params.set("month", String(newMonth));
    router.push(`${basePath}?${params.toString()}`);
  }

  function handlePrev() {
    if (mode === "year") {
      navigate(year - 1, month);
    } else {
      month === 1 ? navigate(year - 1, 12) : navigate(year, month - 1);
    }
  }

  function handleNext() {
    if (mode === "year") {
      navigate(year + 1, month);
    } else {
      month === 12 ? navigate(year + 1, 1) : navigate(year, month + 1);
    }
  }

  function goToCurrent() {
    navigate(currentYear, currentMonth);
  }

  const label =
    mode === "month" ? `${MONTH_NAMES[month - 1]} ${year}` : String(year);

  const isCurrentPeriod =
    mode === "year"
      ? year === currentYear
      : year === currentYear && month === currentMonth;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-2">
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

      {/* "Today" pill — only shown when not viewing the current period */}
      {!isCurrentPeriod && (
        <button
          onClick={goToCurrent}
          className="rounded-full border px-3 py-0.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          {mode === "month" ? "This month" : "This year"}
        </button>
      )}
    </div>
  );
}
