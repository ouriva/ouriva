// Delete Category Button
// =======================
// A button with confirmation before deletion, using the app-wide
// confirmation system's modal variant. The API blocks deletion
// entirely if the category or any of its subcategories still has
// transactions, so the dialog only needs to warn about the cascade
// to child categories, not about data loss on transactions.

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useConfirm } from "@/hooks/use-confirm";

interface DeleteCategoryButtonProps {
  categoryId: string;
  categoryName: string;
  childCount: number;
  onDeleted: () => void;
}

export function DeleteCategoryButton({
  categoryId,
  categoryName,
  childCount,
  onDeleted,
}: Readonly<DeleteCategoryButtonProps>) {
  const t = useTranslations("deleteCategory");
  const { confirm } = useConfirm();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleClick() {
    const ok = await confirm({
      variant: "modal",
      destructive: true,
      title: t("dialogTitle", { name: categoryName }),
      description:
        childCount > 0
          ? t("dialogDescriptionWithChildren", { count: childCount })
          : t("dialogDescription"),
      confirmLabel: t("confirmButton"),
      cancelLabel: t("cancelButton"),
    });
    if (!ok) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const err = await response.json();
        alert(err.error?.message ?? t("errorMessage"));
        return;
      }

      onDeleted();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full text-destructive hover:text-destructive"
      onClick={handleClick}
      disabled={isDeleting}
    >
      {isDeleting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="mr-2 h-4 w-4" />
      )}
      {t("deleteButton")}
    </Button>
  );
}
