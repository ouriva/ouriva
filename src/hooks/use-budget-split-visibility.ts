// useBudgetSplitVisibility Hook
// ==============================
// Resolves whether the 50/30/20 Budget Rule (the `BudgetSplit` component)
// should render on the Summary tabs and on the Budget page, based on the
// three AppSettings toggles set in Settings > General:
//   - budgetSplitEnabled    — master switch for the whole feature
//   - budgetSplitInSummary  — adds the tab to the monthly/annual summary
//   - budgetSplitInBudget   — shows the planned breakdown on the Budget page
//
// The two "in*" flags only take effect while the master switch is on —
// that composition happens here so consumers don't repeat the AND logic.
//
// Defaults to visible everywhere until the fetch resolves, so existing
// users (for whom all three flags default to true in the database) don't
// see a flash of the tab disappearing then reappearing on load.

"use client";

import { useState, useEffect } from "react";

interface BudgetSplitVisibility {
  showInSummary: boolean;
  showInBudget: boolean;
}

export function useBudgetSplitVisibility(): BudgetSplitVisibility {
  const [visibility, setVisibility] = useState<BudgetSplitVisibility>({
    showInSummary: true,
    showInBudget: true,
  });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.data) return;
        const enabled = json.data.budgetSplitEnabled ?? true;
        setVisibility({
          showInSummary: enabled && (json.data.budgetSplitInSummary ?? true),
          showInBudget: enabled && (json.data.budgetSplitInBudget ?? true),
        });
      });

    return () => { cancelled = true; };
  }, []);

  return visibility;
}
