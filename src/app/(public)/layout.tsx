import Link from "next/link";

import BrandLogo from "@/components/layout/BrandLogo";
import ThemeToggle from "@/components/theme/ThemeToggle";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-emerald-900/10 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/75 dark:border-emerald-200/10 dark:bg-slate-950/80 dark:supports-[backdrop-filter]:bg-slate-950/55">
        <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2">
            <BrandLogo />
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:border-emerald-200 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-emerald-400/40 dark:hover:text-emerald-300"
            >
              Login
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-10">{children}</main>
    </>
  );
}
