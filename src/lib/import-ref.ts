// Import Reference Generator
// ==========================
// Client-safe utilities for generating importRef hashes and
// building occurrence counters. These run in the browser during
// the import wizard's Review step.
//
// Uses the Web Crypto API (available in all modern browsers)
// instead of Node.js crypto, so this module works client-side.

export type ColumnMap = {
  date: number
  description: number
  // Single amount column (positive = income, negative = expense)
  amount?: number
  // Split columns (European banks: separate Debit and Credit columns)
  debitAmount?: number
  creditAmount?: number
  // Optional bank reference for most reliable dedup
  reference?: number
}

/**
 * Get the raw amount string from a row, handling both single and split columns.
 * For split columns, returns whichever column has a value (debit or credit).
 */
export function getAmountString(row: string[], columnMap: ColumnMap): string {
  if (columnMap.amount !== undefined) {
    return row[columnMap.amount] ?? ""
  }
  // Split columns: return the non-empty one
  const debit = columnMap.debitAmount !== undefined ? (row[columnMap.debitAmount] ?? "") : ""
  const credit = columnMap.creditAmount !== undefined ? (row[columnMap.creditAmount] ?? "") : ""
  return debit.trim() || credit.trim() || ""
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
export async function generateImportRef(params: {
  accountId: string
  date: string
  description: string
  amount: string
  reference?: string
  occurrenceCounter: number
}): Promise<string> {
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

  // Web Crypto API — works in browsers and Edge Runtime
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")

  return `imp_${hashHex.slice(0, 16)}`
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
      getAmountString(row, columnMap),
    ].join("|")
    const count = seen.get(key) ?? 0
    seen.set(key, count + 1)
    return count
  })
}
