// Transaction Form
// ================
// Full-screen form for creating or editing transactions.
// Uses react-hook-form for form state management and Zod for validation.
//
// Key concepts:
//   react-hook-form — manages form state (values, errors, touched fields)
//     without re-rendering the entire form on every keystroke. It uses
//     uncontrolled inputs (refs) internally for performance.
//   @hookform/resolvers — connects Zod schemas to react-hook-form,
//     so validation runs through Zod but errors display via the form.
//   watch() — subscribes to a specific field's value reactively.
//   useFieldArray() — manages an array of form fields (used for splits).
//     Fields are registered with the form so validation and submission
//     work automatically for each row.

"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type Path } from "react-hook-form";
import {
  createTransactionSchema,
  type CreateTransactionInput,
  type CreateTransactionFormInput,
  type SplitEntry,
} from "@/validators/transaction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Types for the account and category data loaded from the API
interface Account {
  id: string;
  name: string;
  currency: { code: string; symbol: string };
}

interface DefaultCurrency {
  code: string;
}

interface Category {
  id: string;
  name: string;
  parentId: string | null;
  children?: Category[];
}

// Form data shape for editing or pre-filling (e.g. duplicate) — looser
// than the Zod schema because we build it dynamically on the server.
// `id` is optional: when present the form PUTs to that record (edit);
// when absent the form POSTs a new record (create/duplicate).
interface TransactionFormData {
  id?: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  description?: string;
  friendlyName?: string;
  notes?: string;
  date: Date;
  fromAccountId: string;
  categoryId?: string;
  needsReview?: boolean;
  exchangeRate?: number | null;
  splits?: SplitEntry[];
}

interface TransactionFormProps {
  // If provided, we're editing. If not, we're creating.
  initialData?: TransactionFormData;
  onSuccess?: () => void;
}

export function TransactionForm({ initialData, onSuccess }: TransactionFormProps) {
  const t = useTranslations("transactionForm");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [defaultCurrency, setDefaultCurrency] = useState<DefaultCurrency | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Split mode tracks whether the user has toggled the split UI.
  // It's a local UI state, not a form field.
  const [isSplitMode, setIsSplitMode] = useState(
    () => !!initialData?.splits && initialData.splits.length >= 2
  );

  // True only when we have an existing record's id — a pre-filled form
  // without an id (e.g. duplicate) still submits as a new POST.
  const isEditing = !!initialData?.id;

  // Initialize react-hook-form with Zod validation.
  // The resolver connects Zod's schema to the form — when the user
  // submits, Zod validates all fields and returns errors if invalid.
  const {
    register,      // connects an input to the form (returns ref, onChange, etc.)
    handleSubmit,  // wraps your submit handler with validation
    watch,         // reactively watch a field's value
    setValue,      // programmatically set a field's value
    control,       // passed to useFieldArray to share form state
    formState: { errors }, // validation errors per field
  } = useForm<CreateTransactionFormInput>({
    resolver: zodResolver(createTransactionSchema),
    // Date is formatted as yyyy-MM-dd string for <input type="date">.
    // CreateTransactionFormInput uses z.input types (pre-coercion), so
    // date is string | number | Date here, matching what the input produces.
    // z.coerce.date() handles the string→Date conversion on submit.
    defaultValues: initialData
      ? {
          ...initialData,
          date: format(initialData.date, "yyyy-MM-dd"),
          exchangeRate: initialData.exchangeRate ?? undefined,
          splits: initialData.splits ?? [],
        }
      : {
          type: "EXPENSE" as const,
          amount: undefined,
          description: "",
          friendlyName: "",
          notes: "",
          date: format(new Date(), "yyyy-MM-dd"),
          fromAccountId: "",
          categoryId: undefined,
          exchangeRate: undefined,
          splits: [],
        },
  });

  // useFieldArray manages the dynamic list of split rows.
  // `fields` is the current array of splits (each has a unique `id` key for React).
  // `append` adds a new empty split row.
  // `remove` removes the split at a given index.
  const { fields: splitFields, append: appendSplit, remove: removeSplit } = useFieldArray({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    control: control as any,
    name: "splits",
  });

  // Watch the "type" field for the type tabs
  const transactionType = watch("type");
  const totalAmount = watch("amount") || 0;
  const selectedAccountId = watch("fromAccountId");
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const showExchangeRate =
    !!defaultCurrency &&
    !!selectedAccount &&
    selectedAccount.currency.code !== defaultCurrency.code;

  // When the account switches back to the default currency, clear any
  // leftover exchange rate value so it doesn't fail Zod validation.
  useEffect(() => {
    if (!showExchangeRate) {
      setValue("exchangeRate" as Path<CreateTransactionFormInput>, undefined);
    }
  }, [showExchangeRate, setValue]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const splitValues = watch("splits" as any) as { categoryId: string; amount: number }[] | undefined;

  // Compute how much of the total has been allocated across splits.
  // We use integer cent math to avoid float drift in the display.
  const allocatedCents = (splitValues ?? []).reduce(
    (sum, s) => sum + Math.round((Number(s?.amount) || 0) * 100),
    0
  );
  const totalCents = Math.round(totalAmount * 100);
  const remainingCents = totalCents - allocatedCents;
  const isFullyAllocated = remainingCents === 0;

  // Load accounts, categories, and default currency on mount
  useEffect(() => {
    async function loadData() {
      const [accountsRes, categoriesRes, currenciesRes] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/categories"),
        fetch("/api/currencies"),
      ]);

      if (accountsRes.ok) {
        const data = await accountsRes.json();
        setAccounts(data.data || data);
      }
      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setCategories(data.data || data);
      }
      if (currenciesRes.ok) {
        const data = await currenciesRes.json();
        const currencies: Array<{ code: string; isDefault: boolean }> = data.data || data;
        const def = currencies.find((c) => c.isDefault) ?? currencies[0] ?? null;
        setDefaultCurrency(def ? { code: def.code } : null);
      }
    }
    loadData();
  }, []);

  // Form submission handler.
  // The form generic is CreateTransactionFormInput (pre-coercion / z.input types)
  // so TypeScript sees e.g. date as unknown. The zodResolver has already run Zod
  // validation and coercion by the time this function is called, so the values
  // are actually the post-coercion CreateTransactionInput shape at runtime.
  // We cast here to get correct types for the API payload.
  async function onSubmit(rawData: CreateTransactionFormInput) {
    const data = rawData as unknown as CreateTransactionInput;
    setIsSubmitting(true);
    try {
      const url = isEditing
        ? `/api/transactions/${initialData!.id}`
        : "/api/transactions";
      const method = isEditing ? "PUT" : "POST";

      // When not in split mode, clear the splits array so the API
      // uses the single categoryId instead.
      const payload = isSplitMode
        ? data
        : { ...data, splits: undefined };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to save transaction");
      }

      onSuccess?.();
      if (isEditing) {
        // Go back to wherever the user came from (e.g., filtered list).
        // The useTransactions hook will refetch fresh data on mount.
        router.back();
      } else {
        router.push("/transactions");
        router.refresh();
      }
    } catch (error) {
      console.error("Transaction save error:", error);
      alert(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Leaf-only assignment: parents with children become non-selectable group
  // headers (SelectGroup/SelectLabel). Standalone parents (no children) are
  // selectable directly. This matches the industry standard (YNAB, Mint, etc.).
  const parentCategories = categories.filter((c) => !c.parentId);
  const childCategories = categories.filter((c) => c.parentId);

  // Reusable category select rendered inside split rows and single-category mode
  function CategorySelect({
    value,
    onChange,
    placeholder,
  }: {
    value: string | undefined;
    onChange: (v: string) => void;
    placeholder?: string;
  }) {
    return (
      <Select
        value={value || "none"}
        onValueChange={(v) => onChange(v === "none" ? "" : v)}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder ?? t("selectCategoryPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t("noCategoryOption")}</SelectItem>
          {parentCategories.map((parent) => {
            const children = childCategories.filter(
              (c) => c.parentId === parent.id
            );
            if (children.length > 0) {
              // Parent with children — show as a non-selectable group header.
              // Only the leaf children are selectable (industry-standard pattern).
              return (
                <SelectGroup key={parent.id}>
                  <SelectLabel>{parent.name}</SelectLabel>
                  {children.map((child) => (
                    <SelectItem key={child.id} value={child.id}>
                      {child.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              );
            }
            return (
              <SelectItem key={parent.id} value={parent.id}>
                {parent.name}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    );
  }

  function handleToggleSplitMode() {
    if (!isSplitMode) {
      // Entering split mode — seed with 2 empty rows to guide the user
      setValue("splits" as Path<CreateTransactionFormInput>, [
        { categoryId: "", amount: 0 },
        { categoryId: "", amount: 0 },
      ]);
    } else {
      // Leaving split mode — clear the splits array
      setValue("splits" as Path<CreateTransactionFormInput>, []);
    }
    setIsSplitMode((prev) => !prev);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Transaction Type Tabs */}
      <div>
        <Label>{t("typeLabel")}</Label>
        <Tabs
          value={transactionType}
          onValueChange={(value) =>
            setValue("type", value as CreateTransactionInput["type"])
          }
          className="mt-2"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="EXPENSE">{t("typeLabelExpense")}</TabsTrigger>
            <TabsTrigger value="INCOME">{t("typeLabelIncome")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Amount */}
      <div>
        <Label htmlFor="amount">{t("amountLabel")}</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          min="0.01"
          inputMode="decimal" // shows numeric keyboard on mobile
          placeholder={t("amountPlaceholder")}
          {...register("amount", { valueAsNumber: true })}
          className="mt-2 text-lg"
        />
        {errors.amount && (
          <p className="mt-1 text-sm text-destructive">
            {errors.amount.message}
          </p>
        )}
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="description">{t("descriptionLabel")}</Label>
        <Input
          id="description"
          placeholder={t("descriptionPlaceholder")}
          {...register("description")}
          className="mt-2"
        />
      </div>

      {/* Display Name (friendly name) */}
      <div>
        <Label htmlFor="friendlyName">{t("displayNameLabel")}</Label>
        <Input
          id="friendlyName"
          placeholder={t("displayNamePlaceholder")}
          {...register("friendlyName")}
          className="mt-2"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {t("displayNameHelper")}
        </p>
      </div>

      {/* Notes */}
      <div>
        <Label htmlFor="notes">{t("notesLabel")}</Label>
        <Textarea
          id="notes"
          placeholder={t("notesPlaceholder")}
          {...register("notes")}
          className="mt-2"
          rows={3}
        />
      </div>

      {/* Date */}
      <div>
        <Label htmlFor="date">{t("dateLabel")}</Label>
        <Input
          id="date"
          type="date"
          {...register("date")}
          className="mt-2"
        />
        {errors.date && (
          <p className="mt-1 text-sm text-destructive">
            {errors.date.message}
          </p>
        )}
      </div>

      {/* Account */}
      <div>
        <Label>{t("accountLabel")}</Label>
        <Select
          value={watch("fromAccountId")}
          onValueChange={(value) => setValue("fromAccountId", value)}
        >
          <SelectTrigger className="mt-2">
            <SelectValue placeholder={t("accountPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name} ({account.currency.symbol})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.fromAccountId && (
          <p className="mt-1 text-sm text-destructive">
            {errors.fromAccountId.message}
          </p>
        )}
      </div>

      {/* Exchange Rate — only when account currency ≠ default currency */}
      {showExchangeRate && (
        <div>
          <Label htmlFor="exchangeRate">
            {t("exchangeRateLabel", { from: selectedAccount!.currency.code, to: defaultCurrency!.code })}
          </Label>
          <Input
            id="exchangeRate"
            type="number"
            step="any"
            min="0.000001"
            inputMode="decimal"
            placeholder={t("exchangeRatePlaceholder")}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            {...register("exchangeRate" as any, { setValueAs: (v: string) => v === "" ? undefined : Number(v) })}
            className="mt-2 tabular-nums"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {t("exchangeRateDescription", { from: selectedAccount!.currency.code, to: defaultCurrency!.code })}
            {" "}{t("exchangeRateHelper")}
          </p>
        </div>
      )}

      {/* Category / Split section */}
      <div>
        <div className="flex items-center justify-between">
          <Label>{isSplitMode ? t("splitCategoryLabel") : t("categoryLabel")}</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleToggleSplitMode}
          >
            {isSplitMode ? t("singleCategoryButton") : t("splitTransactionButton")}
          </Button>
        </div>

        {isSplitMode ? (
          // --- Split mode ---
          <div className="mt-2 space-y-2">
            {splitFields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                {/* Category dropdown for this split */}
                <div className="flex-1">
                  <CategorySelect
                    value={(splitValues?.[index]?.categoryId) || ""}
                    onChange={(v) =>
                      setValue(`splits.${index}.categoryId` as Path<CreateTransactionFormInput>, v)
                    }
                    placeholder="Category"
                  />
                </div>

                {/* Amount for this split */}
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  {...register(`splits.${index}.amount` as Path<CreateTransactionFormInput>, {
                    valueAsNumber: true,
                  })}
                  className="w-28 tabular-nums"
                />

                {/* Remove button — disabled when only 2 rows remain */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeSplit(index)}
                  disabled={splitFields.length <= 2}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {/* Add another split row */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => appendSplit({ categoryId: "", amount: 0 })}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("addCategoryButton")}
            </Button>

            {/* Running total indicator */}
            <div
              className={cn(
                "rounded-md border px-3 py-2 text-sm tabular-nums",
                isFullyAllocated
                  ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400"
                  : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400"
              )}
            >
              {isFullyAllocated ? (
                <span>{t("allAllocated", { amount: (totalCents / 100).toFixed(2) })}</span>
              ) : remainingCents > 0 ? (
                <span>
                  {t("remainingToAllocate", { amount: (remainingCents / 100).toFixed(2) })}
                </span>
              ) : (
                <span>
                  {t("overAllocated", { amount: (Math.abs(remainingCents) / 100).toFixed(2) })}
                </span>
              )}
            </div>

            {/* Zod validation error for splits array */}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(errors as any).splits?.message && (
              <p className="text-sm text-destructive">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(errors as any).splits.message}
              </p>
            )}
          </div>
        ) : (
          // --- Single category mode ---
          <div className="mt-2">
            <CategorySelect
              value={watch("categoryId")}
              onChange={(v) => setValue("categoryId", v === "none" ? undefined : v)}
            />
            {errors.categoryId && (
              <p className="mt-1 text-sm text-destructive">
                {errors.categoryId.message}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Needs Review */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="needsReview"
          checked={watch("needsReview") || false}
          onCheckedChange={(checked) =>
            setValue("needsReview", checked === true)
          }
        />
        <Label htmlFor="needsReview" className="cursor-pointer text-sm font-normal">
          {t("markForReview")}
        </Label>
      </div>

      {/* Submit */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => router.back()}
        >
          {tCommon("cancel")}
        </Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? t("updateButton") : t("createButton")}
        </Button>
      </div>
    </form>
  );
}
