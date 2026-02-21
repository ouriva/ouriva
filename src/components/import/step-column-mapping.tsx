// Step 2: Column Mapping
// ======================
// User maps file columns to transaction fields (date, description, amount,
// and optionally reference). Shows a preview table with the first 5 rows
// so users can see their data while mapping.
//
// Users can also select a date format and optionally save the mapping
// as a reusable profile for future imports from the same bank.

"use client";

import { useState } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { ImportPreviewTable } from "./import-preview-table";
import type { ImportState } from "./import-wizard";
import type { ColumnMap } from "@/validators/import";

const DATE_FORMATS = [
  { value: "yyyy-MM-dd", label: "2026-01-15 (yyyy-MM-dd)" },
  { value: "dd/MM/yyyy", label: "15/01/2026 (dd/MM/yyyy)" },
  { value: "MM/dd/yyyy", label: "01/15/2026 (MM/dd/yyyy)" },
  { value: "dd-MM-yyyy", label: "15-01-2026 (dd-MM-yyyy)" },
  { value: "dd.MM.yyyy", label: "15.01.2026 (dd.MM.yyyy)" },
];

interface StepColumnMappingProps {
  state: ImportState;
  onComplete: (columnMap: ColumnMap, dateFormat: string) => void;
  onBack: () => void;
}

export function StepColumnMapping({
  state,
  onComplete,
  onBack,
}: StepColumnMappingProps) {
  const [columnMap, setColumnMap] = useState<ColumnMap>(state.columnMap);
  const [dateFormat, setDateFormat] = useState(state.dateFormat);
  const [profileName, setProfileName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Build column options from headers
  const columnOptions = state.headers.map((header, i) => ({
    value: String(i),
    label: `Col ${i}: ${header}`,
  }));

  // Track which columns are mapped (for highlighting)
  const highlightedColumns = new Set<number>();
  highlightedColumns.add(columnMap.date);
  highlightedColumns.add(columnMap.description);
  highlightedColumns.add(columnMap.amount);
  if (columnMap.reference !== undefined) {
    highlightedColumns.add(columnMap.reference);
  }

  const isValid =
    columnMap.date !== columnMap.description &&
    columnMap.date !== columnMap.amount &&
    columnMap.description !== columnMap.amount;

  async function handleSaveProfile() {
    if (!profileName.trim()) return;
    setIsSaving(true);

    try {
      await fetch("/api/import/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileName.trim(),
          fileType: state.fileType,
          columnMap,
          dateFormat,
          delimiter: null,
          skipRows: 0,
        }),
      });
      setProfileName("");
    } catch {
      // Silently fail — profile saving is optional
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        {/* File preview */}
        <div>
          <Label className="mb-2 block">Data Preview</Label>
          <ImportPreviewTable
            headers={state.headers}
            rows={state.rows}
            highlightedColumns={highlightedColumns}
          />
        </div>

        {/* Column mapping dropdowns */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Date Column</Label>
            <Select
              value={String(columnMap.date)}
              onValueChange={(v) =>
                setColumnMap((prev) => ({ ...prev, date: parseInt(v) }))
              }
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columnOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Description Column</Label>
            <Select
              value={String(columnMap.description)}
              onValueChange={(v) =>
                setColumnMap((prev) => ({ ...prev, description: parseInt(v) }))
              }
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columnOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Amount Column</Label>
            <Select
              value={String(columnMap.amount)}
              onValueChange={(v) =>
                setColumnMap((prev) => ({ ...prev, amount: parseInt(v) }))
              }
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columnOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Reference Column (optional)</Label>
            <Select
              value={columnMap.reference !== undefined ? String(columnMap.reference) : "none"}
              onValueChange={(v) =>
                setColumnMap((prev) => ({
                  ...prev,
                  reference: v === "none" ? undefined : parseInt(v),
                }))
              }
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not mapped</SelectItem>
                {columnOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Date format */}
        <div>
          <Label>Date Format</Label>
          <Select value={dateFormat} onValueChange={setDateFormat}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_FORMATS.map((fmt) => (
                <SelectItem key={fmt.value} value={fmt.value}>
                  {fmt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Save as profile (optional) */}
        <div>
          <Label>Save as Profile (optional)</Label>
          <div className="mt-2 flex gap-2">
            <Input
              placeholder="e.g., My Bank - Checking"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
            />
            <Button
              variant="outline"
              onClick={handleSaveProfile}
              disabled={!profileName.trim() || isSaving}
            >
              Save
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Back
          </Button>
          <Button
            onClick={() => onComplete(columnMap, dateFormat)}
            disabled={!isValid}
            className="flex-1"
          >
            Next: Review
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
