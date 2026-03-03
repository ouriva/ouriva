// Category Rule Matching
// ======================
// Pure client-safe utility for applying auto-categorization rules to a
// transaction description. Used in the import review step to pre-fill
// category dropdowns before the user confirms.
//
// Rules must be passed pre-sorted by priority desc, createdAt asc
// (the order returned by GET /api/category-rules). The first matching
// active rule wins.

export interface CategoryRuleInput {
  pattern:    string;
  matchType:  "CONTAINS" | "STARTS_WITH" | "EXACT" | "REGEX";
  categoryId: string;
  isActive:   boolean;
}

function ruleMatches(description: string, rule: CategoryRuleInput): boolean {
  const text = description.toLowerCase();
  const pat  = rule.pattern.toLowerCase();

  switch (rule.matchType) {
    case "CONTAINS":
      return text.includes(pat);
    case "STARTS_WITH":
      return text.startsWith(pat);
    case "EXACT":
      return text === pat;
    case "REGEX":
      try {
        return new RegExp(rule.pattern, "i").test(description);
      } catch {
        // Invalid regex — skip silently rather than crashing
        return false;
      }
  }
}

// Returns the categoryId of the first matching active rule, or undefined.
// Pass rules sorted by priority desc, createdAt asc (API default order).
export function matchCategory(
  description: string,
  rules: CategoryRuleInput[]
): string | undefined {
  for (const rule of rules) {
    if (rule.isActive && ruleMatches(description, rule)) {
      return rule.categoryId;
    }
  }
  return undefined;
}
