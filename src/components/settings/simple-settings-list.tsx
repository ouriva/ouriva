// Simple Settings List
// ====================
// Reusable component for managing simple key/value entities
// like currencies and account types. Fetches from an API endpoint,
// displays items in cards, and provides add/edit/delete via sheets.

"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { SettingsItemForm } from "./settings-item-form";

interface Field {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
}

interface SimpleSettingsListProps {
  apiEndpoint: string;
  title: string;
  fields: Field[];
  displayField: string;    // which field to show as the main label
  subtitleField?: string;   // optional secondary text
  badgeField?: string;      // optional badge
}

export function SimpleSettingsList({
  apiEndpoint,
  title,
  fields,
  displayField,
  subtitleField,
  badgeField,
}: SimpleSettingsListProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const res = await fetch(apiEndpoint);
    if (res.ok) {
      const data = await res.json();
      setItems(data.data);
    }
    setIsLoading(false);
  }, [apiEndpoint]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleDelete(id: string) {
    if (!confirm(`Delete this ${title.toLowerCase()}?`)) return;

    const res = await fetch(`${apiEndpoint}/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const error = await res.json();
      alert(error.error?.message || "Failed to delete");
      return;
    }
    fetchData();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <SettingsItemForm
          title={title}
          fields={fields}
          apiEndpoint={apiEndpoint}
          onSuccess={fetchData}
        />
      </div>

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
              </div>
              <div className="flex items-center gap-1">
                <SettingsItemForm
                  title={title}
                  fields={fields}
                  initialValues={initialValues}
                  apiEndpoint={apiEndpoint}
                  itemId={item.id}
                  onSuccess={fetchData}
                  trigger={
                    <Button variant="ghost" size="sm">
                      Edit
                    </Button>
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {items.length === 0 && (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          No {title.toLowerCase()}s yet
        </div>
      )}
    </div>
  );
}
