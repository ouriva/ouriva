// Theme Provider
// ==============
// Wraps the app with next-themes to enable dark/light mode.
//
// "use client" is required because this component uses browser
// APIs (localStorage, matchMedia). In Next.js App Router, all
// components are Server Components by default — they render on
// the server and ship zero JavaScript to the client. Adding
// "use client" makes this a Client Component that also runs in
// the browser. We keep client components minimal and push them
// to the edges of the component tree (like providers).

"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
