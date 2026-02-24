import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Suspense } from "react";
import AuthStatus from "@/components/auth/AuthStatus";
import GuestSessionHeartbeat from "@/components/auth/GuestSessionHeartbeat";
import NavigationPerfLogger from "@/components/perf/NavigationPerfLogger";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { getCurrentAccessContext } from "@/lib/household";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Mise en Place",
  description: "Your household recipe repository & prep-efficiency tool",
};

const navItems = [
  { href: "/recipes", label: "Recipes" },
  { href: "/planner", label: "Planner" },
  { href: "/shopping", label: "Shopping" },
];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let hasHouseholdAccess = false;
  let showSettings = false;
  let accessSource: "guest" | "auth" | "bootstrap" | null = null;

  try {
    const accessContext = await getCurrentAccessContext("throw");
    hasHouseholdAccess = true;
    showSettings = accessContext.canManageLink;
    accessSource = accessContext.source;
  } catch {
    // Anonymous visitors can still access public routes.
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <GuestSessionHeartbeat />
        <Suspense fallback={null}>
          <NavigationPerfLogger />
        </Suspense>
        <div className="min-h-[100dvh] text-slate-900 dark:text-slate-100">
          <header className="sticky top-0 z-40 border-b border-emerald-900/10 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/75 dark:border-emerald-200/10 dark:bg-slate-950/80 dark:supports-[backdrop-filter]:bg-slate-950/55">
            <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center px-4 md:px-8">
              <Link href="/" className="mr-8 flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                  MP
                </span>
                <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">Mise en Place</span>
              </Link>

              <nav className="hidden items-center gap-1 rounded-full border border-slate-200/80 bg-white/80 p-1 md:flex dark:border-slate-800 dark:bg-slate-900/70">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-full px-4 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="ml-auto flex items-center gap-3">
                <ThemeToggle />
                {showSettings ? (
                  <Link
                    href="/settings"
                    className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-emerald-200 hover:text-emerald-700 md:inline-flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-emerald-400/30 dark:hover:text-emerald-300"
                  >
                    Settings
                  </Link>
                ) : null}
                <AuthStatus hasHouseholdAccess={hasHouseholdAccess} accessSource={accessSource} />
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
