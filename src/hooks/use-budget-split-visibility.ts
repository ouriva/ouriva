// useBudgetSplitVisibility Hook
// ==============================
// Resolves whether Budget Split (the `BudgetSplit` component) should render
// on the Summary tabs and on the Budget page, and what its three target
// percentages are — all read from the AppSettings singleton in one fetch:
//   - budgetSplitEnabled    — master switch for the whole feature
//   - budgetSplitInSummary  — adds the tab to the monthly/annual summary
//   - budgetSplitInBudget   — shows the planned breakdown on the Budget page
//   - needsTarget/wantsTarget/savingsTarget — the configurable split,
//     defaulting to the classic 50/30/20 rule
//
// The two "in*" flags only take effect while the master switch is on —
// that composition happens here so consumers don't repeat the AND logic.
//
// Defaults to visible everywhere with the 50/30/20 default targets until
// the fetch resolves, so existing users (for whom all settings already
// default to this in the database) don't see a flash of different values
// on load.

"use client";

import { useState, useEffect } from "react";

interface BudgetSplitTargets {
  NEEDS: number;
  WANTS: number;
  SAVINGS: number;
}

interface BudgetSplitSettings {
  showInSummary: boolean;
  showInBudget: boolean;
  targets: BudgetSplitTargets;
}

const DEFAULT_TARGETS: BudgetSplitTargets = { NEEDS: 50, WANTS: 30, SAVINGS: 20 };

export function useBudgetSplitVisibility(): BudgetSplitSettings {
  const [settings, setSettings] = useState<BudgetSplitSettings>({
    showInSummary: true,
    showInBudget: true,
    targets: DEFAULT_TARGETS,
  });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.data) return;
        const enabled = json.data.budgetSplitEnabled ?? true;
        setSettings({
          showInSummary: enabled && (json.data.budgetSplitInSummary ?? true),
          showInBudget: enabled && (json.data.budgetSplitInBudget ?? true),
          targets: {
            NEEDS: json.data.needsTarget ?? DEFAULT_TARGETS.NEEDS,
            WANTS: json.data.wantsTarget ?? DEFAULT_TARGETS.WANTS,
            SAVINGS: json.data.savingsTarget ?? DEFAULT_TARGETS.SAVINGS,
          },
        });
      });

    return () => { cancelled = true; };
  }, []);

  return settings;
}
