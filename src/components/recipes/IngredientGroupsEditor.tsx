"use client";

import { useState, useEffect, useRef, useCallback, type FormEvent, type KeyboardEvent } from "react";
import { Plus, X, GripVertical } from "lucide-react";
import { type PrepGroup } from "@/lib/recipe-utils";
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragOverEvent,
    DragOverlay,
    type DragStartEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type IngredientGroupsEditorProps = {
    initialGroups: PrepGroup[];
    prefix?: string;
    showStepBadge?: boolean;
};

type EditorItem = {
    id: string;
    value: string;
};

type EditorGroup = {
    title: string;
    items: EditorItem[];
    stepIndex?: number;
    sourceGroup?: boolean;
};

let nextId = 0;
const generateId = () => {
    nextId += 1;
    return `ige-${nextId}-${Math.random().toString(36).slice(2, 6)}`;
};

const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
};

// ─── Sortable Item Row ──────────────────────────────────────────────

type SortableItemProps = {
    item: EditorItem;
    index: number;
    ordered: boolean;
    focusOnMount: boolean;
    onFocusHandled: () => void;
    onUpdate: (id: string, value: string) => void;
    onDelete: (id: string) => void;
    onInsertAfter: (id: string) => void;
};

function SortableItemRow({
    item,
    index,
    ordered,
    focusOnMount,
    onFocusHandled,
    onUpdate,
    onDelete,
    onInsertAfter,
}: SortableItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: item.id,
    });
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        if (textareaRef.current) autoResize(textareaRef.current);
    }, [item.value]);

    useEffect(() => {
        if (focusOnMount && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(
                textareaRef.current.value.length,
                textareaRef.current.value.length
            );
            onFocusHandled();
        }
    }, [focusOnMount, item.id, onFocusHandled]);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const handleInput = (e: FormEvent<HTMLTextAreaElement>) => {
        const el = e.currentTarget;
        autoResize(el);
        onUpdate(item.id, el.value);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            onInsertAfter(item.id);
        } else if (e.key === "Backspace" && item.value.trim().length === 0) {
            e.preventDefault();
            onDelete(item.id);
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group flex items-start gap-3 py-1 ${isDragging ? "opacity-30" : ""}`}
        >
            <button
                type="button"
                className="mt-2 cursor-grab text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
                aria-label={`Reorder item ${index + 1}`}
                {...attributes}
                {...listeners}
            >
                <GripVertical className="h-4 w-4" />
            </button>
            {ordered ? (
                <span className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                    {index + 1}.
                </span>
            ) : (
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            )}
            <textarea
                ref={textareaRef}
                rows={1}
                value={item.value}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                className="flex-1 resize-none overflow-hidden bg-transparent text-sm leading-relaxed text-slate-700 focus:outline-none dark:text-slate-200"
            />
            <button
                type="button"
                onClick={() => onDelete(item.id)}
                className="mt-1.5 text-slate-400 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
                aria-label={`Delete item ${index + 1}`}
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}

// ─── Overlay for drag preview ───────────────────────────────────────

function DragOverlayItem({ value }: { value: string }) {
    return (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 shadow-lg dark:border-emerald-700 dark:bg-emerald-950">
            <GripVertical className="mt-0.5 h-4 w-4 text-emerald-400" />
            <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            <span className="text-sm text-slate-700 dark:text-slate-200">{value}</span>
        </div>
    );
}

// ─── Main Editor ────────────────────────────────────────────────────

export default function IngredientGroupsEditor({
    initialGroups,
    prefix = "ingredientGroup",
    showStepBadge = false,
}: IngredientGroupsEditorProps) {
    const [groups, setGroups] = useState<EditorGroup[]>(() =>
        initialGroups.map((g) => ({
            title: g.title,
            items: g.items.map((v) => ({ id: generateId(), value: v })),
            stepIndex: g.stepIndex,
            sourceGroup: g.sourceGroup,
        }))
    );
    const [focusItemId, setFocusItemId] = useState<string | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [newItemValues, setNewItemValues] = useState<Record<number, string>>({});
    const newInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

    // Keep track of the last initialGroups to detect changes
    const [prevInitialGroups, setPrevInitialGroups] = useState(initialGroups);

    // Sync with server data if initialGroups changes reference/content fundamentally
    if (initialGroups !== prevInitialGroups) {
        setPrevInitialGroups(initialGroups);
        setGroups(
            initialGroups.map((g) => ({
                title: g.title,
                items: g.items.map((v) => ({ id: generateId(), value: v })),
                stepIndex: g.stepIndex,
                sourceGroup: g.sourceGroup,
            }))
        );
    }

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Find the group index and item index for a given item id
    const findItem = useCallback(
        (id: string) => {
            for (let gIdx = 0; gIdx < groups.length; gIdx++) {
                const iIdx = groups[gIdx].items.findIndex((item) => item.id === id);
                if (iIdx !== -1) return { gIdx, iIdx, item: groups[gIdx].items[iIdx] };
            }
            return null;
        },
        [groups]
    );

    const activeItem = activeId ? findItem(activeId) : null;

    // ── Drag handlers ──

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        // If hovering over another item, find its container
        const sourceId = active.id as string;
        const destId = over.id as string;

        const source = findItem(sourceId);
        const dest = findItem(destId);

        // Not dragging an item, or dropping over same item
        if (!source || sourceId === destId) return;

        // If hovering over an item in a different group, move it immediately
        if (dest && source.gIdx !== dest.gIdx) {
            setGroups((prev) => {
                const next = prev.map((g) => ({ ...g, items: [...g.items] }));
                const [movedItem] = next[source.gIdx].items.splice(source.iIdx, 1);

                // When dragging across groups, we place it exactly where we are hovering
                const isBelowOverItem =
                    over &&
                    active.rect.current.translated &&
                    active.rect.current.translated.top > over.rect.top + over.rect.height;
                const modifier = isBelowOverItem ? 1 : 0;

                next[dest.gIdx].items.splice(dest.iIdx + modifier, 0, movedItem);
                return next;
            });
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over || active.id === over.id) return;

        const source = findItem(active.id as string);
        const dest = findItem(over.id as string);
        if (!source || !dest) return;

        // Final drop (usually within same group since cross-group is handled by DragOver)
        setGroups((prev) => {
            const next = prev.map((g) => ({
                ...g,
                items: [...g.items],
            }));

            const [movedItem] = next[source.gIdx].items.splice(source.iIdx, 1);
            next[dest.gIdx].items.splice(dest.iIdx, 0, movedItem);

            return next;
        });
    };

    // ── Item CRUD ──

    const updateItem = useCallback((id: string, value: string) => {
        setGroups((prev) =>
            prev.map((g) => ({
                ...g,
                items: g.items.map((item) => (item.id === id ? { ...item, value } : item)),
            }))
        );
    }, []);

    const deleteItem = useCallback(
        (id: string) => {
            setGroups((prev) => {
                const loc = findItem(id);
                if (!loc) return prev;

                const next = prev.map((g) => ({
                    ...g,
                    items: g.items.filter((item) => item.id !== id),
                }));

                // Focus the previous item in the same group, or the new input
                const remaining = next[loc.gIdx].items;
                if (remaining.length > 0) {
                    const focusIdx = Math.max(0, loc.iIdx - 1);
                    setFocusItemId(remaining[focusIdx].id);
                } else {
                    newInputRefs.current[loc.gIdx]?.focus();
                }
                return next;
            });
        },
        [findItem]
    );

    const insertAfter = useCallback(
        (id: string) => {
            const loc = findItem(id);
            if (!loc) return;

            const newId = generateId();
            setGroups((prev) =>
                prev.map((g, gIdx) => {
                    if (gIdx !== loc.gIdx) return g;
                    const items = [...g.items];
                    items.splice(loc.iIdx + 1, 0, { id: newId, value: "" });
                    return { ...g, items };
                })
            );
            setFocusItemId(newId);
        },
        [findItem]
    );

    // ── Group CRUD ──

    const addGroup = () => {
        setGroups((prev) => [
            ...prev,
            {
                title: "",
                items: [],
                sourceGroup: prefix === "ingredientGroup",
            },
        ]);
    };

    const removeGroup = (gIdx: number) => {
        setGroups((prev) => prev.filter((_, i) => i !== gIdx));
    };

    const updateGroupTitle = (gIdx: number, title: string) => {
        setGroups((prev) =>
            prev.map((g, i) => (i === gIdx ? { ...g, title } : g))
        );
    };

    // ── New item per group ──

    const appendNewItem = (gIdx: number) => {
        const value = (newItemValues[gIdx] ?? "").trim();
        if (!value) return;

        const newId = generateId();
        setGroups((prev) =>
            prev.map((g, i) => {
                if (i !== gIdx) return g;
                return { ...g, items: [...g.items, { id: newId, value }] };
            })
        );
        setNewItemValues((prev) => ({ ...prev, [gIdx]: "" }));
        newInputRefs.current[gIdx]?.focus();
    };

    // ── Drag handler for group reordering ──

    const [draggedGroupIdx, setDraggedGroupIdx] = useState<number | null>(null);

    const handleGroupDragStart = (idx: number) => setDraggedGroupIdx(idx);

    const handleGroupDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
        if (draggedGroupIdx === null || draggedGroupIdx === idx) return;

        setGroups((prev) => {
            const next = [...prev];
            const dragged = next[draggedGroupIdx];
            next.splice(draggedGroupIdx, 1);
            next.splice(idx, 0, dragged);
            return next;
        });
        setDraggedGroupIdx(idx);
    };

    const handleGroupDragEnd = () => setDraggedGroupIdx(null);

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="space-y-6">
                {groups.map((group, gIdx) => {
                    const groupItemIds = group.items.map((item) => item.id);

                    return (
                        <div
                            key={gIdx}
                            draggable
                            onDragStart={(e) => {
                                // Only allow group drag from the header grip handle
                                const target = e.target as HTMLElement;
                                if (!target.closest("[data-group-grip]")) {
                                    e.preventDefault();
                                    return;
                                }
                                handleGroupDragStart(gIdx);
                            }}
                            onDragOver={(e) => handleGroupDragOver(e, gIdx)}
                            onDragEnd={handleGroupDragEnd}
                            className={`group/section relative rounded-2xl border bg-slate-50/30 p-4 transition-all dark:bg-slate-900/40
                ${draggedGroupIdx === gIdx ? "opacity-40 grayscale border-emerald-500/50" : "border-slate-100 dark:border-slate-800/50"}`}
                        >
                            {/* Group header */}
                            <div className="mb-2 flex items-center gap-2">
                                <div
                                    data-group-grip
                                    className="cursor-grab text-slate-300 active:cursor-grabbing dark:text-slate-600"
                                >
                                    <GripVertical className="h-4 w-4" />
                                </div>
                                <input
                                    type="text"
                                    name={`${prefix}Title_${gIdx}`}
                                    value={group.title}
                                    onChange={(e) => updateGroupTitle(gIdx, e.target.value)}
                                    placeholder={
                                        showStepBadge
                                            ? "Step Title (optional)"
                                            : "Group Title (e.g. For the Sauce)"
                                    }
                                    className="flex-1 bg-transparent text-xs font-bold uppercase tracking-widest text-slate-400 outline-none placeholder:text-slate-300 focus:text-emerald-600 dark:text-slate-500 dark:placeholder:text-slate-700 dark:focus:text-emerald-400"
                                />
                                {showStepBadge && group.stepIndex !== undefined && (
                                    <div className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                        <span>Step {group.stepIndex + 1}</span>
                                        <input
                                            type="hidden"
                                            name={`${prefix}StepIndex_${gIdx}`}
                                            value={group.stepIndex}
                                        />
                                    </div>
                                )}
                                <input
                                    type="hidden"
                                    name={`${prefix}Exists_${gIdx}`}
                                    value="true"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeGroup(gIdx)}
                                    className="text-slate-300 opacity-0 transition-opacity hover:text-rose-500 group-hover/section:opacity-100"
                                    title="Remove Section"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Items with cross-group sortable */}
                            <div className="mt-4 space-y-1 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950/70">
                                {/* Hidden input serializes items for form submission */}
                                <input
                                    type="hidden"
                                    name={`${prefix}Items_${gIdx}`}
                                    value={group.items.map((item) => item.value).join("\n")}
                                />

                                <SortableContext
                                    items={groupItemIds}
                                    strategy={verticalListSortingStrategy}
                                >
                                    {group.items.map((item, iIdx) => (
                                        <SortableItemRow
                                            key={item.id}
                                            item={item}
                                            index={iIdx}
                                            ordered={false}
                                            focusOnMount={focusItemId === item.id}
                                            onFocusHandled={() => setFocusItemId(null)}
                                            onUpdate={updateItem}
                                            onDelete={deleteItem}
                                            onInsertAfter={insertAfter}
                                        />
                                    ))}
                                </SortableContext>

                                {group.items.length === 0 && (
                                    <p className="py-2 text-center text-xs italic text-slate-400 dark:text-slate-600">
                                        Drag items here or add below
                                    </p>
                                )}

                                <div className="flex items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                                    <input
                                        ref={(el) => {
                                            newInputRefs.current[gIdx] = el;
                                        }}
                                        type="text"
                                        value={newItemValues[gIdx] ?? ""}
                                        onChange={(e) =>
                                            setNewItemValues((prev) => ({
                                                ...prev,
                                                [gIdx]: e.target.value,
                                            }))
                                        }
                                        onBlur={() => appendNewItem(gIdx)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                appendNewItem(gIdx);
                                            }
                                        }}
                                        placeholder={
                                            showStepBadge
                                                ? "Add prep step items..."
                                                : "e.g. 2 tbsp olive oil"
                                        }
                                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => appendNewItem(gIdx)}
                                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                    >
                                        {showStepBadge ? "+ Add item" : "+ Add ingredient"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                <button
                    type="button"
                    onClick={addGroup}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-3 text-xs font-semibold text-slate-400 transition-colors hover:border-emerald-200 hover:bg-emerald-50/30 hover:text-emerald-600 dark:border-slate-800 dark:hover:border-emerald-900/30 dark:hover:bg-emerald-950/20"
                >
                    <Plus className="h-3.5 w-3.5" />
                    <span>
                        {showStepBadge ? "Add Prep Group" : "Add Ingredient Section"}
                    </span>
                </button>
            </div>

            <DragOverlay>
                {activeItem ? <DragOverlayItem value={activeItem.item.value} /> : null}
            </DragOverlay>
        </DndContext>
    );
}
