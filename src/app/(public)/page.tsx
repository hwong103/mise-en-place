import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import HomeActions from "@/components/home/HomeActions";
import HomeJoinStatus from "@/components/home/HomeJoinStatus";

const highlights = [
  {
    title: "Save recipes",
    detail: "Keep one searchable place for dinner ideas.",
    href: "/recipes",
  },
  {
    title: "Plan the week",
    detail: "See what you are cooking before you shop.",
    href: "/planner",
  },
  {
    title: "Shop once",
    detail: "Turn the plan into a list you can use in store.",
    href: "/shopping",
  },
];

const isAuthDisabled = () => {
  if (/^(1|true|yes)$/i.test(process.env.DISABLE_AUTH ?? "")) {
    return true;
  }

  return /^(1|true|yes)$/i.test(process.env.NEXT_PUBLIC_DISABLE_AUTH ?? "");
};

export default function HomePage() {
  const authDisabled = isAuthDisabled();

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <HomeJoinStatus />
      </Suspense>

      <section className="max-w-4xl space-y-8 py-2 md:py-6">
        <div className="space-y-4">
          <h1 className="max-w-[12ch] text-4xl leading-[0.98] tracking-[-0.05em] sm:text-5xl md:text-6xl">
            Plan dinner once. Shop once. Cook calmly.
          </h1>
          <p className="ui-copy-muted max-w-[58ch] text-base leading-relaxed">
            Recipes, weekly planning, and shopping stay in one flow so anyone at home can pick up the next meal.
          </p>
        </div>

        <HomeActions authDisabled={authDisabled} />

        <div className="ui-divider max-w-3xl divide-y border-t">
          {highlights.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group flex items-start justify-between gap-4 py-4 transition-colors first:pt-5"
            >
              <div className="min-w-0 space-y-1">
                <h2 className="text-base font-semibold tracking-tight">{item.title}</h2>
                <p className="ui-copy-muted text-sm leading-relaxed">{item.detail}</p>
              </div>
              <ArrowRight className="ui-copy-muted mt-1 h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
