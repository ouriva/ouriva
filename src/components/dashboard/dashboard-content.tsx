// Dashboard Content
// =================
// The main dashboard view combining account balances, monthly
// snapshot, and recent transactions.
//
// Data fetching pattern: We fetch three API endpoints in parallel
// using Promise.all(). This is faster than sequential fetches
// because the requests run concurrently — the total wait time
// equals the slowest request, not the sum of all three.

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";

interface AccountBalance {
  id: string;
  name: string;
  balance: number;
  currency: { code: string; symbol: string };
  accountType: { name: string };
}

interface CurrencyGroup {
  code: string;
  symbol: string;
  accounts: AccountBalance[];
  total: number;
}

interface MonthlySummary {
  totalIncome: number;
  totalExpense: number;
  net: number;
}

interface RecentTransaction {
  id: string;
  type: string;
  amount: string;
  description: string | null;
  date: string;
  fromAccount: { name: string; currency: { symbol: string } };
  category: { name: string; parent: { name: string } | null } | null;
}

export function DashboardContent() {
  const [balances, setBalances] = useState<CurrencyGroup[]>([]);
  const [monthly, setMonthly] = useState<MonthlySummary | null>(null);
  const [recentTx, setRecentTx] = useState<RecentTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      setIsLoading(true);
      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        // Fetch all three data sources in parallel
        const [balRes, monthRes, txRes] = await Promise.all([
          fetch("/api/accounts/balances"),
          fetch(`/api/summary/monthly?year=${year}&month=${month}`),
          fetch("/api/transactions?limit=5"),
        ]);

        if (balRes.ok) {
          const data = await balRes.json();
          setBalances(data.byCurrency);
        }
        if (monthRes.ok) {
          setMonthly(await monthRes.json());
        }
        if (txRes.ok) {
          const data = await txRes.json();
          setRecentTx(data.data);
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchAll();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Account Balances — grouped by currency */}
      <section>
        <h2 className="mb-3 text-base font-semibold">Accounts</h2>
        {balances.length > 0 ? (
          <div className="space-y-4">
            {balances.map((group) => (
              <Card key={group.code}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {group.code}
                    </CardTitle>
                    <span className="text-lg font-bold tabular-nums">
                      {group.symbol}
                      {group.total.toFixed(2)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {group.accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span>{account.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {account.accountType.name}
                        </Badge>
                      </div>
                      <span className="tabular-nums font-medium">
                        {account.currency.symbol}
                        {account.balance.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border p-6 text-center text-muted-foreground">
            No active accounts
          </div>
        )}
      </section>

      {/* Monthly Snapshot */}
      {monthly && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">This Month</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/summary">
                Details <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Income</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400 tabular-nums">
                  €{monthly.totalIncome.toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Expenses</p>
                <p className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">
                  €{monthly.totalExpense.toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Net</p>
                <p
                  className={`text-lg font-bold tabular-nums ${
                    monthly.net >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  €{monthly.net.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Recent Transactions */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent Transactions</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/transactions">
              View all <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
        {recentTx.length > 0 ? (
          <div className="space-y-2">
            {recentTx.map((tx) => {
              const isIncome = tx.type === "INCOME";
              const isTransfer = tx.type === "TRANSFER";
              const categoryLabel = tx.category
                ? tx.category.parent
                  ? `${tx.category.parent.name} › ${tx.category.name}`
                  : tx.category.name
                : isTransfer
                  ? "Transfer"
                  : "";

              return (
                <Card key={tx.id}>
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {tx.description || categoryLabel || "Transaction"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {categoryLabel && tx.description ? categoryLabel : tx.fromAccount.name}
                      </p>
                    </div>
                    <span
                      className={`ml-3 text-sm font-semibold tabular-nums ${
                        isIncome
                          ? "text-green-600 dark:text-green-400"
                          : isTransfer
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {isIncome ? "+" : isTransfer ? "" : "-"}
                      {tx.fromAccount.currency.symbol}
                      {parseFloat(tx.amount).toFixed(2)}
                    </span>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border p-6 text-center text-muted-foreground">
            No transactions yet
          </div>
        )}
      </section>
    </div>
  );
}
