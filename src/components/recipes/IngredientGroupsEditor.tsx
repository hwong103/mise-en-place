"use client";

import { useState, useEffect, useRef, useCallback, type FormEvent, type KeyboardEvent } from "react";
import { Plus, X, GripVertical } from "lucide-react";
import { type PrepGroup } from "@/lib/recipe-utils";
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragOverEvent,
    DragOverlay,
    type DragStartEvent,
    type DraggableAttributes,
} from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";

type IngredientGroupsEditorProps = {
    initialGroups: PrepGroup[];
    prefix?: string;
    showStepBadge?: boolean;
    onChange?: (groups: PrepGroup[]) => void;
};

type EditorItem = {
    id: string;
    value: string;
};

type EditorGroup = {
    id: string;
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

const toEditorGroups = (initialGroups: PrepGroup[]): EditorGroup[] =>
    initialGroups.map((g) => ({
        id: generateId(),
        title: g.title,
        items: g.items.map((value) => ({ id: generateId(), value })),
        stepIndex: g.stepIndex,
        sourceGroup: g.sourceGroup,
    }));

const getGroupsSignature = (initialGroups: PrepGroup[]) =>
    JSON.stringify(
        initialGroups.map((group) => ({
            title: group.title,
            items: group.items,
            stepIndex: group.stepIndex ?? null,
            sourceGroup: group.sourceGroup ?? false,
        }))
    );

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
        data: {
            type: "item",
        },
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
                className="mt-0.5 rounded-full p-2 text-slate-400 opacity-100 transition-opacity hover:bg-slate-100 md:mt-2 md:opacity-0 md:group-hover:opacity-100 active:cursor-grabbing dark:hover:bg-slate-800"
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
                className="mt-0.5 rounded-full p-2 text-slate-400 opacity-100 transition-opacity hover:bg-rose-50 hover:text-rose-500 md:mt-1.5 md:opacity-0 md:group-hover:opacity-100 dark:hover:bg-rose-950/30"
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

function DragOverlayGroup({ title }: { title: string }) {
    return (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50/95 px-4 py-3 shadow-lg dark:border-emerald-700 dark:bg-emerald-950/95">
            <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                    {title || "Untitled group"}
                </span>
            </div>
        </div>
    );
}

function DroppableGroupContainer({
    groupId,
    children,
}: {
    groupId: string;
    children: React.ReactNode;
}) {
    const { isOver, setNodeRef } = useDroppable({
        id: `${groupId}-items`,
        data: {
            type: "group-items",
            groupId,
        },
    });

    return (
        <div
            ref={setNodeRef}
            className={`mt-4 space-y-1 rounded-xl border bg-white p-3 transition-colors dark:bg-slate-950/70 ${
                isOver
                    ? "border-emerald-400 bg-emerald-50/40 dark:border-emerald-600 dark:bg-emerald-950/30"
                    : "border-slate-200 dark:border-slate-700"
            }`}
        >
            {children}
        </div>
    );
}

function SortableGroupCard({
    groupId,
    children,
}: {
    groupId: string;
    children: (dragHandleProps: {
        attributes: DraggableAttributes;
        listeners: SyntheticListenerMap | undefined;
        isDragging: boolean;
    }) => React.ReactNode;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: groupId,
        data: {
            type: "group",
        },
    });

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={`group/section relative rounded-2xl border bg-slate-50/30 p-4 transition-all dark:bg-slate-900/40 ${
                isDragging
                    ? "border-emerald-500/50 opacity-40 grayscale"
                    : "border-slate-100 dark:border-slate-800/50"
            }`}
        >
            {children({ attributes, listeners, isDragging })}
        </div>
    );
}

// ─── Main Editor ────────────────────────────────────────────────────

export default function IngredientGroupsEditor(props: IngredientGroupsEditorProps) {
    const {
        initialGroups,
        prefix = "ingredientGroup",
        showStepBadge = false,
    } = props;
    const initialSignature = getGroupsSignature(initialGroups);
    const [editorState, setEditorState] = useState(() => ({
        signature: initialSignature,
        groups: toEditorGroups(initialGroups),
    }));
    const [focusItemId, setFocusItemId] = useState<string | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeType, setActiveType] = useState<"group" | "item" | null>(null);
    const [newItemValues, setNewItemValues] = useState<Record<number, string>>({});
    const newInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
    const groups =
        editorState.signature === initialSignature ? editorState.groups : toEditorGroups(initialGroups);

    const updateGroups = useCallback(
        (updater: EditorGroup[] | ((current: EditorGroup[]) => EditorGroup[])) => {
            setEditorState((prev) => {
                const baseGroups =
                    prev.signature === initialSignature ? prev.groups : toEditorGroups(initialGroups);
                const nextGroups =
                    typeof updater === "function"
                        ? (updater as (current: EditorGroup[]) => EditorGroup[])(baseGroups)
                        : updater;

                return {
                    signature: initialSignature,
                    groups: nextGroups,
                };
            });
        },
        [initialGroups, initialSignature]
    );

    const { onChange } = props;
    useEffect(() => {
        onChange?.(
            groups.map((g) => ({
                title: g.title,
                items: g.items.map((i) => i.value),
                sourceGroup: g.sourceGroup,
                stepIndex: g.stepIndex,
            }))
        );
    }, [groups, onChange]);

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

    const findGroupIndex = useCallback(
        (groupId: string) => groups.findIndex((group) => group.id === groupId),
        [groups]
    );

    const findGroupIndexFromDropTarget = useCallback(
        (id: string) => {
            const directMatch = findGroupIndex(id);
            if (directMatch !== -1) return directMatch;
            return groups.findIndex((group) => `${group.id}-items` === id);
        },
        [findGroupIndex, groups]
    );

    const activeItem = activeId ? findItem(activeId) : null;
    const activeGroup = activeId && activeType === "group" ? groups.find((group) => group.id === activeId) : null;

    // ── Drag handlers ──

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
        const dragType = event.active.data.current?.type;
        setActiveType(dragType === "group" ? "group" : "item");
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        if (active.data.current?.type !== "item") return;

        const sourceId = active.id as string;
        const overId = over.id as string;

        const source = findItem(sourceId);
        if (!source || sourceId === overId) return;

        const dest = findItem(overId);

        if (dest && source.gIdx !== dest.gIdx) {
            updateGroups((prev) => {
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
            return;
        }

        if (!dest) {
            const destGroupIdx = findGroupIndexFromDropTarget(overId);
            if (destGroupIdx === -1 || destGroupIdx === source.gIdx) return;

            updateGroups((prev) => {
                const next = prev.map((g) => ({ ...g, items: [...g.items] }));
                const [movedItem] = next[source.gIdx].items.splice(source.iIdx, 1);
                next[destGroupIdx].items.push(movedItem);
                return next;
            });
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveType(null);

        if (!over || active.id === over.id) return;

        if (active.data.current?.type === "group") {
            const sourceGroupIdx = findGroupIndex(active.id as string);
            const destGroupIdx = findGroupIndexFromDropTarget(over.id as string);
            if (sourceGroupIdx === -1 || destGroupIdx === -1 || sourceGroupIdx === destGroupIdx) return;

            updateGroups((prev) => arrayMove(prev, sourceGroupIdx, destGroupIdx));
            return;
        }

        const source = findItem(active.id as string);
        if (!source) return;

        const dest = findItem(over.id as string);

        if (!dest) {
            const destGroupIdx = findGroupIndexFromDropTarget(over.id as string);
            if (destGroupIdx !== -1 && destGroupIdx !== source.gIdx) {
                updateGroups((prev) => {
                    const next = prev.map((g) => ({ ...g, items: [...g.items] }));
                    const [movedItem] = next[source.gIdx].items.splice(source.iIdx, 1);
                    next[destGroupIdx].items.push(movedItem);
                    return next;
                });
            }
            return;
        }

        updateGroups((prev) => {
            const next = prev.map((g) => ({
                ...g,
                items: [...g.items],
            }));

            if (source.gIdx === dest.gIdx) {
                next[source.gIdx].items = arrayMove(next[source.gIdx].items, source.iIdx, dest.iIdx);
                return next;
            }

            const [movedItem] = next[source.gIdx].items.splice(source.iIdx, 1);
            next[dest.gIdx].items.splice(dest.iIdx, 0, movedItem);

            return next;
        });
    };

    // ── Item CRUD ──

    const updateItem = useCallback((id: string, value: string) => {
        updateGroups((prev) =>
            prev.map((g) => ({
                ...g,
                items: g.items.map((item) => (item.id === id ? { ...item, value } : item)),
            }))
        );
    }, [updateGroups]);

    const deleteItem = useCallback(
        (id: string) => {
            updateGroups((prev) => {
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
        [findItem, updateGroups]
    );

    const insertAfter = useCallback(
        (id: string) => {
            const loc = findItem(id);
            if (!loc) return;

            const newId = generateId();
            updateGroups((prev) =>
                prev.map((g, gIdx) => {
                    if (gIdx !== loc.gIdx) return g;
                    const items = [...g.items];
                    items.splice(loc.iIdx + 1, 0, { id: newId, value: "" });
                    return { ...g, items };
                })
            );
            setFocusItemId(newId);
        },
        [findItem, updateGroups]
    );

    // ── Group CRUD ──

    const addGroup = () => {
        updateGroups((prev) => [
            ...prev,
            {
                id: generateId(),
                title: "",
                items: [],
                sourceGroup: prefix === "ingredientGroup",
            },
        ]);
    };

    const removeGroup = (gIdx: number) => {
        updateGroups((prev) => prev.filter((_, i) => i !== gIdx));
    };

    const updateGroupTitle = (gIdx: number, title: string) => {
        updateGroups((prev) =>
            prev.map((g, i) => (i === gIdx ? { ...g, title } : g))
        );
    };

    // ── New item per group ──

    const appendNewItem = (gIdx: number) => {
        const value = (newItemValues[gIdx] ?? "").trim();
        if (!value) return;

        const newId = generateId();
        updateGroups((prev) =>
            prev.map((g, i) => {
                if (i !== gIdx) return g;
                return { ...g, items: [...g.items, { id: newId, value }] };
            })
        );
        setNewItemValues((prev) => ({ ...prev, [gIdx]: "" }));
        newInputRefs.current[gIdx]?.focus();
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="space-y-6">
                <SortableContext
                    items={groups.map((group) => group.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {groups.map((group, gIdx) => {
                        const groupItemIds = group.items.map((item) => item.id);

                        return (
                            <SortableGroupCard key={group.id} groupId={group.id}>
                                {({ attributes, listeners }) => (
                                    <>
                                        {/* Group header */}
                                        <div className="mb-2 flex items-center gap-2">
                                            <button
                                                type="button"
                                                data-group-grip
                                                className="cursor-grab rounded-full p-1 text-slate-300 active:cursor-grabbing dark:text-slate-600"
                                                aria-label={`Reorder group ${gIdx + 1}`}
                                                {...attributes}
                                                {...listeners}
                                            >
                                                <GripVertical className="h-4 w-4" />
                                            </button>
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
                                                className="rounded-full p-2 text-slate-300 opacity-100 transition-opacity hover:bg-rose-50 hover:text-rose-500 md:opacity-0 md:group-hover/section:opacity-100 dark:hover:bg-rose-950/30"
                                                title="Remove Section"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>

                                        <DroppableGroupContainer groupId={group.id}>
                                            {/* Hidden input serializes items for form submission */}
                                            <input
                                                type="hidden"
                                                name={`${prefix}Items_${gIdx}`}
                                                value={[
                                                    ...group.items.map((item) => item.value),
                                                    ...(newItemValues[gIdx]?.trim()
                                                        ? [newItemValues[gIdx].trim()]
                                                        : []),
                                                ].join("\n")}
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
                                        </DroppableGroupContainer>
                                    </>
                                )}
                            </SortableGroupCard>
                        );
                    })}
                </SortableContext>

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
                {activeType === "item" && activeItem ? (
                    <DragOverlayItem value={activeItem.item.value} />
                ) : null}
                {activeType === "group" && activeGroup ? (
                    <DragOverlayGroup title={activeGroup.title} />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
