// Budget Split Targets
// ====================
// Editable Needs/Wants/Savings target percentages, rendered inside the
// "Budget Split" card in Settings > General. Unlike the boolean toggles in
// that same card (which PATCH one field at a time, optimistically), these
// three fields are interdependent — they must sum to 100 — so they save
// together on an explicit click rather than instantly on change.

"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Targets {
  needsTarget: number;
  wantsTarget: number;
  savingsTarget: number;
}

interface BudgetSplitTargetsProps {
  targets: Targets;
  disabled: boolean;
  onSaved: (targets: Targets) => void;
}

export function BudgetSplitTargets({ targets, disabled, onSaved }: Readonly<BudgetSplitTargetsProps>) {
  const t = useTranslations("generalSettings");
  const tCommon = useTranslations("common");
  const [needs, setNeeds] = useState(targets.needsTarget);
  const [wants, setWants] = useState(targets.wantsTarget);
  const [savings, setSavings] = useState(targets.savingsTarget);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNeeds(targets.needsTarget);
    setWants(targets.wantsTarget);
    setSavings(targets.savingsTarget);
  }, [targets]);

  const sum = needs + wants + savings;
  const isDirty = needs !== targets.needsTarget || wants !== targets.wantsTarget || savings !== targets.savingsTarget;
  const isValid = sum === 100 && needs >= 1 && wants >= 1 && savings >= 1;

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ needsTarget: needs, wantsTarget: wants, savingsTarget: savings }),
      });
      if (!res.ok) {
        setError(t("targetsSaveError"));
        return;
      }
      onSaved({ needsTarget: needs, wantsTarget: wants, savingsTarget: savings });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t pt-4 space-y-3">
      <div>
        <Label>{t("targetsLabel")}</Label>
        <p className="mt-1 text-sm text-muted-foreground">{t("targetsDescription")}</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="target-needs" className="text-xs text-muted-foreground">
            {t("targetsNeedsLabel")}
          </Label>
          <Input
            id="target-needs"
            type="number"
            min={1}
            max={98}
            disabled={disabled}
            value={needs}
            onChange={(e) => setNeeds(Number(e.target.value))}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="target-wants" className="text-xs text-muted-foreground">
            {t("targetsWantsLabel")}
          </Label>
          <Input
            id="target-wants"
            type="number"
            min={1}
            max={98}
            disabled={disabled}
            value={wants}
            onChange={(e) => setWants(Number(e.target.value))}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="target-savings" className="text-xs text-muted-foreground">
            {t("targetsSavingsLabel")}
          </Label>
          <Input
            id="target-savings"
            type="number"
            min={1}
            max={98}
            disabled={disabled}
            value={savings}
            onChange={(e) => setSavings(Number(e.target.value))}
            className="mt-1"
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className={cn("text-xs", sum === 100 ? "text-muted-foreground" : "text-red-600 dark:text-red-400")}>
          {t("targetsSum", { sum })}
        </p>
        {isDirty && (
          <Button size="sm" onClick={handleSave} disabled={disabled || !isValid || saving}>
            {tCommon("save")}
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
