import {
  SelectGroup,
  SelectItem,
  SelectLabel,
} from "@/components/ui/select";

interface Category {
  id: string;
  name: string;
  parentId: string | null;
}

interface CategorySelectOptionsProps {
  parentCategories: Category[];
  childCategories: Category[];
}

// Renders grouped parent/child category options for use inside any <SelectContent>.
// Does not include the "none" / "no category" option — callers add that themselves.
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
