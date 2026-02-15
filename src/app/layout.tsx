import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import AuthStatus from "@/components/auth/AuthStatus";
import ThemeToggle from "@/components/theme/ThemeToggle";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mise en Place",
  description: "Your household recipe repository & prep-efficiency tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
          <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-slate-800 dark:bg-slate-950/90 dark:supports-[backdrop-filter]:bg-slate-950/70">
            <div className="container mx-auto flex h-16 items-center px-4">
              <Link href="/" className="mr-6 flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-indigo-600">Mise en Place</span>
              </Link>
              <nav className="flex items-center space-x-6 text-sm font-medium text-slate-600 dark:text-slate-300">
                <Link href="/recipes" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">Recipes</Link>
                <Link href="/planner" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">Planner</Link>
                <Link href="/shopping" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">Shopping</Link>
              </nav>
              <div className="ml-auto flex items-center space-x-4">
                <ThemeToggle />
                <Link href="/settings" className="text-sm font-medium text-slate-600 transition-colors hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400">Settings</Link>
                <AuthStatus />
              </div>
            </div>
          </header>
          <main className="container mx-auto p-4 md:p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
