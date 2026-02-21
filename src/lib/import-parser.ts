import Papa from "papaparse"
import readXlsxFile from "read-excel-file"
import { createHash } from "crypto"

export type ParsedFile = {
  headers: string[]
  rows: string[][]
}

export type ColumnMap = {
  date: number
  description: number
  amount: number
  reference?: number
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
  // read-excel-file expects a Buffer directly in Node.js
  const sheetRows = await readXlsxFile(buffer)
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

/**
 * Generate a deterministic importRef for a transaction row.
 *
 * When a bank reference column is mapped, uses that directly for the most
 * reliable dedup: `imp_ref_<accountId>_<reference>`.
 *
 * Otherwise, hashes the transaction data with an occurrence counter:
 * `imp_<sha256(accountId|date|description|amount|occurrenceCounter)>`.
 *
 * The occurrence counter tracks how many times the same (date, description, amount)
 * tuple has appeared before this row in the file. This ensures the same transaction
 * produces the same hash regardless of its row position in overlapping files.
 */
export function generateImportRef(params: {
  accountId: string
  date: string
  description: string
  amount: string
  reference?: string
  occurrenceCounter: number
}): string {
  if (params.reference) {
    return `imp_ref_${params.accountId}_${params.reference}`
  }

  const data = [
    params.accountId,
    params.date,
    params.description,
    params.amount,
    String(params.occurrenceCounter),
  ].join("|")

  const hash = createHash("sha256").update(data).digest("hex").slice(0, 16)
  return `imp_${hash}`
}

/**
 * Build occurrence counters for a set of rows.
 * Returns an array of counters, one per row, where each counter represents
 * how many times the same (date, description, amount) tuple appeared
 * before that row.
 */
export function buildOccurrenceCounters(
  rows: string[][],
  columnMap: ColumnMap
): number[] {
  const seen = new Map<string, number>()
  return rows.map((row) => {
    const key = [
      row[columnMap.date] ?? "",
      row[columnMap.description] ?? "",
      row[columnMap.amount] ?? "",
    ].join("|")
    const count = seen.get(key) ?? 0
    seen.set(key, count + 1)
    return count
  })
}
