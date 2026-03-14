import Link from "next/link";
import { Suspense } from "react";

import AuthStatus from "@/components/auth/AuthStatus";
import GuestSessionHeartbeat from "@/components/auth/GuestSessionHeartbeat";
import BrandLogo from "@/components/layout/BrandLogo";
import HeaderAccessControls from "@/components/layout/HeaderAccessControls";
import MobileNav from "@/components/layout/MobileNav";
import NavigationPerfLogger from "@/components/perf/NavigationPerfLogger";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { ToastProvider } from "@/components/ui/Toast";

const navItems = [
  { href: "/recipes", label: "Recipes" },
  { href: "/planner", label: "Planner" },
  { href: "/shopping", label: "Shopping" },
  { href: "/cellar", label: "Cellar" },
];

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <GuestSessionHeartbeat />
      <Suspense fallback={null}>
        <NavigationPerfLogger />
      </Suspense>
      <header className="sticky top-0 z-40 border-b border-emerald-900/10 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/75 dark:border-emerald-200/10 dark:bg-slate-950/80 dark:supports-[backdrop-filter]:bg-slate-950/55">
        <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center px-4 md:px-8">
          <Link href="/" className="mr-8 flex items-center gap-2">
            <BrandLogo />
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
            <Suspense fallback={<AuthStatus />}>
              <HeaderAccessControls />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 pb-24 md:px-8 md:py-10 md:pb-10">
        <ToastProvider>{children}</ToastProvider>
      </main>
      <MobileNav />
    </>
  );
}
