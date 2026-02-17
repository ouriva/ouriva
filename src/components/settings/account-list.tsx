// Account List
// ============
// Displays all accounts with edit/deactivate functionality.
// Each account shows its name, type, currency, and initial balance.

"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import { SettingsItemForm } from "./settings-item-form";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface Account {
  id: string;
  name: string;
  initialBalance: string;
  isActive: boolean;
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

export function AccountList() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [accRes, curRes, typeRes] = await Promise.all([
      fetch("/api/accounts?all=true"),
      fetch("/api/currencies"),
      fetch("/api/account-types"),
    ]);

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
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function toggleActive(account: Account) {
    await fetch(`/api/accounts/${account.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !account.isActive }),
    });
    fetchData();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Build select fields for the form dynamically from loaded data
  const formFields = [
    { name: "name", label: "Account Name", placeholder: "e.g., Main Checking" },
    {
      name: "initialBalance",
      label: "Initial Balance",
      placeholder: "0.00",
      type: "number",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <SettingsItemForm
          title="Account"
          fields={formFields}
          apiEndpoint="/api/accounts"
          onSuccess={fetchData}
        />
      </div>

      {accounts.map((account) => (
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
                Initial: {formatCurrency(account.initialBalance, account.currency.code)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <SettingsItemForm
                title="Account"
                fields={formFields}
                initialValues={{
                  name: account.name,
                  initialBalance: String(account.initialBalance),
                }}
                apiEndpoint="/api/accounts"
                itemId={account.id}
                onSuccess={fetchData}
                trigger={
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                }
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => toggleActive(account)}
                title={account.isActive ? "Deactivate" : "Activate"}
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
      ))}
    </div>
  );
}
