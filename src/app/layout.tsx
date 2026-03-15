import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Suspense } from "react";
import AuthStatus from "@/components/auth/AuthStatus";
import GuestSessionHeartbeat from "@/components/auth/GuestSessionHeartbeat";
import NavigationPerfLogger from "@/components/perf/NavigationPerfLogger";
import HeaderAccessControls from "@/components/layout/HeaderAccessControls";
import ThemeToggle from "@/components/theme/ThemeToggle";
import BrandLogo from "@/components/layout/BrandLogo";
import LayoutViewport from "@/components/layout/LayoutViewport";

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
  { href: "/cellar", label: "Cellar" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var isDark = saved === 'dark' || ((!saved || saved === 'system') && prefersDark);
                  document.documentElement.classList.toggle('dark', isDark);
                  document.documentElement.classList.toggle('light', !isDark);
                  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <GuestSessionHeartbeat />
        <Suspense fallback={null}>
          <NavigationPerfLogger />
        </Suspense>
        <div className="min-h-[100dvh]" style={{ color: "var(--foreground)" }}>
          <header className="ui-shell-bar sticky top-0 z-40">
            <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center px-4 md:px-8">
              <Link href="/" className="mr-8 flex items-center gap-2">
                <BrandLogo />
              </Link>

              <nav className="ui-nav-shell hidden items-center gap-1 md:flex">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    className="ui-nav-link"
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
          <LayoutViewport>{children}</LayoutViewport>
        </div>
      </body>
    </html>
  );
}
