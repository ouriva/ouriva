// API: POST /api/import/parse
// ===========================
// Accepts a file upload (FormData) and returns parsed headers + rows.
// The client uses this data to build the column mapping UI.
//
// FormData fields:
//   - file: the CSV or XLSX file
//   - skipRows (optional): number of header/metadata rows to skip
//   - delimiter (optional): CSV delimiter override

import { NextRequest, NextResponse } from "next/server";
import { parseFile } from "@/lib/import-parser";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: { message: "No file provided", code: "VALIDATION_ERROR" } },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: { message: "File too large (max 10 MB)", code: "VALIDATION_ERROR" } },
        { status: 400 }
      );
    }

    // Determine file type from extension
    const fileName = file.name.toLowerCase();
    let fileType: "csv" | "xlsx";
    if (fileName.endsWith(".csv")) {
      fileType = "csv";
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      fileType = "xlsx";
    } else {
      return NextResponse.json(
        { error: { message: "Unsupported file type. Use CSV or XLSX.", code: "VALIDATION_ERROR" } },
        { status: 400 }
      );
    }

    const skipRows = parseInt(formData.get("skipRows") as string) || 0;
    const delimiter = (formData.get("delimiter") as string) || undefined;

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseFile(buffer, fileType, { skipRows, delimiter });

    return NextResponse.json({
      data: {
        fileName: file.name,
        fileType,
        headers: parsed.headers,
        rows: parsed.rows,
        totalRows: parsed.rows.length,
      },
    });
  } catch (error) {
    console.error("POST /api/import/parse error:", error);
    return NextResponse.json(
      { error: { message: "Failed to parse file", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
