// Settings Item Form
// ==================
// A reusable dialog-based form for creating and editing simple
// settings items (currencies, account types). Uses a Sheet
// (bottom drawer on mobile) instead of a full page.

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Loader2, Plus, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";

interface Field {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
}

interface SettingsItemFormProps {
  title: string;
  fields: Field[];
  initialValues?: Record<string, string>;
  apiEndpoint: string;
  itemId?: string; // if provided, PUT instead of POST
  onSuccess: () => void;
  trigger?: React.ReactNode;
}

export function SettingsItemForm({
  title,
  fields,
  initialValues,
  apiEndpoint,
  itemId,
  onSuccess,
  trigger,
}: Readonly<SettingsItemFormProps>) {
  const tCommon = useTranslations("common");
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(
    initialValues || {}
  );

  const isEditing = !!itemId;

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = isEditing ? `${apiEndpoint}/${itemId}` : apiEndpoint;
      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to save");
      }

      setIsOpen(false);
      setValues(initialValues || {});
      onSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      // Always reset to the current prop values when opening so the form
      // shows fresh data even if initialValues changed since last mount.
      if (open) setValues(initialValues || {});
    }}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            {tCommon("add")}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-xl">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? tCommon("editItem", { title }) : tCommon("addNew", { title })}
          </SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {fields.map((field) => (
            <div key={field.name}>
              <Label htmlFor={field.name}>{field.label}</Label>
              <Input
                id={field.name}
                type={field.type || "text"}
                placeholder={field.placeholder}
                value={values[field.name] || ""}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    [field.name]: e.target.value,
                  }))
                }
                className="mt-2"
                required
              />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setIsOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditing ? tCommon("updateButton") : tCommon("createButton")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// Convenience component for edit buttons
export function EditButton({
  onClick,
}: Readonly<{
  onClick?: () => void;
}>) {
  return (
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClick}>
      <Pencil className="h-4 w-4" />
      <span className="sr-only">Edit</span>
    </Button>
  );
}
