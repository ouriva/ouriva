// Delete Transaction Button
// =========================
// A button with confirmation before deletion, using the app-wide
// confirmation system's modal variant.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useConfirm } from "@/hooks/use-confirm";

interface DeleteTransactionButtonProps {
  transactionId: string;
}

export function DeleteTransactionButton({
  transactionId,
}: Readonly<DeleteTransactionButtonProps>) {
  const t = useTranslations("deleteTransaction");
  const router = useRouter();
  const { confirm } = useConfirm();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleClick() {
    const ok = await confirm({
      variant: "modal",
      destructive: true,
      title: t("dialogTitle"),
      description: t("dialogDescription"),
      confirmLabel: t("deleteButton"),
      cancelLabel: t("cancelButton"),
    });
    if (!ok) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete transaction");
      }

      router.push("/transactions");
      router.refresh();
    } catch (error) {
      console.error("Delete error:", error);
      alert(t("errorMessage"));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-destructive"
      onClick={handleClick}
      disabled={isDeleting}
    >
      {isDeleting ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <Trash2 className="h-5 w-5" />
      )}
      <span className="sr-only">{t("ariaLabel")}</span>
    </Button>
  );
}
