// Step 1: Upload
// ===============
// User selects a file and target account, optionally loads a saved profile.
// On "Next", uploads the file to /api/import/parse and passes parsed
// data to the wizard.

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
    profile?: ImportProfile;
  }) => void;
}

export function StepUpload({ onComplete }: StepUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState("");
  const [profileId, setProfileId] = useState("");
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
      if (selectedProfile) {
        formData.append("skipRows", String(selectedProfile.skipRows));
        if (selectedProfile.delimiter) {
          formData.append("delimiter", selectedProfile.delimiter);
        }
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

      onComplete({
        fileName: data.fileName,
        fileType: data.fileType,
        headers: data.headers,
        rows: data.rows,
        accountId,
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
      <CardContent className="space-y-6 pt-6">
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
