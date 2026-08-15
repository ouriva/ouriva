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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Copy, Loader2 } from "lucide-react";

interface CopyPreviousYearButtonProps {
  year: number;
  onCopied: () => void;
}

export function CopyPreviousYearButton({ year, onCopied }: Readonly<CopyPreviousYearButtonProps>) {
  const t = useTranslations("budget");
  const prevYear = year - 1;

  const [isCheckingExists, setIsCheckingExists] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
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

  async function handleConfirm() {
    setIsCopying(true);
    try {
      const res = await fetch(`/api/budgets/${year}/copy`, { method: "POST" });
      if (res.ok) {
        setIsOpen(false);
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Copy className="mr-2 h-4 w-4" />
          {t("copyButton", { year: prevYear })}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("copyDialogTitle", { year: prevYear })}</DialogTitle>
          <DialogDescription>
            {t("copyDialogDescription", { year })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {t("copyCancelButton")}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isCopying}>
            {isCopying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("copyConfirmButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
