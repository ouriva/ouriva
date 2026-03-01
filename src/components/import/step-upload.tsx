// Step 1: Upload
// ===============
// User selects a file and target account, optionally loads a saved profile.
// On "Next", uploads the file to /api/import/parse and passes parsed
// data to the wizard.

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { FileDropzone } from "./file-dropzone";

interface Account {
  id: string;
  name: string;
  currency: { code: string; symbol: string };
}

interface ImportProfile {
  id: string;
  name: string;
  fileType: string;
  columnMap: Record<string, number>;
  dateFormat: string;
  delimiter: string | null;
  skipRows: number;
}

interface StepUploadProps {
  onComplete: (data: {
    fileName: string;
    fileType: "csv" | "xlsx";
    headers: string[];
    rows: string[][];
    accountId: string;
    skipRows: number;
    delimiter: string | null;
    profile?: ImportProfile;
  }) => void;
}

export function StepUpload({ onComplete }: StepUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState("");
  const [profileId, setProfileId] = useState("");
  const [skipRows, setSkipRows] = useState(0);
  const [delimiter, setDelimiter] = useState("auto");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [profiles, setProfiles] = useState<ImportProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load accounts and profiles on mount
  useEffect(() => {
    async function loadData() {
      const [accountsRes, profilesRes] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/import/profiles"),
      ]);

      if (accountsRes.ok) {
        const data = await accountsRes.json();
        setAccounts(data.data || data);
      }
      if (profilesRes.ok) {
        const data = await profilesRes.json();
        setProfiles(data.data || []);
      }
    }
    loadData();
  }, []);

  const selectedProfile = profiles.find((p) => p.id === profileId);

  async function handleNext() {
    if (!file || !accountId) return;

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Use profile values if selected, otherwise use the manual inputs
      const effectiveSkipRows = selectedProfile ? selectedProfile.skipRows : skipRows;
      formData.append("skipRows", String(effectiveSkipRows));

      const effectiveDelimiter = selectedProfile?.delimiter || (delimiter !== "auto" ? delimiter : null);
      if (effectiveDelimiter) {
        formData.append("delimiter", effectiveDelimiter);
      }

      const res = await fetch("/api/import/parse", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Failed to parse file");
      }

      const { data } = await res.json();

      // Pass the effective skipRows/delimiter so the wizard can store them
      // for later use (e.g., saving a profile in the column mapping step)
      const effectiveSkip = selectedProfile ? selectedProfile.skipRows : skipRows;
      const effectiveDelim = selectedProfile?.delimiter || (delimiter !== "auto" ? delimiter : null);

      onComplete({
        fileName: data.fileName,
        fileType: data.fileType,
        headers: data.headers,
        rows: data.rows,
        accountId,
        skipRows: effectiveSkip,
        delimiter: effectiveDelim,
        profile: selectedProfile,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-6 p-4">
        {/* File upload */}
        <div>
          <Label className="mb-2 block">Bank Statement File</Label>
          <FileDropzone onFileSelect={setFile} />
        </div>

        {/* Account selection */}
        <div>
          <Label>Target Account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Which account is this statement for?" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name} ({account.currency.symbol})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* CSV parsing options */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Delimiter</Label>
            <Select value={delimiter} onValueChange={setDelimiter}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect</SelectItem>
                <SelectItem value=";">Semicolon (;)</SelectItem>
                <SelectItem value=",">Comma (,)</SelectItem>
                <SelectItem value="\t">Tab</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              European CSVs typically use semicolons
            </p>
          </div>
          <div>
            <Label>Skip Rows</Label>
            <Input
              type="number"
              min="0"
              value={skipRows}
              onChange={(e) => setSkipRows(parseInt(e.target.value) || 0)}
              className="mt-2"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Skip metadata rows before the column headers
            </p>
          </div>
        </div>

        {/* Profile selection (optional) */}
        {profiles.length > 0 && (
          <div>
            <Label>Saved Profile (optional)</Label>
            <Select value={profileId} onValueChange={setProfileId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Use a saved column mapping" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Error message */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Next button */}
        <Button
          onClick={handleNext}
          disabled={!file || !accountId || isLoading}
          className="w-full"
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Next: Map Columns
        </Button>
      </CardContent>
    </Card>
  );
}
