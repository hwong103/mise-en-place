"use client";

import { type TouchEvent, useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, Play } from "lucide-react";
import { createPortal } from "react-dom";
import { updatePrepGroupsOrder } from "@/app/(dashboard)/recipes/detail-actions";

type PrepGroup = {
  title: string;
  items: string[];
  stepIndex?: number;
  sourceGroup?: boolean;
};

type RecipeFocusModeProps = {
  title: string;
  prepGroups: PrepGroup[];
  ingredients: string[];
  instructions: string[];
  notes: string[];
  triggerWrapperClassName?: string;
  miseButtonClassName?: string;
  cookButtonClassName?: string;
  showCookPlayIcon?: boolean;
  recipeId?: string;
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

// Colour palette for prep group highlights (soft backgrounds)
const GROUP_COLOURS = [
  { bg: "bg-amber-100", text: "text-amber-800", border: "border-l-amber-400", highlight: "rgba(251,191,36,0.25)" },
  { bg: "bg-sky-100", text: "text-sky-800", border: "border-l-sky-400", highlight: "rgba(56,189,248,0.25)" },
  { bg: "bg-violet-100", text: "text-violet-800", border: "border-l-violet-400", highlight: "rgba(167,139,250,0.25)" },
  { bg: "bg-rose-100", text: "text-rose-800", border: "border-l-rose-400", highlight: "rgba(251,113,133,0.25)" },
  { bg: "bg-teal-100", text: "text-teal-800", border: "border-l-teal-400", highlight: "rgba(45,212,191,0.25)" },
  { bg: "bg-orange-100", text: "text-orange-800", border: "border-l-orange-400", highlight: "rgba(251,146,60,0.25)" },
];

// Extract searchable keywords from an ingredient line
const extractKeywords = (line: string): string[] => {
  const STOP = new Set(["a", "an", "and", "or", "of", "the", "to", "with", "for", "each", "fresh", "freshly", "optional", "taste", "about", "approx"]);
  const UNITS = new Set(["g", "kg", "mg", "ml", "l", "oz", "lb", "lbs", "pound", "pounds", "tbsp", "tsp", "cup", "cups", "tablespoon", "tablespoons", "teaspoon", "teaspoons", "clove", "cloves", "pinch", "dash", "package", "packages", "can", "cans", "slice", "slices", "inch", "inches"]);

  // Strip quantity/unit prefix, parenthetical content, prep descriptors after comma
  const withoutParens = line.replace(/\([^)]*\)/g, " ");
  const afterComma = withoutParens.split(",")[0];
  const cleaned = afterComma.replace(/[^a-zA-Z\s]/g, " ");

  return cleaned
    .split(/\s+/)
    .map((t) => t.toLowerCase())
    .filter(Boolean)
    .filter((t) => !STOP.has(t))
    .filter((t) => !UNITS.has(t))
    .filter((t) => !/^\d/.test(t))
    .filter((t) => t.length > 2);
};

type HighlightSpan = { text: string; groupIndex: number | null };

// Highlight ingredient keywords in an instruction text
const highlightInstruction = (text: string, groupKeywords: Array<{ keywords: string[]; groupIndex: number }>): HighlightSpan[] => {
  // Build sorted list of (start, end, groupIndex) matches, first-group wins
  const matches: Array<{ start: number; end: number; groupIndex: number }> = [];
  const claimed = new Set<number>();

  for (const { keywords, groupIndex } of groupKeywords) {
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
      let m = regex.exec(text);
      while (m) {
        const start = m.index;
        const end = start + m[0].length;
        // Check no position is already claimed
        let conflict = false;
        for (let i = start; i < end; i++) {
          if (claimed.has(i)) { conflict = true; break; }
        }
        if (!conflict) {
          matches.push({ start, end, groupIndex });
          for (let i = start; i < end; i++) claimed.add(i);
        }
        m = regex.exec(text);
      }
    }
  }

  if (matches.length === 0) return [{ text, groupIndex: null }];

  matches.sort((a, b) => a.start - b.start);

  const spans: HighlightSpan[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) {
      spans.push({ text: text.slice(cursor, match.start), groupIndex: null });
    }
    spans.push({ text: text.slice(match.start, match.end), groupIndex: match.groupIndex });
    cursor = match.end;
  }
  if (cursor < text.length) spans.push({ text: text.slice(cursor), groupIndex: null });
  return spans;
};

export default function RecipeFocusMode({
  title,
  prepGroups: initialPrepGroups,
  ingredients,
  instructions,
  notes,
  triggerWrapperClassName,
  miseButtonClassName,
  cookButtonClassName,
  showCookPlayIcon = false,
  recipeId,
}: RecipeFocusModeProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [mode, setMode] = useState<FocusMode | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [renderedStepIndex, setRenderedStepIndex] = useState(0);
  const [transitionDirection, setTransitionDirection] = useState<1 | -1>(1);
  const [transitionPhase, setTransitionPhase] = useState<"idle" | "out" | "in">("idle");
  const [localPrepGroups, setLocalPrepGroups] = useState<PrepGroup[]>(initialPrepGroups);
  const [dragSaveError, setDragSaveError] = useState(false);
  // Drag state
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const misePrepRef = useRef<HTMLDivElement | null>(null);
  const cookQuickRef = useRef<HTMLDivElement | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const stepCount = instructions.length;

  const canGoPrev = stepCount > 0 && activeStepIndex > 0;
  const canGoNext = stepCount > 0 && activeStepIndex < stepCount - 1;
  const progressPercent = stepCount > 0 ? ((activeStepIndex + 1) / stepCount) * 100 : 0;

  // Sync if parent prop changes
  useEffect(() => {
    setLocalPrepGroups(initialPrepGroups);
  }, [initialPrepGroups]);

  // Build keyword map for highlighting
  const groupKeywords = localPrepGroups.map((group, groupIndex) => ({
    groupIndex,
    keywords: group.items.flatMap((item) => extractKeywords(item)),
  }));

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
    setIsMounted(true);
  }, []);

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

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    dragIndexRef.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = async (dropIndex: number) => {
    const dragIndex = dragIndexRef.current;
    if (dragIndex === null || dragIndex === dropIndex) {
      dragIndexRef.current = null;
      setDragOverIndex(null);
      return;
    }

    const prevGroups = localPrepGroups;
    const newGroups = [...localPrepGroups];
    const [moved] = newGroups.splice(dragIndex, 1);
    newGroups.splice(dropIndex, 0, moved);

    // Optimistic update
    setLocalPrepGroups(newGroups);
    dragIndexRef.current = null;
    setDragOverIndex(null);
    setDragSaveError(false);

    // Persist if we have a recipeId
    if (recipeId) {
      const result = await updatePrepGroupsOrder(recipeId, JSON.stringify(newGroups));
      if (!result.success) {
        // Revert on failure
        setLocalPrepGroups(prevGroups);
        setDragSaveError(true);
        setTimeout(() => setDragSaveError(false), 3000);
      }
    }
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
    setDragOverIndex(null);
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

      {isMounted && mode
        ? createPortal(
            <div className="fixed inset-0 z-[100] bg-slate-950/60 p-3 backdrop-blur-sm md:p-6">
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
                  className={`rounded-[20px] border-[1.5px] px-[18px] py-[7px] text-[13px] font-semibold transition-colors ${
                    mode === "mise"
                      ? "border-slate-300 bg-slate-100 text-slate-900 dark:border-white/75 dark:bg-white/10 dark:text-white"
                      : "border-slate-300 bg-transparent text-slate-700 hover:border-slate-400 hover:bg-slate-100 dark:border-white/45 dark:text-white dark:hover:border-white/75 dark:hover:bg-white/10"
                  }`}
                  aria-pressed={mode === "mise"}
                >
                  Mise
                </button>
                <button
                  type="button"
                  onClick={() => setMode("cook")}
                  className="rounded-[20px] border-0 bg-[#C67B2A] px-[18px] py-[7px] text-[13px] font-semibold text-white shadow-[0_1px_6px_rgba(198,123,42,0.40)] transition-colors hover:bg-[#B56E24]"
                  aria-pressed={mode === "cook"}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Play className="h-[10px] w-[10px] fill-current" />
                    <span>Cook</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode(null)}
                  className="rounded-[20px] border border-slate-300 bg-transparent px-4 py-[7px] text-[13px] font-medium text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900 dark:border-white/15 dark:text-white/45 dark:hover:border-white/30 dark:hover:text-white/80"
                >
                  Close
                </button>
              </div>
            </div>

            {dragSaveError ? (
              <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-600 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                Failed to save new order. Reverted.
              </div>
            ) : null}

            {mode === "mise" ? (
              <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[1.4fr_1fr]">
                {/* Left panel: Prep Groups with drag-and-drop */}
                <section ref={misePrepRef} className="min-h-0 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Prep Groups
                  </h3>
                  {localPrepGroups.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No prep groups yet.</p>
                  ) : (
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      {localPrepGroups.map((group, index) => {
                        const colour = GROUP_COLOURS[index % GROUP_COLOURS.length];
                        const isDragOver = dragOverIndex === index;
                        return (
                          <div
                            key={`${group.title}-${index}`}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={() => handleDrop(index)}
                            onDragEnd={handleDragEnd}
                            className={`relative rounded-xl border bg-white p-3 transition-all dark:bg-slate-900 ${
                              isDragOver
                                ? "border-amber-400 shadow-md dark:border-amber-500"
                                : "border-slate-200 dark:border-slate-700"
                            } border-l-4 ${colour.border}`}
                            style={{ opacity: dragIndexRef.current === index ? 0.5 : 1, cursor: "grab" }}
                          >
                            <div className="flex items-start gap-2">
                              <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{group.title}</h4>
                                  {group.stepIndex !== undefined ? (
                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colour.bg} ${colour.text}`}>
                                      Step {group.stepIndex + 1}
                                    </span>
                                  ) : null}
                                </div>
                                <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                                  {group.items.map((item) => (
                                    <li key={`${group.title}-${item}`}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Right panel: Instructions with ingredient highlights + Notes */}
                <section className="min-h-0 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Instructions
                  </h3>
                  {instructions.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No instructions.</p>
                  ) : (
                    <ol className="mt-3 space-y-3">
                      {instructions.map((step, stepIdx) => {
                        const spans = highlightInstruction(step, groupKeywords);
                        return (
                          <li key={`step-${stepIdx}`} className="flex gap-3">
                            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold tabular-nums text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                              {stepIdx + 1}
                            </span>
                            <span className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                              {spans.map((span, spanIdx) =>
                                span.groupIndex !== null ? (
                                  <mark
                                    key={spanIdx}
                                    className={`rounded px-0.5 ${GROUP_COLOURS[span.groupIndex % GROUP_COLOURS.length].bg} ${GROUP_COLOURS[span.groupIndex % GROUP_COLOURS.length].text}`}
                                    style={{ backgroundColor: GROUP_COLOURS[span.groupIndex % GROUP_COLOURS.length].highlight }}
                                  >
                                    {span.text}
                                  </mark>
                                ) : (
                                  <span key={spanIdx}>{span.text}</span>
                                )
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  )}

                  {notes.length > 0 ? (
                    <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-700">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        Notes
                      </p>
                      <ul className="mt-3 space-y-2">
                        {notes.map((note, noteIdx) => (
                          <li
                            key={noteIdx}
                            className="rounded-xl bg-slate-100/80 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
                          >
                            {note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
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
            </div>,
            document.body
          )
        : null}
    </>
  );
}
