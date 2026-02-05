import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

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
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-slate-50">
          <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
            <div className="container mx-auto flex h-16 items-center px-4">
              <Link href="/" className="mr-6 flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-indigo-600">Mise en Place</span>
              </Link>
              <nav className="flex items-center space-x-6 text-sm font-medium">
                <Link href="/recipes" className="transition-colors hover:text-indigo-600">Recipes</Link>
                <Link href="/planner" className="transition-colors hover:text-indigo-600">Planner</Link>
                <Link href="/shopping" className="transition-colors hover:text-indigo-600">Shopping</Link>
              </nav>
              <div className="ml-auto flex items-center space-x-4">
                <Link href="/settings" className="text-sm font-medium transition-colors hover:text-indigo-600">Settings</Link>
                <button className="rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                  Login
                </button>
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
