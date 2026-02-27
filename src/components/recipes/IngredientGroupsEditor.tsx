"use client";

import { useState, useEffect } from "react";
import { Plus, X, GripVertical } from "lucide-react";
import LineListEditor from "./LineListEditor";
import { type PrepGroup } from "@/lib/recipe-utils";

type IngredientGroupsEditorProps = {
    initialGroups: PrepGroup[];
    prefix?: string;
    showStepBadge?: boolean;
};

export default function IngredientGroupsEditor({
    initialGroups,
    prefix = "ingredientGroup",
    showStepBadge = false
}: IngredientGroupsEditorProps) {
    const [localGroups, setLocalGroups] = useState<PrepGroup[]>(initialGroups);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    // Sync with initialGroups if they change (e.g. from server)
    useEffect(() => {
        setLocalGroups(initialGroups);
    }, [initialGroups]);

    const addGroup = () => {
        setLocalGroups([...localGroups, { title: "", items: [], sourceGroup: prefix === "ingredientGroup" }]);
    };

    const removeGroup = (index: number) => {
        setLocalGroups(localGroups.filter((_, i) => i !== index));
    };

    const handleDragStart = (idx: number) => {
        setDraggedIndex(idx);
    };

    const handleDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === idx) return;

        const newGroups = [...localGroups];
        const draggedItem = newGroups[draggedIndex];
        newGroups.splice(draggedIndex, 1);
        newGroups.splice(idx, 0, draggedItem);
        setDraggedIndex(idx);
        setLocalGroups(newGroups);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    return (
        <div className="space-y-6">
            {localGroups.map((group, gIdx) => (
                <div
                    key={gIdx}
                    draggable
                    onDragStart={() => handleDragStart(gIdx)}
                    onDragOver={(e) => handleDragOver(e, gIdx)}
                    onDragEnd={handleDragEnd}
                    className={`group relative rounded-2xl border bg-slate-50/30 p-4 transition-all dark:bg-slate-900/40 
                        ${draggedIndex === gIdx ? "opacity-40 grayscale border-emerald-500/50" : "border-slate-100 dark:border-slate-800/50"}`}
                >
                    <div className="mb-2 flex items-center gap-2">
                        <div className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600">
                            <GripVertical className="h-4 w-4" />
                        </div>
                        <input
                            type="text"
                            name={`${prefix}Title_${gIdx}`}
                            defaultValue={group.title}
                            placeholder={showStepBadge ? "Step Title (optional)" : "Group Title (e.g. For the Sauce)"}
                            className="flex-1 bg-transparent text-xs font-bold uppercase tracking-widest text-slate-400 outline-none placeholder:text-slate-300 focus:text-emerald-600 dark:text-slate-500 dark:placeholder:text-slate-700 dark:focus:text-emerald-400"
                        />
                        {showStepBadge && group.stepIndex !== undefined && (
                            <div className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                <span>Step {group.stepIndex + 1}</span>
                                <input type="hidden" name={`${prefix}StepIndex_${gIdx}`} value={group.stepIndex} />
                            </div>
                        )}
                        <input type="hidden" name={`${prefix}Exists_${gIdx}`} value="true" />
                        <button
                            type="button"
                            onClick={() => removeGroup(gIdx)}
                            className="text-slate-300 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
                            title="Remove Section"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <LineListEditor
                        name={`${prefix}Items_${gIdx}`}
                        initialItems={group.items}
                        ordered={false}
                        placeholder={showStepBadge ? "Add prep step items..." : "e.g. 2 tbsp olive oil"}
                        addLabel={showStepBadge ? "+ Add item" : "+ Add ingredient"}
                    />
                </div>
            ))}
            <button
                type="button"
                onClick={addGroup}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-3 text-xs font-semibold text-slate-400 transition-colors hover:border-emerald-200 hover:bg-emerald-50/30 hover:text-emerald-600 dark:border-slate-800 dark:hover:border-emerald-900/30 dark:hover:bg-emerald-950/20"
            >
                <Plus className="h-3.5 w-3.5" />
                <span>{showStepBadge ? "Add Prep Group" : "Add Ingredient Section"}</span>
            </button>
        </div>
    );
}
