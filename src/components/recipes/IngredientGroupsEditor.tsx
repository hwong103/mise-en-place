"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import LineListEditor from "./LineListEditor";
import { type PrepGroup } from "@/lib/recipe-utils";

type IngredientGroupsEditorProps = {
    initialGroups: PrepGroup[];
};

export default function IngredientGroupsEditor({ initialGroups }: IngredientGroupsEditorProps) {
    const [localGroups, setLocalGroups] = useState<PrepGroup[]>(initialGroups);

    const addGroup = () => {
        setLocalGroups([...localGroups, { title: "", items: [], sourceGroup: true }]);
    };

    const removeGroup = (index: number) => {
        setLocalGroups(localGroups.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-6">
            {localGroups.map((group, gIdx) => (
                <div
                    key={gIdx}
                    className="group relative rounded-2xl border border-slate-100 bg-slate-50/30 p-4 dark:border-slate-800/50 dark:bg-slate-900/40"
                >
                    <div className="mb-2 flex items-center gap-2">
                        <input
                            type="text"
                            name={`ingredientGroupTitle_${gIdx}`}
                            defaultValue={group.title}
                            placeholder="Group Title (e.g. For the Sauce)"
                            className="flex-1 bg-transparent text-xs font-bold uppercase tracking-widest text-slate-400 outline-none placeholder:text-slate-300 focus:text-emerald-600 dark:text-slate-500 dark:placeholder:text-slate-700 dark:focus:text-emerald-400"
                        />
                        <input type="hidden" name={`ingredientGroupExists_${gIdx}`} value="true" />
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
                        name={`ingredientGroupItems_${gIdx}`}
                        initialItems={group.items}
                        ordered={false}
                        placeholder="e.g. 2 tbsp olive oil"
                        addLabel="+ Add ingredient"
                    />
                </div>
            ))}
            <button
                type="button"
                onClick={addGroup}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-3 text-xs font-semibold text-slate-400 transition-colors hover:border-emerald-200 hover:bg-emerald-50/30 hover:text-emerald-600 dark:border-slate-800 dark:hover:border-emerald-900/30 dark:hover:bg-emerald-950/20"
            >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Ingredient Section</span>
            </button>
        </div>
    );
}
