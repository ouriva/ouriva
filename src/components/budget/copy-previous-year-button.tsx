// Copy Previous Year Budget Button
// =================================
// Copies every budget entry (amount + note) from year-1 into `year`,
// after a confirmation dialog warning that it overwrites the target
// year's existing budget data. Disabled (with an explanatory tooltip)
// when the previous year has no budget data to copy.

"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Copy, Loader2 } from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";

interface CopyPreviousYearButtonProps {
  year: number;
  onCopied: () => void;
}

export function CopyPreviousYearButton({ year, onCopied }: Readonly<CopyPreviousYearButtonProps>) {
  const t = useTranslations("budget");
  const prevYear = year - 1;
  const { confirm } = useConfirm();

  const [isCheckingExists, setIsCheckingExists] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const checkExists = useCallback(async () => {
    setIsCheckingExists(true);
    try {
      const res = await fetch(`/api/budgets/${prevYear}/exists`);
      const json = res.ok ? await res.json() : { hasData: false };
      setHasData(Boolean(json.hasData));
    } finally {
      setIsCheckingExists(false);
    }
  }, [prevYear]);

  useEffect(() => {
    checkExists();
  }, [checkExists]);

  async function handleClick() {
    const ok = await confirm({
      variant: "modal",
      title: t("copyDialogTitle", { year: prevYear }),
      description: t("copyDialogDescription", { year }),
      confirmLabel: t("copyConfirmButton"),
      cancelLabel: t("copyCancelButton"),
    });
    if (!ok) return;

    setIsCopying(true);
    try {
      const res = await fetch(`/api/budgets/${year}/copy`, { method: "POST" });
      if (res.ok) {
        onCopied();
      } else {
        const err = await res.json();
        alert(err.error?.message || t("copyErrorMessage"));
      }
    } finally {
      setIsCopying(false);
    }
  }

  const isDisabled = isCheckingExists || !hasData;

  if (isDisabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex">
            <Button variant="outline" size="sm" disabled>
              <Copy className="mr-2 h-4 w-4" />
              {t("copyButton", { year: prevYear })}
            </Button>
          </span>
        </TooltipTrigger>
        {!isCheckingExists && (
          <TooltipContent side="bottom">
            {t("copyTooltipEmpty", { year: prevYear })}
          </TooltipContent>
        )}
      </Tooltip>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={isCopying}>
      {isCopying ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Copy className="mr-2 h-4 w-4" />
      )}
      {t("copyButton", { year: prevYear })}
    </Button>
  );
}
