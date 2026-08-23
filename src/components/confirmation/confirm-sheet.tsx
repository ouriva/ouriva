"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { ConfirmOptions } from "./types";

interface ConfirmSheetProps {
  options: ConfirmOptions;
  onResolve: (value: boolean) => void;
}

export function ConfirmSheet({ options, onResolve }: Readonly<ConfirmSheetProps>) {
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onResolve(false);
      }}
    >
      <SheetContent side="bottom" className="rounded-t-xl">
        <SheetHeader>
          <SheetTitle>{options.title}</SheetTitle>
          {options.description && (
            <SheetDescription>{options.description}</SheetDescription>
          )}
        </SheetHeader>
        <SheetFooter className="flex-row gap-3">
          <Button variant="outline" className="flex-1" onClick={() => onResolve(false)}>
            {options.cancelLabel}
          </Button>
          <Button
            variant={options.destructive ? "destructive" : "default"}
            className="flex-1"
            onClick={() => onResolve(true)}
          >
            {options.confirmLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
