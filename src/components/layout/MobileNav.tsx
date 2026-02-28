"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Calendar, ShoppingCart, Settings } from "lucide-react";

const NAV_ITEMS = [
    { href: "/recipes", label: "Recipes", Icon: BookOpen },
    { href: "/planner", label: "Planner", Icon: Calendar },
    { href: "/shopping", label: "Shopping", Icon: ShoppingCart },
    { href: "/settings", label: "Settings", Icon: Settings },
] as const;

export default function MobileNav() {
    const pathname = usePathname();

    return (
        <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-slate-200 bg-white/90 backdrop-blur-xl md:hidden dark:border-slate-800 dark:bg-slate-950/90">
            <div className="flex h-16 items-stretch">
                {NAV_ITEMS.map(({ href, label, Icon }) => {
                    const active = pathname === href || pathname.startsWith(href + "/");
                    return (
                        <Link
                            key={href}
                            href={href}
                            prefetch={false}
                            className={`flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold tracking-wide transition-colors
                ${active
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                }`}
                        >
                            <Icon
                                className={`h-5 w-5 transition-transform ${active ? "scale-110" : ""}`}
                                strokeWidth={active ? 2.25 : 1.75}
                            />
                            {label}
                        </Link>
                    );
                })}
            </div>
            {/* iOS safe area spacer */}
            <div className="h-[env(safe-area-inset-bottom)]" />
        </nav>
    );
}
