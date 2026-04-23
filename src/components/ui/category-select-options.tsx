// CategorySelectOptions
// =====================
// Renders grouped <SelectItem> / <SelectGroup> elements for a hierarchical
// category list. Drop this inside any <SelectContent> that needs to show
// parent → child categories. Shared between CategoryRulesList and
// TransactionList to avoid duplicating the same 23-line map block.

import {
  SelectGroup,
  SelectItem,
  SelectLabel,
} from "@/components/ui/select";

interface CategoryOption {
  id: string;
  name: string;
}

interface CategorySelectOptionsProps {
  parentCategories: CategoryOption[];
  childCategories: (CategoryOption & { parentId: string | null })[];
}

export function CategorySelectOptions({
  parentCategories,
  childCategories,
}: Readonly<CategorySelectOptionsProps>) {
  return (
    <>
      {parentCategories.map((parent) => {
        const children = childCategories.filter((c) => c.parentId === parent.id);
        if (children.length > 0) {
          return (
            <SelectGroup key={parent.id}>
              <SelectLabel>{parent.name}</SelectLabel>
              {children.map((child) => (
                <SelectItem key={child.id} value={child.id}>
                  {child.name}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        }
        return (
          <SelectItem key={parent.id} value={parent.id}>
            {parent.name}
          </SelectItem>
        );
      })}
    </>
  );
}
