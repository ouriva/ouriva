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
}: Readonly<ImportPreviewTableProps>) {
  const t = useTranslations("import");

  // Pre-process data with stable keys before rendering so the JSX maps
  // don't reference the array index parameter as a React key (S6479).
  const colDefs = headers.map((header, i) => ({ colKey: `col-${i}`, header, colIndex: i }));
  const rowDefs = rows.slice(0, maxRows).map((row, rowIdx) => ({
    rowKey: `row-${rowIdx}`,
    cells: row.map((cell, colIdx) => ({ cellKey: `cell-${colIdx}`, cell, colIndex: colIdx })),
  }));

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {colDefs.map(({ colKey, header, colIndex }) => (
              <th
                key={colKey}
                className={`whitespace-nowrap px-3 py-2 text-left font-medium ${
                  highlightedColumns?.has(colIndex) ? "bg-primary/10 text-primary" : ""
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    Col {colIndex}
                  </span>
                  {header}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowDefs.map(({ rowKey, cells }) => (
            <tr key={rowKey} className="border-b last:border-0">
              {cells.map(({ cellKey, cell, colIndex }) => (
                <td
                  key={cellKey}
                  className={`whitespace-nowrap px-3 py-1.5 ${
                    highlightedColumns?.has(colIndex) ? "bg-primary/5" : ""
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
