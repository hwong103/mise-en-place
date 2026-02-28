"use client";

import { type TouchEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Play, GripVertical } from "lucide-react";
import { createPortal } from "react-dom";
import { extractIngredientKeywords, type PrepGroup } from "@/lib/recipe-utils";
import { updatePrepGroupsOrder } from "@/app/(dashboard)/recipes/detail-actions";
import IngredientGroupsEditor from "@/components/recipes/IngredientGroupsEditor";

type RecipeFocusModeProps = {
  recipeId?: string;
  title: string;
  prepGroups: PrepGroup[];
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
  instructions,
  notes,
  triggerWrapperClassName,
  miseButtonClassName,
  cookButtonClassName,
  showCookPlayIcon = false,
}: RecipeFocusModeProps) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [mode, setMode] = useState<FocusMode | null>(null);
  const [prepGroups, setPrepGroups] = useState(initialPrepGroups);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [renderedStepIndex, setRenderedStepIndex] = useState(0);
  const [transitionDirection, setTransitionDirection] = useState<1 | -1>(1);
  const [transitionPhase, setTransitionPhase] = useState<"idle" | "out" | "in">("idle");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isFabVisible, setIsFabVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [pendingGroups, setPendingGroups] = useState<PrepGroup[] | null>(null);

  const transitionTimeoutRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const stepCount = instructions.length;
  const canGoPrev = stepCount > 0 && activeStepIndex > 0;
  const canGoNext = stepCount > 0 && activeStepIndex < stepCount - 1;
  const progressPercent = stepCount > 0 ? ((activeStepIndex + 1) / stepCount) * 100 : 0;

  useEffect(() => {
    setIsMounted(true);

    const heroActions = document.getElementById("heroActions");
    if (!heroActions) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsFabVisible(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(heroActions);
    return () => observer.disconnect();
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
      router.refresh();
    } catch (err) {
      console.error("Failed to save reorder", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDoneEditing = async () => {
    setIsEditing(false);
    if (!pendingGroups || !recipeId) {
      setPendingGroups(null);
      return;
    }

    // Merge edited mise groups back with sourceGroups (which aren't shown in editor)
    const sourceGroups = prepGroups.filter((g) => g.sourceGroup);
    const merged = [...sourceGroups, ...pendingGroups];

    setPrepGroups(merged); // optimistic update
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("recipeId", recipeId);
      formData.append("prepGroups", JSON.stringify(merged));
      await updatePrepGroupsOrder(formData);
      router.refresh();
    } catch (err) {
      console.error("Failed to save prep groups", err);
      // rollback on error
      setPrepGroups(initialPrepGroups);
    } finally {
      setIsSaving(false);
      setPendingGroups(null);
    }
  };

  const misePrepGroups = useMemo(() => {
    return prepGroups.filter(g => !g.sourceGroup);
  }, [prepGroups]);

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
            "rounded-xl border-[1.5px] border-[var(--mise-border)] bg-[var(--mise-bg)] px-4 py-2 text-sm font-semibold text-[var(--mise-text)] transition-all hover:bg-[#fef3c7] hover:border-[#b45309] hover:text-[#b45309] dark:bg-amber-950/40"
          }
        >
          Mise
        </button>
        <button
          type="button"
          onClick={() => setMode("cook")}
          className={
            cookButtonClassName ??
            "rounded-xl border-[1.5px] border-[var(--cook-border)] bg-[var(--cook-bg)] px-4 py-2 text-sm font-semibold text-[var(--cook-text)] transition-all hover:bg-[#dcfce7] hover:border-[#15803d] hover:text-[#15803d] dark:bg-emerald-950/40"
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
                    onClick={() => { setMode("mise"); setIsEditing(false); setPendingGroups(null); }}
                    className={`rounded-full border-[1.5px] px-5 py-1.5 text-[13px] font-semibold transition-all ${mode === "mise"
                      ? "border-[var(--mise-border)] bg-[var(--mise-bg)] text-[var(--mise-text)] dark:bg-amber-950/40"
                      : "border-slate-200 bg-transparent text-slate-600 hover:border-[var(--mise-border)] hover:text-[var(--mise-text)] dark:border-slate-700 dark:text-slate-400"
                      }`}
                  >
                    Mise
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode("cook"); setIsEditing(false); setPendingGroups(null); }}
                    className={`rounded-full border-[1.5px] px-5 py-1.5 text-[13px] font-semibold transition-all ${mode === "cook"
                      ? "border-[var(--cook-border)] bg-[var(--cook-bg)] text-[var(--cook-text)] dark:bg-emerald-950/40"
                      : "border-slate-200 bg-transparent text-slate-600 hover:border-[var(--cook-border)] hover:text-[var(--cook-text)] dark:border-slate-700 dark:text-slate-400"
                      }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Play className="h-[10px] w-[10px] fill-current" />
                      <span>Cook</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode(null); setIsEditing(false); setPendingGroups(null); }}
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
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        Prep Groups
                      </h3>
                      <button
                        type="button"
                        onClick={isEditing ? handleDoneEditing : () => setIsEditing(true)}
                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                      >
                        {isEditing ? "Done" : "Edit"}
                      </button>
                    </div>

                    {isEditing ? (
                      <div className="mt-5">
                        <IngredientGroupsEditor
                          initialGroups={misePrepGroups}
                          prefix="miseGroup"
                          onChange={setPendingGroups}
                        />
                      </div>
                    ) : misePrepGroups.length === 0 ? (
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
                          className={`mx-auto max-w-2xl text-center transition-all duration-300 ease-out ${stepMotionClass}`}
                        >
                          <p className="text-[21px] leading-[1.65] text-[#0e1f1a] dark:text-slate-100 font-serif">
                            {stepText}
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="min-h-0 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      Instructions
                    </h3>
                    <div className="mt-4 space-y-4">
                      {instructions.map((step, index) => (
                        <div key={index} className={`flex gap-3 ${index === activeStepIndex ? "opacity-100" : "opacity-40"}`}>
                          <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold border ${index === activeStepIndex ? "bg-[#1a6b4a] text-white border-[#1a6b4a] dark:bg-emerald-500 dark:text-slate-950 dark:border-emerald-500" : "bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-500"}`}>
                            {index + 1}
                          </span>
                          <p className={`text-[13px] leading-relaxed ${index === activeStepIndex ? "text-slate-900 font-medium dark:text-slate-100" : "text-slate-600 dark:text-slate-400"}`}>
                            {step}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>,
          document.body
        )
        : null}

      {isMounted && (
        <div className={`fab-container ${isFabVisible ? "visible" : ""}`} id="fab">
          <div className="fab-group">
            <button className="fab-mise" onClick={() => setMode("mise")}>
              Mise
            </button>
            <button className="fab-cook" onClick={() => setMode("cook")}>
              <span className="inline-flex items-center gap-1.5 w-full justify-center">
                <Play className="h-[10px] w-[10px] fill-current" />
                <span>Cook</span>
              </span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
