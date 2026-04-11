// Account List
// ============
// Displays all accounts with edit/deactivate functionality.
// Each account shows its name, type, currency, and initial balance.

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ChevronDown, ChevronUp, Loader2, Pencil, Plus, ToggleLeft, ToggleRight } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";

interface Account {
  id: string;
  name: string;
  initialBalance: string;
  isActive: boolean;
  sortOrder: number;
  currency: { id: string; code: string; symbol: string };
  accountType: { id: string; name: string };
}

interface Currency {
  id: string;
  code: string;
  symbol: string;
}

interface AccountType {
  id: string;
  name: string;
}

interface AccountListProps {
  pageTitle: string;
  pageDescription?: string;
}

export function AccountList({ pageTitle, pageDescription }: AccountListProps) {
  const locale = useLocale();
  const t = useTranslations("accounts");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [accRes, curRes, typeRes] = await Promise.all([
        fetch("/api/accounts?all=true"),
        fetch("/api/currencies"),
        fetch("/api/account-types"),
      ]);
      if (cancelled) return;
      if (accRes.ok) {
        const data = await accRes.json();
        setAccounts(data.data);
      }
      if (curRes.ok) {
        const data = await curRes.json();
        setCurrencies(data.data);
      }
      if (typeRes.ok) {
        const data = await typeRes.json();
        setAccountTypes(data.data);
      }
      setIsLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  async function toggleActive(account: Account) {
    await fetch(`/api/accounts/${account.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !account.isActive }),
    });
    setRefreshKey((k) => k + 1);
  }

  // Move the active account at `activeIndex` one position up or down.
  // We swap by array position and then assign clean sequential sortOrder
  // values (0, 1, 2...), so duplicate DB values never cause a silent no-op.
  async function move(activeIndex: number, direction: "up" | "down") {
    const active = accounts.filter((a) => a.isActive);
    const targetIndex = direction === "up" ? activeIndex - 1 : activeIndex + 1;
    if (targetIndex < 0 || targetIndex >= active.length) return;

    const reordered = [...active];
    [reordered[activeIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[activeIndex]];
    const updatedActive = reordered.map((a, i) => ({ ...a, sortOrder: i }));

    const inactive = accounts.filter((a) => !a.isActive);
    setAccounts([...updatedActive, ...inactive]);

    await fetch("/api/accounts/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedActive.map((a) => ({ id: a.id, sortOrder: a.sortOrder }))),
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
          {pageDescription && (
            <p className="text-sm text-muted-foreground">{pageDescription}</p>
          )}
        </div>
        <AccountForm
          currencies={currencies}
          accountTypes={accountTypes}
          onSuccess={() => setRefreshKey((k) => k + 1)}
        />
      </div>

      <div className="space-y-4">

      {accounts.map((account) => {
        const activeAccounts = accounts.filter((a) => a.isActive);
        const activeIndex = activeAccounts.findIndex((a) => a.id === account.id);
        return (
        <Card
          key={account.id}
          className={cn(!account.isActive && "opacity-50")}
        >
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="font-medium">{account.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary">{account.accountType.name}</Badge>
                <Badge variant="outline">{account.currency.code}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {t("initialBalance", { amount: formatCurrency(account.initialBalance, account.currency.code, locale) })}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {account.isActive && (
                <div className="flex flex-col">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-8"
                    onClick={() => move(activeIndex, "up")}
                    disabled={activeIndex === 0}
                    title="Move up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-8"
                    onClick={() => move(activeIndex, "down")}
                    disabled={activeIndex === activeAccounts.length - 1}
                    title="Move down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <AccountForm
                currencies={currencies}
                accountTypes={accountTypes}
                account={account}
                onSuccess={() => setRefreshKey((k) => k + 1)}
                trigger={
                  <Button variant="ghost" size="sm">
                    <Pencil className="mr-1 h-4 w-4" />
                    {t("editButton")}
                  </Button>
                }
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => toggleActive(account)}
                title={account.isActive ? t("deactivate") : t("activate")}
              >
                {account.isActive ? (
                  <ToggleRight className="h-5 w-5 text-green-600" />
                ) : (
                  <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
        );
      })}
      </div>
    </div>
  );
}

// --- Account Form (Sheet) ---

interface AccountFormProps {
  currencies: Currency[];
  accountTypes: AccountType[];
  account?: Account;
  onSuccess: () => void;
  trigger?: React.ReactNode;
}

function AccountForm({
  currencies,
  accountTypes,
  account,
  onSuccess,
  trigger,
}: AccountFormProps) {
  const t = useTranslations("accounts");
  const isEditing = !!account;
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState(account?.name || "");
  const [initialBalance, setInitialBalance] = useState(
    account ? String(account.initialBalance) : "0"
  );
  const [currencyId, setCurrencyId] = useState(account?.currency.id || "");
  const [accountTypeId, setAccountTypeId] = useState(
    account?.accountType.id || ""
  );

  function resetForm() {
    if (account) {
      setName(account.name);
      setInitialBalance(String(account.initialBalance));
      setCurrencyId(account.currency.id);
      setAccountTypeId(account.accountType.id);
    } else {
      setName("");
      setInitialBalance("0");
      setCurrencyId("");
      setAccountTypeId("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = isEditing
        ? `/api/accounts/${account.id}`
        : "/api/accounts";
      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          initialBalance: parseFloat(initialBalance) || 0,
          currencyId,
          accountTypeId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to save");
      }

      setIsOpen(false);
      resetForm();
      onSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (open) resetForm();
      }}
    >
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            {t("addButton")}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-xl">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? t("editTitle") : t("newTitle")}
          </SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div>
            <Label htmlFor="acc-name">{t("nameLabel")}</Label>
            <Input
              id="acc-name"
              placeholder={t("namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2"
              required
            />
          </div>

          <div>
            <Label htmlFor="acc-currency">{t("currencyLabel")}</Label>
            <Select value={currencyId} onValueChange={setCurrencyId} required>
              <SelectTrigger id="acc-currency" className="mt-2">
                <SelectValue placeholder={t("currencyPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.code} ({c.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="acc-type">{t("typeLabel")}</Label>
            <Select value={accountTypeId} onValueChange={setAccountTypeId} required>
              <SelectTrigger id="acc-type" className="mt-2">
                <SelectValue placeholder={t("typePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {accountTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="acc-balance">{t("initialBalanceLabel")}</Label>
            <Input
              id="acc-balance"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              className="mt-2"
              inputMode="decimal"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setIsOpen(false)}
            >
              {t("cancelButton")}
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting || !currencyId || !accountTypeId}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditing ? t("updateButton") : t("createButton")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
