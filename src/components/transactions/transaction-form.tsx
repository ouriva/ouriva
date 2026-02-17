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
//     Used here to show/hide fields based on transaction type.

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
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  description?: string;
  date: Date;
  fromAccountId: string;
  toAccountId?: string;
  toAmount?: number;
  categoryId?: string;
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
    reset,         // reset the form to initial values
    formState: { errors }, // validation errors per field
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<CreateTransactionInput>({
    resolver: zodResolver(createTransactionSchema) as any,
    defaultValues: initialData || {
      type: "EXPENSE",
      amount: undefined,
      description: "",
      date: new Date(),
      fromAccountId: "",
      categoryId: "",
    },
  });

  // Watch the "type" field to conditionally show/hide fields
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

  // Reset form when type changes (clear type-specific fields)
  useEffect(() => {
    if (transactionType === "TRANSFER") {
      setValue("categoryId", undefined as unknown as string);
    } else {
      setValue("toAccountId" as keyof CreateTransactionInput, undefined as unknown as string);
      setValue("toAmount" as keyof CreateTransactionInput, undefined as unknown as number);
    }
  }, [transactionType, setValue]);

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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="EXPENSE">Expense</TabsTrigger>
            <TabsTrigger value="INCOME">Income</TabsTrigger>
            <TabsTrigger value="TRANSFER">Transfer</TabsTrigger>
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

      {/* Date */}
      <div>
        <Label htmlFor="date">Date</Label>
        <Input
          id="date"
          type="date"
          {...register("date")}
          defaultValue={format(initialData?.date || new Date(), "yyyy-MM-dd")}
          className="mt-2"
        />
        {errors.date && (
          <p className="mt-1 text-sm text-destructive">
            {errors.date.message}
          </p>
        )}
      </div>

      {/* From Account (all types) */}
      <div>
        <Label>
          {transactionType === "TRANSFER" ? "From Account" : "Account"}
        </Label>
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

      {/* To Account (TRANSFER only) */}
      {transactionType === "TRANSFER" && (
        <>
          <div>
            <Label>To Account</Label>
            <Select
              value={watch("toAccountId" as keyof CreateTransactionInput) as string}
              onValueChange={(value) =>
                setValue("toAccountId" as keyof CreateTransactionInput, value)
              }
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select destination account" />
              </SelectTrigger>
              <SelectContent>
                {accounts
                  .filter((a) => a.id !== watch("fromAccountId"))
                  .map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({account.currency.symbol})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* To Amount — only shown if source and destination currencies differ */}
          <div>
            <Label htmlFor="toAmount">Received Amount (if different currency)</Label>
            <Input
              id="toAmount"
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              placeholder="Leave empty if same currency"
              {...register("toAmount" as keyof CreateTransactionInput, { valueAsNumber: true })}
              className="mt-2"
            />
          </div>
        </>
      )}

      {/* Category (INCOME/EXPENSE required, TRANSFER optional) */}
      {transactionType !== "TRANSFER" && (
        <div>
          <Label>Category</Label>
          <Select
            value={watch("categoryId") as string}
            onValueChange={(value) => setValue("categoryId", value)}
          >
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
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
      )}

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
