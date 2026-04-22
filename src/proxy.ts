// Proxy
// =====
// Next.js 16 renamed middleware.ts to proxy.ts, and the exported function
// must be named "proxy" (previously "middleware"). This file runs on every
// request that matches config.matcher.
//
// We keep this as a passthrough — locale detection is handled entirely in
// src/i18n/request.ts by reading the NEXT_LOCALE cookie directly, which
// works without any proxy involvement.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"], // NOSONAR — String.raw cannot be used here: Next.js requires a static string literal in config.matcher
};
