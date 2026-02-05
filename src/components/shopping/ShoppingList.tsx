"use client";

import { useMemo, useState, useTransition } from "react";
import type { ShoppingCategory } from "@/lib/shopping";
import type { ShoppingListItem } from "@prisma/client";
import ShoppingActions from "@/components/shopping/ShoppingActions";
import { addManualShoppingItem, removeManualShoppingItem, toggleShoppingItem } from "@/app/(dashboard)/shopping/actions";

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

type ShoppingListProps = {
  weekKey: string;
  weekLabel: string;
  categories: ShoppingCategory[];
  persistedItems: ShoppingListItem[];
};

const buildItemKey = (category: string, line: string, manual: boolean) =>
  `${manual ? "manual" : "auto"}-${normalize(category)}-${normalize(line)}`;

export default function ShoppingList({
  weekKey,
  weekLabel,
  categories,
  persistedItems,
}: ShoppingListProps) {
  const [manualLine, setManualLine] = useState("");
  const [manualCategory, setManualCategory] = useState("Other");
  const [isPending, startTransition] = useTransition();

  const persistedLookup = useMemo(() => {
    const map = new Map<string, ShoppingListItem>();
    persistedItems.forEach((item) => {
      const key = buildItemKey(item.category, item.line, item.manual);
      map.set(key, item);
    });
    return map;
  }, [persistedItems]);

  const mergedCategories = useMemo(() => {
    const map = new Map<string, { line: string; count: number; key: string; manual: boolean; id?: string }[]>();

    categories.forEach((category) => {
      const list = map.get(category.name) ?? [];
      category.items.forEach((item) => {
        const key = buildItemKey(category.name, item.line, false);
        list.push({
          line: item.line,
          count: item.count,
          key,
          manual: false,
          id: persistedLookup.get(key)?.id,
        });
      });
      map.set(category.name, list);
    });

    persistedItems
      .filter((item) => item.manual)
      .forEach((item) => {
        const list = map.get(item.category) ?? [];
        const key = buildItemKey(item.category, item.line, true);
        list.push({
          line: item.line,
          count: 1,
          key,
          manual: true,
          id: item.id,
        });
        map.set(item.category, list);
      });

    return Array.from(map.entries()).map(([name, items]) => ({
      name,
      items,
    }));
  }, [categories, persistedItems, persistedLookup]);

  const shareText = useMemo(() => {
    if (mergedCategories.length === 0) {
      return "No items in the shopping list yet.";
    }

    const lines = mergedCategories
      .map((category) => {
        const items = category.items
          .filter((item) => !persistedLookup.get(item.key)?.checked)
          .map((item) => (item.count > 1 ? `- ${item.line} (x${item.count})` : `- ${item.line}`))
          .join("\n");
        if (!items) {
          return null;
        }
        return `${category.name}\n${items}`;
      })
      .filter(Boolean);

    return [`Shopping List (${weekLabel})`, "", ...lines].join("\n\n");
  }, [mergedCategories, persistedLookup, weekLabel]);

  const categoryOptions = useMemo(() => {
    const names = new Set<string>(categories.map((category) => category.name));
    names.add("Other");
    return Array.from(names);
  }, [categories]);

  const handleToggle = (item: { key: string; line: string; manual: boolean; id?: string; category: string }) => {
    const current = persistedLookup.get(item.key);
    const nextChecked = !(current?.checked ?? false);

    startTransition(async () => {
      await toggleShoppingItem({
        weekKey,
        line: item.line,
        category: item.category,
        manual: item.manual,
        checked: nextChecked,
      });
    });
  };

  const handleAddManual = () => {
    const trimmed = manualLine.trim();
    if (!trimmed) {
      return;
    }
    setManualLine("");
    startTransition(async () => {
      await addManualShoppingItem({
        weekKey,
        line: trimmed,
        category: manualCategory,
      });
    });
  };

  const handleRemoveManual = (itemId?: string) => {
    if (!itemId) {
      return;
    }
    startTransition(async () => {
      await removeManualShoppingItem({ id: itemId });
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Shopping List</h1>
          <p className="text-slate-500">Confirm what you have and what you need.</p>
        </div>
        <ShoppingActions shareText={shareText} />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Add Manual Items</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1.5fr_1fr_auto]">
          <input
            value={manualLine}
            onChange={(event) => setManualLine(event.target.value)}
            placeholder="Paper towels, coffee, etc."
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
          />
          <select
            value={manualCategory}
            onChange={(event) => setManualCategory(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            {categoryOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddManual}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={isPending}
          >
            Add
          </button>
        </div>
      </section>

      {mergedCategories.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          No ingredients yet. Add meals in the planner to generate your list.
        </div>
      ) : (
        <div className="max-w-3xl space-y-8">
          {mergedCategories.map((category) => (
            <div key={category.name} className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">{category.name}</h3>
              <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
                <ul className="divide-y divide-slate-100">
                  {category.items.map((item) => {
                    const isChecked = persistedLookup.get(item.key)?.checked ?? false;
                    return (
                      <li key={item.key} className="flex items-center justify-between px-6 py-4 text-sm text-slate-700">
                        <label className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() =>
                              handleToggle({
                                key: item.key,
                                line: item.line,
                                manual: item.manual,
                                id: item.id,
                                category: category.name,
                              })
                            }
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span className={isChecked ? "line-through text-slate-400" : ""}>{item.line}</span>
                        </label>
                        <div className="flex items-center gap-3">
                          {item.count > 1 ? (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                              x{item.count}
                            </span>
                          ) : null}
                          {item.manual ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveManual(item.id)}
                              className="text-xs font-semibold text-rose-500"
                              disabled={isPending}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
