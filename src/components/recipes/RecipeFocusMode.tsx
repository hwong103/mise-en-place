"use client";

import { useEffect, useState } from "react";

type PrepGroup = {
  title: string;
  items: string[];
};

type RecipeFocusModeProps = {
  title: string;
  prepGroups: PrepGroup[];
  ingredients: string[];
  instructions: string[];
};

type FocusMode = "mise" | "cook";

type WakeLockSentinelLike = {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: "release", listener: () => void) => void;
  removeEventListener?: (type: "release", listener: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

export default function RecipeFocusMode({
  title,
  prepGroups,
  ingredients,
  instructions,
}: RecipeFocusModeProps) {
  const [mode, setMode] = useState<FocusMode | null>(null);

  useEffect(() => {
    if (!mode) {
      return;
    }

    const nav = navigator as NavigatorWithWakeLock;
    if (!nav.wakeLock?.request) {
      return;
    }

    let sentinel: WakeLockSentinelLike | null = null;
    let mounted = true;
    let requesting = false;
    const onRelease = () => {
      sentinel = null;
      if (mounted && mode) {
        void requestWakeLock();
      }
    };

    const requestWakeLock = async () => {
      if (requesting || !mounted || document.visibilityState !== "visible") {
        return;
      }
      if (sentinel && !sentinel.released) {
        return;
      }

      requesting = true;
      try {
        const lock = await nav.wakeLock.request("screen");
        if (!mounted) {
          void lock.release();
          return;
        }
        sentinel = lock;
        lock.addEventListener?.("release", onRelease);
      } catch {
        sentinel = null;
      } finally {
        requesting = false;
      }
    };

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
      }
    };

    void requestWakeLock();
    document.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("focus", onVisibilityOrFocus);

    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("focus", onVisibilityOrFocus);
      if (sentinel) {
        sentinel.removeEventListener?.("release", onRelease);
        void sentinel.release();
      }
    };
  }, [mode]);

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setMode("mise")}
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/40"
        >
          Mise
        </button>
        <button
          type="button"
          onClick={() => setMode("cook")}
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/40"
        >
          Cook
        </button>
      </div>

      {mode ? (
        <div className="fixed inset-0 z-50 p-3 md:p-6">
          <div className="mx-auto flex h-[94dvh] w-full max-w-7xl flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">
                  Focus Mode
                </p>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode("mise")}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    mode === "mise"
                      ? "bg-amber-500 text-slate-950"
                      : "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300"
                  }`}
                >
                  Mise
                </button>
                <button
                  type="button"
                  onClick={() => setMode("cook")}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    mode === "cook"
                      ? "bg-amber-500 text-slate-950"
                      : "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300"
                  }`}
                >
                  Cook
                </button>
                <button
                  type="button"
                  onClick={() => setMode(null)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  Close
                </button>
              </div>
            </div>

            {mode === "mise" ? (
              <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[1.4fr_1fr]">
                <section className="min-h-0 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Prep Groups
                  </h3>
                  {prepGroups.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No prep groups yet.</p>
                  ) : (
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      {prepGroups.map((group) => (
                        <div key={group.title} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{group.title}</h4>
                          <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                            {group.items.map((item) => (
                              <li key={`${group.title}-${item}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="min-h-0 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Ingredients
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                    {ingredients.map((ingredient) => (
                      <li key={ingredient} className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                        {ingredient}
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            ) : (
              <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[1.6fr_1fr]">
                <section className="min-h-0 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Steps
                  </h3>
                  <ol className="mt-3 space-y-3 text-base leading-relaxed text-slate-800 dark:text-slate-100">
                    {instructions.map((step, index) => (
                      <li key={`${index}-${step}`} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </section>

                <section className="min-h-0 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Quick Reference
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                    {ingredients.map((ingredient) => (
                      <li key={ingredient} className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                        {ingredient}
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
