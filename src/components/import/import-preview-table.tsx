// Import Preview Table
// ====================
// Shows a compact preview of parsed file data (headers + first N rows).
// Used in the column mapping step so users can see their data while
// mapping columns to transaction fields.
//
// The table scrolls horizontally for files with many columns —
// important for mobile since bank statements often have 10+ columns.

"use client";

import { useTranslations } from "next-intl";

interface ImportPreviewTableProps {
  headers: string[];
  rows: string[][];
  maxRows?: number;
  highlightedColumns?: Set<number>;
}

export function ImportPreviewTable({
  headers,
  rows,
  maxRows = 5,
  highlightedColumns,
}: ImportPreviewTableProps) {
  const t = useTranslations("import");
  const previewRows = rows.slice(0, maxRows);

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {headers.map((header, i) => (
              <th
                key={i}
                className={`whitespace-nowrap px-3 py-2 text-left font-medium ${
                  highlightedColumns?.has(i) ? "bg-primary/10 text-primary" : ""
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    Col {i}
                  </span>
                  {header}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {previewRows.map((row, rowIdx) => (
            <tr key={rowIdx} className="border-b last:border-0">
              {row.map((cell, colIdx) => (
                <td
                  key={colIdx}
                  className={`whitespace-nowrap px-3 py-1.5 ${
                    highlightedColumns?.has(colIdx) ? "bg-primary/5" : ""
                  }`}
                >
                  {cell || <span className="text-muted-foreground">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <div className="border-t px-3 py-1.5 text-center text-xs text-muted-foreground">
          {t("showingRows", { max: maxRows, total: rows.length })}
        </div>
      )}
    </div>
  );
}
