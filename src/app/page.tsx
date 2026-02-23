import Link from "next/link";
import { ArrowRight, Calendar, ClipboardList, ShoppingBasket, UtensilsCrossed } from "lucide-react";

const highlights = [
  {
    title: "Recipe Library",
    detail: "Import URLs, extract cookbook pages with OCR, and keep one searchable source of truth.",
    href: "/recipes",
    icon: UtensilsCrossed,
  },
  {
    title: "7-Day Planner",
    detail: "Drag and schedule dinner plans by day so your week is clear before grocery runs.",
    href: "/planner",
    icon: Calendar,
  },
  {
    title: "Smart Shopping",
    detail: "Generate grouped ingredient lists from planned recipes and check off items in-store.",
    href: "/shopping",
    icon: ShoppingBasket,
  },
  {
    title: "Quick Capture",
    detail: "Add recipe notes and prep details fast so anyone in the household can cook.",
    href: "/recipes#add-recipe",
    icon: ClipboardList,
  },
];

const isAuthDisabled = () => {
  if (/^(1|true|yes)$/i.test(process.env.DISABLE_AUTH ?? "")) {
    return true;
  }

  const isPreview = (process.env.VERCEL_ENV ?? "").toLowerCase() === "preview";
  return isPreview && /^(1|true|yes)$/i.test(process.env.NEXT_PUBLIC_DISABLE_AUTH ?? "");
};

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const authDisabled = isAuthDisabled();
  const resolvedSearchParams = (await searchParams) ?? {};
  const joinStatus = Array.isArray(resolvedSearchParams.join)
    ? resolvedSearchParams.join[0]
    : resolvedSearchParams.join;

  return (
    <div className="space-y-6">
      {joinStatus === "invalid" ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          That household invite link is invalid or expired. Ask the household manager for a new link.
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-emerald-900/10 bg-white px-6 py-8 shadow-[0_20px_40px_-20px_rgba(5,46,22,0.2)] md:px-10 md:py-12 dark:border-emerald-200/10 dark:bg-slate-900/70">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Household Meal OS</p>
          <h1 className="mt-5 text-4xl leading-none tracking-tighter text-slate-900 md:text-6xl dark:text-slate-100">
            Plan dinners with fewer tabs, fewer texts, and fewer forgotten ingredients.
          </h1>
          <p className="mt-6 max-w-[65ch] text-base leading-relaxed text-slate-600 dark:text-slate-300">
            Mise en Place keeps recipes, weekly planning, and grocery execution in one shared flow so anyone can pick up dinner without guesswork.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/recipes"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-transform duration-300 hover:bg-emerald-600 active:translate-y-[1px]"
            >
              Open Recipes
              <ArrowRight className="h-4 w-4" />
            </Link>
            {authDisabled ? (
              <Link
                href="/recipes"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors duration-300 hover:border-emerald-200 hover:text-emerald-700 active:translate-y-[1px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-emerald-400/40 dark:hover:text-emerald-300"
              >
                Continue Without Login
              </Link>
            ) : (
              <form method="post" action="/start-household">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors duration-300 hover:border-emerald-200 hover:text-emerald-700 active:translate-y-[1px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-emerald-400/40 dark:hover:text-emerald-300"
                >
                  Start Without Login
                </button>
              </form>
            )}
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors duration-300 hover:border-emerald-200 hover:text-emerald-700 active:translate-y-[1px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-emerald-400/40 dark:hover:text-emerald-300"
            >
              Login / Claim
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {highlights.map((item, index) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-3xl border border-slate-200/90 bg-white px-5 py-5 transition duration-300 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_16px_28px_-20px_rgba(5,46,22,0.35)] active:translate-y-[1px] dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-emerald-500/30"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-2.5 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">{item.title}</h2>
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.detail}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </div>
  );
}
