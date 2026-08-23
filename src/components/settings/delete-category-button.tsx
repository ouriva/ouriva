// Delete Category Button
// =======================
// A button with confirmation dialog to prevent accidental deletion.
// Mirrors DeleteTransactionButton's Dialog-based confirmation pattern.
// The API blocks deletion entirely if the category or any of its
// subcategories still has transactions, so the dialog only needs to warn
// about the cascade to child categories, not about data loss on transactions.

"use client";

import { useState } from "react";
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
import { Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

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
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  async function handleDelete() {
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

      setIsOpen(false);
      onDeleted();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full text-destructive hover:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t("deleteButton")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dialogTitle", { name: categoryName })}</DialogTitle>
          <DialogDescription>
            {childCount > 0
              ? t("dialogDescriptionWithChildren", { count: childCount })
              : t("dialogDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {t("cancelButton")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("confirmButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
