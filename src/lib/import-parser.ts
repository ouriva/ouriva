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

/**
 * Decode a buffer to text, auto-detecting encoding.
 * Tries UTF-8 first. If the result contains the Unicode replacement
 * character (U+FFFD), the file isn't valid UTF-8 — fall back to
 * Latin-1 (Windows-1252), which is common for European bank exports.
 */
function decodeBuffer(buffer: Buffer): string {
  const utf8 = buffer.toString("utf-8")
  if (!utf8.includes("\uFFFD")) {
    return utf8
  }
  // Latin-1 maps bytes 0x00–0xFF directly to Unicode code points,
  // so it never produces replacement characters.
  return buffer.toString("latin1")
}

function parseCsv(
  buffer: Buffer,
  skipRows: number,
  delimiter?: string
): ParsedFile {
  const text = decodeBuffer(buffer)

  // Skip rows on the raw text BEFORE parsing, so the count matches
  // physical line numbers in the file (including blank lines).
  // This avoids confusion when skipEmptyLines removes blanks.
  const lines = text.split(/\r?\n/)
  const remaining = lines.slice(skipRows).join("\n")

  const result = Papa.parse<string[]>(remaining, {
    header: false,
    skipEmptyLines: true,
    delimiter: delimiter || undefined, // undefined = auto-detect
  })

  if (result.data.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = result.data[0]
  const rows = result.data.slice(1)
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
