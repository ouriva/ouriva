"use client";

import * as React from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmDialog } from "@/components/confirmation/confirm-dialog";
import { ConfirmSheet } from "@/components/confirmation/confirm-sheet";
import type {
  ConfirmContextValue,
  ConfirmOptions,
  NotifyUndoOptions,
} from "@/components/confirmation/types";

export const ConfirmContext = React.createContext<ConfirmContextValue | null>(null);

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [queue, setQueue] = React.useState<PendingConfirm[]>([]);

  const confirm = React.useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setQueue((q) => [...q, { ...options, resolve }]);
    });
  }, []);

  const notifyUndo = React.useCallback((options: NotifyUndoOptions) => {
    toast(options.message, {
      duration: options.duration ?? 5000,
      action: {
        label: options.undoLabel,
        onClick: () => {
          options.onUndo();
        },
      },
    });
  }, []);

  const value = React.useMemo(() => ({ confirm, notifyUndo }), [confirm, notifyUndo]);

  const current = queue[0];

  function handleResolve(value: boolean) {
    current?.resolve(value);
    setQueue((q) => q.slice(1));
  }

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {current?.variant === "modal" && (
        <ConfirmDialog options={current} onResolve={handleResolve} />
      )}
      {current?.variant === "sheet" && (
        <ConfirmSheet options={current} onResolve={handleResolve} />
      )}
      <Toaster />
    </ConfirmContext.Provider>
  );
}
