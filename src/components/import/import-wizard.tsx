// Import Wizard
// =============
// Multi-step wizard that orchestrates the bank statement import flow.
// Manages shared state across 4 steps:
//   1. Upload — file + account selection
//   2. Map Columns — map file columns to transaction fields
//   3. Review — preview, select, and categorize transactions
//   4. Confirm — summary and final import
//
// State is lifted to this component so steps can communicate.
// Each step is a separate component that receives state + callbacks.

"use client";

import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { StepUpload } from "./step-upload";
import { StepColumnMapping } from "./step-column-mapping";
import { StepReview } from "./step-review";
import { StepConfirm } from "./step-confirm";
import type { ColumnMap } from "@/validators/import";

// Shared state shape for the import wizard
export interface ImportState {
  // Step 1: Upload
  fileName: string;
  fileType: "csv" | "xlsx";
  headers: string[];
  rows: string[][];
  accountId: string;

  // Step 2: Column mapping
  columnMap: ColumnMap;
  dateFormat: string;

  // Step 3: Review
  selectedRows: boolean[];
  categoryIds: (string | undefined)[];
  transactionTypes: ("INCOME" | "EXPENSE")[];
  importRefs: string[];
  duplicateRefs: Set<string>;
}

const STEP_LABELS = ["Upload", "Map Columns", "Review", "Confirm"];

export function ImportWizard() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<ImportState | null>(null);

  const progressPercent = ((step + 1) / STEP_LABELS.length) * 100;

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          {STEP_LABELS.map((label, i) => (
            <span
              key={label}
              className={i <= step ? "font-medium text-foreground" : ""}
            >
              {label}
            </span>
          ))}
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Step content */}
      {step === 0 && (
        <StepUpload
          onComplete={(data) => {
            setState({
              ...data,
              columnMap: { date: 0, description: 1, amount: 2 },
              dateFormat: "yyyy-MM-dd",
              selectedRows: [],
              categoryIds: [],
              transactionTypes: [],
              importRefs: [],
              duplicateRefs: new Set(),
            });
            setStep(1);
          }}
        />
      )}

      {step === 1 && state && (
        <StepColumnMapping
          state={state}
          onComplete={(columnMap, dateFormat) => {
            setState((prev) => prev ? { ...prev, columnMap, dateFormat } : prev);
            setStep(2);
          }}
          onBack={() => setStep(0)}
        />
      )}

      {step === 2 && state && (
        <StepReview
          state={state}
          onComplete={(selectedRows, categoryIds, transactionTypes, importRefs, duplicateRefs) => {
            setState((prev) =>
              prev
                ? { ...prev, selectedRows, categoryIds, transactionTypes, importRefs, duplicateRefs }
                : prev
            );
            setStep(3);
          }}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && state && (
        <StepConfirm
          state={state}
          onBack={() => setStep(2)}
        />
      )}
    </div>
  );
}
