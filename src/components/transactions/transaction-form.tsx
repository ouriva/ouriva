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

"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  createTransactionSchema,
  type CreateTransactionInput,
} from "@/validators/transaction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

// Types for the account and category data loaded from the API
interface Account {
  id: string;
  name: string;
  currency: { code: string; symbol: string };
}

interface Category {
  id: string;
  name: string;
  parentId: string | null;
  children?: Category[];
}

// Form data shape for editing — looser than the Zod schema because
// we build it dynamically on the server. Zod validates on submit.
interface TransactionFormData {
  id: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  description?: string;
  friendlyName?: string;
  notes?: string;
  date: Date;
  fromAccountId: string;
  categoryId?: string;
  needsReview?: boolean;
}

interface TransactionFormProps {
  // If provided, we're editing. If not, we're creating.
  initialData?: TransactionFormData;
  onSuccess?: () => void;
}

export function TransactionForm({ initialData, onSuccess }: TransactionFormProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!initialData;

  // Initialize react-hook-form with Zod validation.
  // The resolver connects Zod's schema to the form — when the user
  // submits, Zod validates all fields and returns errors if invalid.
  const {
    register,      // connects an input to the form (returns ref, onChange, etc.)
    handleSubmit,  // wraps your submit handler with validation
    watch,         // reactively watch a field's value
    setValue,      // programmatically set a field's value
    formState: { errors }, // validation errors per field
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<CreateTransactionInput>({
    resolver: zodResolver(createTransactionSchema) as any,
    // Date is formatted as yyyy-MM-dd string for <input type="date">.
    // Cast needed because the Zod schema types date as Date, but
    // z.coerce.date() handles the string→Date conversion on submit.
    defaultValues: (initialData
      ? { ...initialData, date: format(initialData.date, "yyyy-MM-dd") }
      : {
          type: "EXPENSE" as const,
          amount: undefined,
          description: "",
          friendlyName: "",
          notes: "",
          date: format(new Date(), "yyyy-MM-dd"),
          fromAccountId: "",
          categoryId: undefined,
        }) as any,
  });

  // Watch the "type" field for the type tabs
  const transactionType = watch("type");

  // Load accounts and categories from the API on mount
  useEffect(() => {
    async function loadData() {
      const [accountsRes, categoriesRes] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/categories"),
      ]);

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        setAccounts(accountsData.data || accountsData);
      }
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData.data || categoriesData);
      }
    }
    loadData();
  }, []);

  // Form submission handler
  async function onSubmit(data: CreateTransactionInput) {
    setIsSubmitting(true);
    try {
      const url = isEditing
        ? `/api/transactions/${initialData!.id}`
        : "/api/transactions";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to save transaction");
      }

      onSuccess?.();
      router.push("/transactions");
      router.refresh(); // refresh server components to show new data
    } catch (error) {
      console.error("Transaction save error:", error);
      alert(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Filter categories: only show children (subcategories) for selection.
  // Parent categories are used as group headers.
  const parentCategories = categories.filter((c) => !c.parentId);
  const childCategories = categories.filter((c) => c.parentId);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Transaction Type Tabs */}
      <div>
        <Label>Type</Label>
        <Tabs
          value={transactionType}
          onValueChange={(value) =>
            setValue("type", value as CreateTransactionInput["type"])
          }
          className="mt-2"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="EXPENSE">Expense</TabsTrigger>
            <TabsTrigger value="INCOME">Income</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Amount */}
      <div>
        <Label htmlFor="amount">Amount</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          min="0.01"
          inputMode="decimal" // shows numeric keyboard on mobile
          placeholder="0.00"
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
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          placeholder="What was this for?"
          {...register("description")}
          className="mt-2"
        />
      </div>

      {/* Display Name (friendly name) */}
      <div>
        <Label htmlFor="friendlyName">Display Name</Label>
        <Input
          id="friendlyName"
          placeholder="Short name to display (optional)"
          {...register("friendlyName")}
          className="mt-2"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Overrides the description when shown in lists
        </p>
      </div>

      {/* Notes */}
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Additional details (optional)"
          {...register("notes")}
          className="mt-2"
          rows={3}
        />
      </div>

      {/* Date */}
      <div>
        <Label htmlFor="date">Date</Label>
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
        <Label>Account</Label>
        <Select
          value={watch("fromAccountId")}
          onValueChange={(value) => setValue("fromAccountId", value)}
        >
          <SelectTrigger className="mt-2">
            <SelectValue placeholder="Select account" />
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

      {/* Category */}
      <div>
        <Label>Category</Label>
        <Select
          value={watch("categoryId") || "none"}
          onValueChange={(value) => setValue("categoryId", value === "none" ? undefined : value)}
        >
          <SelectTrigger className="mt-2">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No category</SelectItem>
            {parentCategories.map((parent) => {
              const children = childCategories.filter(
                (c) => c.parentId === parent.id
              );
              // If parent has children, show children under a group
              if (children.length > 0) {
                return children.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    {parent.name} › {child.name}
                  </SelectItem>
                ));
              }
              // If no children, show the parent itself
              return (
                <SelectItem key={parent.id} value={parent.id}>
                  {parent.name}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {errors.categoryId && (
          <p className="mt-1 text-sm text-destructive">
            {errors.categoryId.message}
          </p>
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
          Mark for review
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
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}
