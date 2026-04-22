// File Dropzone
// =============
// Drag-and-drop file upload component for CSV and XLSX files.
// Uses native HTML drag events — no library needed.
//
// How drag-and-drop works in browsers:
//   1. User drags a file over the drop zone → "dragover" fires
//   2. We call e.preventDefault() to tell the browser we accept drops
//   3. User releases → "drop" fires with the file in e.dataTransfer.files
//   4. We extract the File object and pass it up via onChange
//
// The component also supports clicking to open a file picker as a fallback.

"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  accept?: string;
}

export function FileDropzone({
  onFileSelect,
  accept = ".csv,.xlsx,.xls",
}: Readonly<FileDropzoneProps>) {
  const t = useTranslations("import");
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setFileName(file.name);
      onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => inputRef.current?.click()}
      className={`
        flex cursor-pointer flex-col items-center justify-center rounded-lg
        border-2 border-dashed p-8 text-center transition-colors
        ${isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50"
        }
      `}
    >
      <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
      {fileName ? (
        <p className="text-sm font-medium">{fileName}</p>
      ) : (
        <>
          <p className="text-sm font-medium">
            {t("fileDropPrompt")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("fileDropHint")}
          </p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
