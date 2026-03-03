// Category Rule Matching
// ======================
// Pure client-safe utility for applying auto-categorization rules to a
// transaction description. Used in the import review step to pre-fill
// the category dropdown and display name before the user confirms.
//
// Rules must be passed pre-sorted by priority desc, createdAt asc
// (the order returned by GET /api/category-rules). The first matching
// active rule wins.

export interface CategoryRuleInput {
  pattern:      string;
  matchType:    "CONTAINS" | "STARTS_WITH" | "EXACT" | "REGEX";
  categoryId:   string;
  friendlyName: string | null;
  isActive:     boolean;
}

export interface RuleMatch {
  categoryId:   string;
  friendlyName: string | null;
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

// Returns the categoryId and optional friendlyName of the first matching
// active rule, or undefined if no rule matches.
// Pass rules sorted by priority desc, createdAt asc (API default order).
export function matchRule(
  description: string,
  rules: CategoryRuleInput[]
): RuleMatch | undefined {
  for (const rule of rules) {
    if (rule.isActive && ruleMatches(description, rule)) {
      return { categoryId: rule.categoryId, friendlyName: rule.friendlyName ?? null };
    }
  }
  return undefined;
}
