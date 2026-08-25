// Simple Settings List
// ====================
// Reusable component for managing simple key/value entities
// like currencies and account types. Fetches from an API endpoint,
// displays items in cards, and provides add/edit/delete via sheets.

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Plus, Star } from "lucide-react";
import { SettingsItemForm } from "./settings-item-form";
import { useTranslations } from "next-intl";
import { useConfirm } from "@/hooks/use-confirm";

interface Field {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
}

interface SimpleSettingsListProps {
  apiEndpoint: string;
  title: string;
  pageTitle: string;
  pageDescription?: string;
  fields: Field[];
  displayField: string;    // which field to show as the main label
  subtitleField?: string;   // optional secondary text
  badgeField?: string;      // optional badge
  // When provided, adds a "Set as default" star button.
  // `isDefaultField` is the boolean field name on items (e.g. "isDefault").
  // `setDefaultAction` is the action name appended to apiEndpoint/:id (e.g. "set-default").
  isDefaultField?: string;
  setDefaultAction?: string;
}

export function SimpleSettingsList({
  apiEndpoint,
  title,
  pageTitle,
  pageDescription,
  fields,
  displayField,
  subtitleField,
  badgeField,
  isDefaultField,
  setDefaultAction,
}: Readonly<SimpleSettingsListProps>) {
  const tCommon = useTranslations("common");
  const { confirm } = useConfirm();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(apiEndpoint);
      if (cancelled) return;
      if (res.ok) {
        const data = await res.json();
        setItems(data.data);
      }
      setIsLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [apiEndpoint, refreshKey]);

  async function handleSetDefault(id: string) {
    if (!setDefaultAction) return;
    const res = await fetch(`${apiEndpoint}/${id}/${setDefaultAction}`, { method: "POST" });
    if (!res.ok) {
      const error = await res.json();
      alert(error.error?.message || tCommon("failedToSetDefault"));
      return;
    }
    setRefreshKey((k) => k + 1);
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      variant: "sheet",
      destructive: true,
      title: tCommon("deleteConfirm", { title: title.toLowerCase() }),
      confirmLabel: tCommon("delete"),
      cancelLabel: tCommon("cancel"),
    });
    if (!ok) return;

    const res = await fetch(`${apiEndpoint}/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const error = await res.json();
      alert(error.error?.message || tCommon("failedToDelete"));
      return;
    }
    setRefreshKey((k) => k + 1);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
          {pageDescription && (
            <p className="text-sm text-muted-foreground">{pageDescription}</p>
          )}
        </div>
        <SettingsItemForm
          title={title}
          fields={fields}
          apiEndpoint={apiEndpoint}
          onSuccess={() => setRefreshKey((k) => k + 1)}
          trigger={
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              {tCommon("add")}
            </Button>
          }
        />
      </div>

      <div className="space-y-4">

      {items.map((item) => {
        // Build initial values from all field names
        const initialValues: Record<string, string> = {};
        fields.forEach((f) => {
          if (item[f.name]) initialValues[f.name] = String(item[f.name]);
        });

        return (
          <Card key={item.id}>
            <CardContent className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-medium">{item[displayField]}</p>
                  {subtitleField && (
                    <p className="text-sm text-muted-foreground">
                      {item[subtitleField]}
                    </p>
                  )}
                </div>
                {badgeField && (
                  <Badge variant="outline">{item[badgeField]}</Badge>
                )}
                {isDefaultField && item[isDefaultField] && (
                  <Badge variant="secondary" className="gap-1">
                    <Star className="h-3 w-3 fill-current" />
                    {tCommon("defaultBadge")}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {isDefaultField && setDefaultAction && !item[isDefaultField] && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                    onClick={() => handleSetDefault(item.id)}
                    title={tCommon("setAsDefault")}
                  >
                    <Star className="h-5 w-5" />
                    <span className="sr-only">{tCommon("setAsDefault")}</span>
                  </Button>
                )}
                <SettingsItemForm
                  title={title}
                  fields={fields}
                  initialValues={initialValues}
                  apiEndpoint={apiEndpoint}
                  itemId={item.id}
                  onSuccess={() => setRefreshKey((k) => k + 1)}
                  trigger={
                    <Button variant="ghost" size="sm">
                      {tCommon("edit")}
                    </Button>
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 className="h-5 w-5" />
                  <span className="sr-only">{tCommon("delete")}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {items.length === 0 && (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          {tCommon("noItemsYet", { title: title.toLowerCase() })}
        </div>
      )}
      </div>
    </div>
  );
}
