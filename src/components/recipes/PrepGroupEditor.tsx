"use client";

import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import LineListEditor from "@/components/recipes/LineListEditor";
import type { PrepGroup } from "@/lib/recipe-utils";

type GroupItem = {
    id: string;
    title: string;
    items: string[];
};

type PrepGroupEditorProps = {
    initialGroups: PrepGroup[];
};

const nextId = () =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `group-${Date.now()}-${Math.random().toString(36).slice(2)}`;

type GroupCardProps = {
    group: GroupItem;
    onTitleChange: (id: string, title: string) => void;
    onItemsChange: (id: string, items: string[]) => void;
    onDelete: (id: string) => void;
};

function GroupCard({ group, onTitleChange, onItemsChange, onDelete }: GroupCardProps) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
        id: group.id,
    });

    const style = { transform: CSS.Transform.toString(transform), transition };

    const handleItemsChange = useCallback(
        (items: string[]) => onItemsChange(group.id, items),
        [group.id, onItemsChange]
    );

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
        >
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    className="cursor-grab text-slate-400 hover:text-slate-600"
                    aria-label="Reorder group"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="h-4 w-4" />
                </button>
                <input
                    type="text"
                    value={group.title}
                    onChange={(e) => onTitleChange(group.id, e.target.value)}
                    className="flex-1 bg-transparent text-xs font-semibold uppercase tracking-widest text-slate-400 focus:outline-none dark:text-slate-500"
                    placeholder="Group name"
                />
                <button
                    type="button"
                    onClick={() => onDelete(group.id)}
                    className="text-slate-400 hover:text-rose-500"
                    aria-label="Delete group"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
            <LineListEditor
                name={`prepGroup-${group.id}`}
                initialItems={group.items}
                ordered={false}
                placeholder="e.g. 2 tbsp olive oil"
                addLabel="+ Add ingredient"
                onChange={handleItemsChange}
            />
        </div>
    );
}

export default function PrepGroupEditor({ initialGroups }: PrepGroupEditorProps) {
    const [groups, setGroups] = useState<GroupItem[]>(() =>
        initialGroups.map((g) => ({ ...g, id: nextId() }))
    );

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const groupIds = useMemo(() => groups.map((g) => g.id), [groups]);

    const serialized = useMemo(
        () =>
            groups
                .filter((g) => g.title.trim() && g.items.length > 0)
                .map((g) => `${g.title}\n${g.items.map((item) => `- ${item}`).join("\n")}`)
                .join("\n\n"),
        [groups]
    );

    const handleTitleChange = useCallback((id: string, title: string) => {
        setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, title } : g)));
    }, []);

    const handleItemsChange = useCallback((id: string, items: string[]) => {
        setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, items } : g)));
    }, []);

    const handleDelete = useCallback((id: string) => {
        setGroups((prev) => prev.filter((g) => g.id !== id));
    }, []);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        setGroups((prev) => {
            const oldIndex = prev.findIndex((g) => g.id === active.id);
            const newIndex = prev.findIndex((g) => g.id === over.id);
            return arrayMove(prev, oldIndex, newIndex);
        });
    };

    return (
        <div className="space-y-3">
            <input type="hidden" name="prepGroups" value={serialized} />
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                        {groups.map((group) => (
                            <GroupCard
                                key={group.id}
                                group={group}
                                onTitleChange={handleTitleChange}
                                onItemsChange={handleItemsChange}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
            <button
                type="button"
                onClick={() =>
                    setGroups((prev) => [...prev, { id: nextId(), title: "", items: [] }])
                }
                className="rounded-xl border border-dashed border-slate-300 px-4 py-2 text-xs font-semibold text-slate-500 hover:border-slate-400 dark:border-slate-700 dark:text-slate-400"
            >
                + Add Group
            </button>
        </div>
    );
}
