// Import Step Review Utilities
// ============================
// Shared parsing functions used by both the Review and Confirm steps.
// Extracted here to avoid circular imports between step components.

/**
 * Parse a date string according to the specified format.
 * Returns an ISO date string (yyyy-MM-dd).
 */
export function parseDate(value: string, format: string): string {
  const cleaned = value.trim();

  let day: string, month: string, year: string;

  if (format === "yyyy-MM-dd") {
    const parts = cleaned.split(/[-/]/);
    [year, month, day] = parts;
  } else if (
    format === "dd/MM/yyyy" ||
    format === "dd-MM-yyyy" ||
    format === "dd.MM.yyyy"
  ) {
    const parts = cleaned.split(/[/\-.]/);
    [day, month, year] = parts;
  } else if (format === "MM/dd/yyyy") {
    const parts = cleaned.split(/[/\-.]/);
    [month, day, year] = parts;
  } else {
    // Fallback: try native parsing
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0];
    }
    return cleaned;
  }

  day = day?.padStart(2, "0");
  month = month?.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Parse an amount string, handling different number formats.
 * European: 1.234,56 (dots as thousands, comma as decimal)
 * US/UK:    1,234.56 (commas as thousands, dot as decimal)
 */
export function parseAmount(value: string): number {
  let cleaned = value.trim();

  // Remove currency symbols and whitespace
  cleaned = cleaned.replace(/[^\d,.\-+]/g, "");

  // Detect format: if last separator is a comma with 1-2 digits after → European
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  if (lastComma > lastDot && cleaned.length - lastComma <= 3) {
    // European format: remove dots (thousands), replace comma with dot (decimal)
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    // US format: remove commas (thousands)
    cleaned = cleaned.replace(/,/g, "");
  }

  return parseFloat(cleaned) || 0;
}
