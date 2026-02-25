"use client";

import { type TouchEvent, useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Play } from "lucide-react";

type PrepGroup = {
  title: string;
  items: string[];
};

type RecipeFocusModeProps = {
  title: string;
  prepGroups: PrepGroup[];
  ingredients: string[];
  instructions: string[];
  triggerWrapperClassName?: string;
  miseButtonClassName?: string;
  cookButtonClassName?: string;
  showCookPlayIcon?: boolean;
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
  triggerWrapperClassName,
  miseButtonClassName,
  cookButtonClassName,
  showCookPlayIcon = false,
}: RecipeFocusModeProps) {
  const [mode, setMode] = useState<FocusMode | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [renderedStepIndex, setRenderedStepIndex] = useState(0);
  const [transitionDirection, setTransitionDirection] = useState<1 | -1>(1);
  const [transitionPhase, setTransitionPhase] = useState<"idle" | "out" | "in">("idle");
  const misePrepRef = useRef<HTMLDivElement | null>(null);
  const miseIngredientsRef = useRef<HTMLDivElement | null>(null);
  const cookQuickRef = useRef<HTMLDivElement | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const stepCount = instructions.length;

  const canGoPrev = stepCount > 0 && activeStepIndex > 0;
  const canGoNext = stepCount > 0 && activeStepIndex < stepCount - 1;
  const progressPercent = stepCount > 0 ? ((activeStepIndex + 1) / stepCount) * 100 : 0;

  const clearTransitionTimers = useCallback(() => {
    if (transitionTimeoutRef.current) {
      window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
  }, []);

  const navigateStep = useCallback(
    (direction: -1 | 1) => {
      if (transitionPhase !== "idle" || stepCount === 0) {
        return;
      }

      const targetIndex = Math.min(stepCount - 1, Math.max(0, activeStepIndex + direction));
      if (targetIndex === activeStepIndex) {
        return;
      }

      clearTransitionTimers();
      setTransitionDirection(direction);
      setTransitionPhase("out");

      transitionTimeoutRef.current = window.setTimeout(() => {
        setRenderedStepIndex(targetIndex);
        setActiveStepIndex(targetIndex);
        setTransitionPhase("in");
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            setTransitionPhase("idle");
          });
        });
        transitionTimeoutRef.current = null;
      }, 250);
    },
    [activeStepIndex, clearTransitionTimers, stepCount, transitionPhase]
  );

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

  useEffect(() => {
    if (mode !== "cook") {
      return;
    }

    setActiveStepIndex(0);
    setRenderedStepIndex(0);
    setTransitionPhase("idle");
  }, [mode]);

  useEffect(() => {
    if (mode !== "cook") {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      if (
        target?.isContentEditable ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      ) {
        return;
      }

      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        navigateStep(-1);
      } else if (
        event.key === "ArrowDown" ||
        event.key === "ArrowRight" ||
        event.key === " " ||
        event.code === "Space"
      ) {
        event.preventDefault();
        navigateStep(1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, navigateStep]);

  useEffect(() => {
    return () => clearTransitionTimers();
  }, [clearTransitionTimers]);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartYRef.current = event.changedTouches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const startY = touchStartYRef.current;
    const endY = event.changedTouches[0]?.clientY ?? null;
    touchStartYRef.current = null;
    if (startY === null || endY === null) {
      return;
    }

    const deltaY = endY - startY;
    if (Math.abs(deltaY) < 40) {
      return;
    }

    if (deltaY < 0) {
      navigateStep(1);
    } else {
      navigateStep(-1);
    }
  };

  const stepMotionClass =
    transitionPhase === "out"
      ? transitionDirection === 1
        ? "-translate-y-[30px] opacity-0"
        : "translate-y-[30px] opacity-0"
      : transitionPhase === "in"
        ? "translate-y-[20px] opacity-0"
        : "translate-y-0 opacity-100";

  const stepText = instructions[renderedStepIndex] ?? "No steps available for this recipe.";

  return (
    <>
      <div className={triggerWrapperClassName ?? "flex flex-wrap gap-3"}>
        <button
          type="button"
          onClick={() => setMode("mise")}
          className={
            miseButtonClassName ??
            "rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/40"
          }
        >
          Mise
        </button>
        <button
          type="button"
          onClick={() => setMode("cook")}
          className={
            cookButtonClassName ??
            "rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/40"
          }
        >
          <span className="inline-flex items-center gap-1.5">
            {showCookPlayIcon ? <Play className="h-[11px] w-[11px] fill-current" /> : null}
            <span>Cook</span>
          </span>
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
                <section ref={misePrepRef} className="min-h-0 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
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

                <section ref={miseIngredientsRef} className="min-h-0 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
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
              <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[minmax(0,1fr)_300px]">
                <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[#d8e6de] bg-white dark:border-slate-700 dark:bg-slate-950">
                  <div className="h-[3px] w-full bg-[#e6f4ed] dark:bg-emerald-400/20">
                    <div
                      className="h-full bg-[#1a6b4a] transition-[width] duration-300 ease-in-out dark:bg-emerald-400"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between border-b border-[#d8e6de] px-7 py-[12px] pb-[10px] dark:border-slate-700">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b8c7d] dark:text-slate-400">
                      Steps
                    </p>
                    <p className="text-sm text-[#0e1f1a] [font-family:var(--font-lora)] dark:text-slate-200">
                      Step{" "}
                      <span className="font-semibold text-[#0e1f1a] dark:text-slate-100">
                        {stepCount > 0 ? activeStepIndex + 1 : 0}
                      </span>{" "}
                      of <span className="text-[#6b8c7d] dark:text-slate-400">{stepCount}</span>
                    </p>
                  </div>

                  <div className="relative flex min-h-0 flex-1 overflow-hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                    <button
                      type="button"
                      className="group absolute inset-x-0 top-0 z-10 h-1/2 cursor-pointer bg-transparent active:bg-[rgba(26,107,74,0.08)] dark:active:bg-emerald-400/10 disabled:pointer-events-none disabled:cursor-default"
                      onClick={() => navigateStep(-1)}
                      disabled={!canGoPrev}
                      aria-label="Previous step"
                    >
                      <span className="pointer-events-none absolute right-5 top-5 hidden items-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 md:flex">
                        <span className="text-xs font-medium text-[#6b8c7d] dark:text-slate-300">Previous</span>
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] border-[#d8e6de] bg-white text-[#6b8c7d] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                          <ChevronUp className="h-4 w-4" />
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="group absolute inset-x-0 bottom-0 z-10 h-1/2 cursor-pointer bg-transparent active:bg-[rgba(26,107,74,0.08)] dark:active:bg-emerald-400/10 disabled:pointer-events-none disabled:cursor-default"
                      onClick={() => navigateStep(1)}
                      disabled={!canGoNext}
                      aria-label="Next step"
                    >
                      <span className="pointer-events-none absolute bottom-5 right-5 hidden items-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 md:flex">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] border-[#d8e6de] bg-white text-[#6b8c7d] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                          <ChevronDown className="h-4 w-4" />
                        </span>
                        <span className="text-xs font-medium text-[#6b8c7d] dark:text-slate-300">Next</span>
                      </span>
                    </button>

                    <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center px-12 py-10">
                      <div
                        className={`mx-auto max-w-3xl text-center transition-all duration-[250ms] ease-out ${stepMotionClass}`}
                      >
                        <div className="mx-auto mb-5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#1a6b4a] text-[15px] font-semibold text-white dark:bg-emerald-500 dark:text-slate-950">
                          {stepCount > 0 ? renderedStepIndex + 1 : 0}
                        </div>
                        <p className="text-[21px] leading-[1.65] text-[#0e1f1a] [font-family:var(--font-lora)] dark:text-slate-100">
                          {stepText}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                <section ref={cookQuickRef} className="min-h-0 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
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
