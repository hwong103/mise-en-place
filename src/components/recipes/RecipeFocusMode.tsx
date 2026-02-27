"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, GripVertical } from "lucide-react";
import { createPortal } from "react-dom";
import { extractIngredientKeywords, type PrepGroup } from "@/lib/recipe-utils";
import { updatePrepGroupsOrder } from "@/app/(dashboard)/recipes/detail-actions";

type RecipeFocusModeProps = {
  recipeId?: string;
  title: string;
  prepGroups: PrepGroup[];
  ingredients: string[];
  instructions: string[];
  notes: string[];
  triggerWrapperClassName?: string;
  miseButtonClassName?: string;
  cookButtonClassName?: string;
  showCookPlayIcon?: boolean;
};

type FocusMode = "mise" | "cook";

const HIGHLIGHT_COLORS = [
  "bg-amber-100/80 text-amber-900 border-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-800",
  "bg-emerald-100/80 text-emerald-900 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-800",
  "bg-blue-100/80 text-blue-900 border-blue-200 dark:bg-blue-900/40 dark:text-blue-100 dark:border-blue-800",
  "bg-rose-100/80 text-rose-900 border-rose-200 dark:bg-rose-900/40 dark:text-rose-100 dark:border-rose-800",
  "bg-purple-100/80 text-purple-900 border-purple-200 dark:bg-purple-900/40 dark:text-purple-100 dark:border-purple-800",
  "bg-cyan-100/80 text-cyan-900 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-100 dark:border-cyan-800",
];

function InstructionWithHighlights({
  text,
  prepGroups,
}: {
  text: string;
  prepGroups: PrepGroup[];
}) {
  const highlights = useMemo(() => {
    const result: Array<{ word: string; color: string; groupTitle: string }> = [];
    prepGroups.forEach((group, index) => {
      const color = HIGHLIGHT_COLORS[index % HIGHLIGHT_COLORS.length];
      group.items.forEach((item) => {
        // 1. Strip parentheticals
        let core = item.replace(/\([^)]*\)/g, "");
        // 2. Strip trailing prep descriptors after comma
        core = core.split(",")[0];
        // 3. Keep common multi-word phrases by trimming leading quantity+units elsewhere
        // For simplicity, we use the extracted keywords but also the trimmed core line
        const trimmedCore = core.replace(/^\d+[\s\d/.-]*\s*(?:[a-zA-Z]+\s+)?/i, "").trim();

        if (trimmedCore.length > 3) {
          result.push({ word: trimmedCore, color, groupTitle: group.title });
        }

        const keywords = extractIngredientKeywords(item);
        keywords.forEach((keyword) => {
          if (keyword.length < 3) return;
          result.push({ word: keyword, color, groupTitle: group.title });
        });
      });
    });
    // Sort highlights by length descending to match longer phrases first
    // Filter out duplicates to avoid regex issues
    const unique = Array.from(new Map(result.map(h => [h.word.toLowerCase(), h])).values());
    return unique.sort((a, b) => b.word.length - a.word.length);
  }, [prepGroups]);

  if (highlights.length === 0) return <span>{text}</span>;

  // Build a regex to match any of the keywords as whole words
  const escaped = highlights.map(h => h.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const pattern = new RegExp(`\\b(${escaped})\\b`, "gi");
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) => {
        const highlight = highlights.find((h) => h.word.toLowerCase() === part.toLowerCase());
        if (highlight) {
          return (
            <span
              key={i}
              className={`inline-block rounded-[4px] px-1.5 py-0 border ${highlight.color}`}
              title={highlight.groupTitle}
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export default function RecipeFocusMode({
  recipeId,
  title,
  prepGroups: initialPrepGroups,
  ingredients,
  instructions,
  notes,
  triggerWrapperClassName,
  miseButtonClassName,
  cookButtonClassName,
  showCookPlayIcon = false,
}: RecipeFocusModeProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [mode, setMode] = useState<FocusMode | null>(null);
  const [prepGroups, setPrepGroups] = useState(initialPrepGroups);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [renderedStepIndex, setRenderedStepIndex] = useState(0);
  const [transitionPhase, setTransitionPhase] = useState<"idle" | "out" | "in">("idle");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const transitionTimeoutRef = useRef<number | null>(null);

  const stepCount = instructions.length;
  const canGoPrev = stepCount > 0 && activeStepIndex > 0;
  const canGoNext = stepCount > 0 && activeStepIndex < stepCount - 1;
  const progressPercent = stepCount > 0 ? ((activeStepIndex + 1) / stepCount) * 100 : 0;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setPrepGroups(initialPrepGroups);
  }, [initialPrepGroups]);

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

  // Drag and drop handlers
  const handleDragStart = (idx: number) => {
    setDraggedIndex(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === idx) return;

    const newGroups = [...prepGroups];
    const draggedItem = newGroups[draggedIndex];
    newGroups.splice(draggedIndex, 1);
    newGroups.splice(idx, 0, draggedItem);
    setDraggedIndex(idx);
    setPrepGroups(newGroups);
  };

  const handleDragEnd = async () => {
    setDraggedIndex(null);
    if (!recipeId) return;

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("recipeId", recipeId);
      formData.append("prepGroups", JSON.stringify(prepGroups));
      await updatePrepGroupsOrder(formData);
    } catch (err) {
      console.error("Failed to save reorder", err);
    } finally {
      setIsSaving(false);
    }
  };

  const misePrepGroups = useMemo(() => {
    return prepGroups.filter(g => !g.sourceGroup);
  }, [prepGroups]);

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
            <div className="mx-auto flex h-[94dvh] w-full max-w-7xl flex-col rounded-3XL border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#C67B2A] dark:text-[#E2A056]">
                      {mode === "mise" ? "Mise En Place" : "Cook Mode"}
                    </p>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h2>
                  </div>
                  {isSaving && (
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 font-medium animate-pulse">
                      Saving...
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("mise")}
                    className={`rounded-full border-[1.5px] px-5 py-1.5 text-[13px] font-semibold transition-all ${mode === "mise"
                      ? "border-[#C67B2A] bg-amber-50 text-[#C67B2A] dark:bg-amber-950/40"
                      : "border-slate-200 bg-transparent text-slate-600 hover:border-[#C67B2A] hover:text-[#C67B2A] dark:border-slate-700 dark:text-slate-400"
                      }`}
                  >
                    Mise
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("cook")}
                    className={`rounded-full border-[1.5px] px-5 py-1.5 text-[13px] font-semibold transition-all ${mode === "cook"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40"
                      : "border-slate-200 bg-transparent text-slate-600 hover:border-emerald-600 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-400"
                      }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Play className="h-[10px] w-[10px] fill-current" />
                      <span>Cook</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode(null)}
                    className="ml-2 rounded-full border border-slate-200 bg-transparent px-4 py-1.5 text-[13px] font-medium text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600 dark:border-slate-700 dark:text-slate-500"
                  >
                    Close
                  </button>
                </div>
              </div>

              {mode === "mise" ? (
                <div className="grid min-h-0 flex-1 gap-6 md:grid-cols-[1fr_1.5fr]">
                  {/* Left Column: Prep Groups with Drag and Drop */}
                  <section className="min-h-0 overflow-auto rounded-2xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-900/40">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      Prep Groups
                    </h3>
                    {misePrepGroups.length === 0 ? (
                      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No mise groups available. (Source ingredients are separate)</p>
                    ) : (
                      <div className="mt-5 space-y-3">
                        {misePrepGroups.map((group, index) => {
                          const color = HIGHLIGHT_COLORS[index % HIGHLIGHT_COLORS.length];
                          const isDragging = draggedIndex === index;
                          return (
                            <div
                              key={group.title}
                              draggable
                              onDragStart={() => handleDragStart(index)}
                              onDragOver={(e) => handleDragOver(e, index)}
                              onDragEnd={handleDragEnd}
                              className={`rounded-xl border bg-white p-3 shadow-sm transition-all dark:bg-slate-900 
                                ${isDragging ? "opacity-40 grayscale scale-95" : "opacity-100"}
                                hover:shadow-md cursor-grab active:cursor-grabbing border-white/50 dark:border-slate-800`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <GripVertical className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
                                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    {group.title}
                                  </h4>
                                </div>
                                {group.stepIndex !== undefined && (
                                  <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                                    Step {group.stepIndex + 1}
                                  </span>
                                )}
                              </div>
                              <ul className="mt-2.5 space-y-1.5 text-[13px] text-slate-600 dark:text-slate-300">
                                {group.items.map((item) => (
                                  <li key={item} className="flex items-start gap-2">
                                    <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${color.split(" ")[0].replace("/80", "")}`} />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* Right Column: Instructions + Notes */}
                  <section className="min-h-0 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-inner dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="min-h-0 flex-1 overflow-auto p-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        Instructions Detail
                      </h3>
                      <div className="mt-5 space-y-8">
                        {instructions.map((step, index) => (
                          <div key={index} className="flex gap-5">
                            <span className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-50 text-[11px] font-bold text-slate-400 dark:bg-slate-900 dark:text-slate-500 border border-slate-100 dark:border-slate-800">
                              {index + 1}
                            </span>
                            <div className="text-[16px] leading-[1.7] text-slate-700 dark:text-slate-200">
                              <InstructionWithHighlights text={step} prepGroups={misePrepGroups} />
                            </div>
                          </div>
                        ))}
                      </div>

                      {notes.length > 0 && (
                        <div className="mt-12 border-t border-slate-100 pt-8 dark:border-slate-800">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-5 text-center">
                            Recipe Notes
                          </h3>
                          <ul className="space-y-4">
                            {notes.map((note, i) => (
                              <li key={i} className="flex gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 dark:bg-slate-900/40 dark:border-slate-800">
                                <span className="text-slate-300 dark:text-slate-700 font-bold select-none">•</span>
                                <p className="text-[14px] text-slate-600 dark:text-slate-400">{note}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              ) : (
                <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[minmax(0,1fr)_300px]">
                  {/* Cook Mode active step display */}
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
                      <p className="text-sm text-[#0e1f1a] dark:text-slate-200">
                        Step{" "}
                        <span className="font-semibold text-[#0e1f1a] dark:text-slate-100">
                          {stepCount > 0 ? activeStepIndex + 1 : 0}
                        </span>{" "}
                        of <span className="text-[#6b8c7d] dark:text-slate-400">{stepCount}</span>
                      </p>
                    </div>

                    <div className="relative flex min-h-0 flex-1 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => navigateStep(-1)}
                        className={`absolute left-0 top-0 z-10 h-full w-24 bg-gradient-to-r from-white to-transparent opacity-0 transition-opacity hover:opacity-10 dark:from-slate-950 ${!canGoPrev && "pointer-events-none"
                          }`}
                        aria-label="Previous step"
                      >
                        <ChevronLeft className="ml-4 h-8 w-8 text-[#1a6b4a] dark:text-emerald-400" />
                      </button>

                      <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center px-12 py-10">
                        <div
                          className={`mx-auto max-w-2xl text-center transition-all duration-300 ${transitionPhase === "out"
                            ? "scale-[0.98] opacity-0"
                            : transitionPhase === "in"
                              ? "scale-[1.02] opacity-0"
                              : "scale-100 opacity-100"
                            }`}
                        >
                          <p className="text-[21px] leading-[1.65] text-[#0e1f1a] dark:text-slate-100 font-serif">
                            {stepText}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => navigateStep(1)}
                        className={`absolute right-0 top-0 z-10 h-full w-24 bg-gradient-to-l from-white to-transparent opacity-0 transition-opacity hover:opacity-10 dark:from-slate-950 ${!canGoNext && "pointer-events-none"
                          }`}
                        aria-label="Next step"
                      >
                        <ChevronRight className="mr-4 h-8 w-8 text-[#1a6b4a] dark:text-emerald-400" />
                      </button>
                    </div>
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
          </div>,
          document.body
        )
        : null}
    </>
  );
}
