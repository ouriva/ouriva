// Import File Parser (Server-only)
// =================================
// Parses CSV and XLSX files on the server side.
// This module uses Node.js Buffer and libraries that only work
// server-side — it should NOT be imported by client components.
//
// For client-safe utilities (importRef generation, occurrence counters),
// see import-ref.ts.

import Papa from "papaparse"
import readXlsxFile from "read-excel-file"

export type ParsedFile = {
  headers: string[]
  rows: string[][]
}

/**
 * Parse a CSV or XLSX file into headers + rows.
 * Optionally skip a number of leading rows (e.g., bank metadata lines).
 * For CSV, an optional delimiter override can be provided (null = auto-detect).
 */
export async function parseFile(
  buffer: Buffer,
  fileType: "csv" | "xlsx",
  options?: { skipRows?: number; delimiter?: string | null }
): Promise<ParsedFile> {
  const skipRows = options?.skipRows ?? 0

  if (fileType === "csv") {
    return parseCsv(buffer, skipRows, options?.delimiter ?? undefined)
  }
  return parseXlsx(buffer, skipRows)
}

function parseCsv(
  buffer: Buffer,
  skipRows: number,
  delimiter?: string
): ParsedFile {
  const text = buffer.toString("utf-8")
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
    delimiter: delimiter || undefined, // undefined = auto-detect
  })

  const allRows = result.data.slice(skipRows)
  if (allRows.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = allRows[0]
  const rows = allRows.slice(1)
  return { headers, rows }
}

async function parseXlsx(
  buffer: Buffer,
  skipRows: number
): Promise<ParsedFile> {
  // read-excel-file expects an ArrayBuffer in newer versions
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer
  const sheetRows = await readXlsxFile(arrayBuffer)
  const allRows = sheetRows.slice(skipRows)
  if (allRows.length === 0) {
    return { headers: [], rows: [] }
  }

  // Convert all cell values to strings
  const headers = allRows[0].map((cell) => String(cell ?? ""))
  const rows = allRows.slice(1).map((row) =>
    row.map((cell) => String(cell ?? ""))
  )
  return { headers, rows }
}
