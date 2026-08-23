"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ConfirmOptions } from "./types";

interface ConfirmDialogProps {
  options: ConfirmOptions;
  onResolve: (value: boolean) => void;
}

export function ConfirmDialog({ options, onResolve }: Readonly<ConfirmDialogProps>) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onResolve(false);
      }}
    >
      <DialogContent showCloseButton={false} {...(!options.description && { "aria-describedby": undefined })}>
        <DialogHeader>
          <DialogTitle>{options.title}</DialogTitle>
          {options.description && (
            <DialogDescription>{options.description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onResolve(false)}>
            {options.cancelLabel}
          </Button>
          <Button
            variant={options.destructive ? "destructive" : "default"}
            onClick={() => onResolve(true)}
          >
            {options.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
