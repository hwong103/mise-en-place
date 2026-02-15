"use client";

import { useMemo, useState, useTransition } from "react";
import type { ShoppingCategory } from "@/lib/shopping";
import type { ShoppingListItem } from "@prisma/client";
import ShoppingActions from "@/components/shopping/ShoppingActions";
import {
  addManualShoppingItem,
  removeManualShoppingItem,
  suppressShoppingItem,
  toggleShoppingItem,
} from "@/app/(dashboard)/shopping/actions";

const SUPPRESS_PREFIX = "__suppress__:";
const isSuppressedMarkerLine = (line: string) => line.startsWith(SUPPRESS_PREFIX);
const parseSuppressedMarkerLine = (line: string) =>
  isSuppressedMarkerLine(line) ? line.slice(SUPPRESS_PREFIX.length) : line;

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
  const [optimisticChecked, setOptimisticChecked] = useState<Record<string, boolean>>({});
  const [suppressedKeys, setSuppressedKeys] = useState<Record<string, boolean>>({});
  const [pendingKeys, setPendingKeys] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  const persistedLookup = useMemo(() => {
    const map = new Map<string, ShoppingListItem>();
    persistedItems.forEach((item) => {
      if (isSuppressedMarkerLine(item.line)) {
        return;
      }
      const key = buildItemKey(item.category, item.line, item.manual);
      map.set(key, item);
    });
    return map;
  }, [persistedItems]);

  const suppressedAutoKeySet = useMemo(() => {
    const set = new Set<string>();
    persistedItems.forEach((item) => {
      if (!item.manual || !isSuppressedMarkerLine(item.line)) {
        return;
      }
      const targetLine = parseSuppressedMarkerLine(item.line);
      set.add(buildItemKey(item.category, targetLine, false));
    });
    return set;
  }, [persistedItems]);

  const mergedCategories = useMemo(() => {
    const isItemSuppressed = (key: string) => suppressedKeys[key] || suppressedAutoKeySet.has(key);

    const map = new Map<
      string,
      { line: string; count: number; key: string; manual: boolean; id?: string; recipes: string[] }[]
    >();

    categories.forEach((category) => {
      const list = map.get(category.name) ?? [];
      category.items.forEach((item) => {
        const key = buildItemKey(category.name, item.line, false);
        if (isItemSuppressed(key)) {
          return;
        }
        list.push({
          line: item.line,
          count: item.count,
          key,
          manual: false,
          id: persistedLookup.get(key)?.id,
          recipes: item.recipes,
        });
      });
      map.set(category.name, list);
    });

    persistedItems
      .filter((item) => item.manual && !isSuppressedMarkerLine(item.line))
      .forEach((item) => {
        const list = map.get(item.category) ?? [];
        const key = buildItemKey(item.category, item.line, true);
        if (isItemSuppressed(key)) {
          return;
        }
        list.push({
          line: item.line,
          count: 1,
          key,
          manual: true,
          id: item.id,
          recipes: [],
        });
        map.set(item.category, list);
      });

    return Array.from(map.entries())
      .map(([name, items]) => ({
        name,
        items,
      }))
      .filter((category) => category.items.length > 0);
  }, [categories, persistedItems, persistedLookup, suppressedAutoKeySet, suppressedKeys]);

  const shareText = useMemo(() => {
    if (mergedCategories.length === 0) {
      return "No items in the shopping list yet.";
    }

    const lines = mergedCategories
      .map((category) => {
        const items = category.items
          .filter((item) => {
            const checked = optimisticChecked[item.key] ?? persistedLookup.get(item.key)?.checked ?? false;
            return !checked;
          })
          .map((item) => (item.count > 1 ? `- ${item.line} (x${item.count})` : `- ${item.line}`))
          .join("\n");
        if (!items) {
          return null;
        }
        return `${category.name}\n${items}`;
      })
      .filter(Boolean);

    return [`Shopping List (${weekLabel})`, "", ...lines].join("\n\n");
  }, [mergedCategories, optimisticChecked, persistedLookup, weekLabel]);

  const categoryOptions = useMemo(() => {
    const names = new Set<string>(categories.map((category) => category.name));
    names.add("Other");
    return Array.from(names);
  }, [categories]);

  const handleToggle = (item: { key: string; line: string; manual: boolean; category: string }) => {
    const current = persistedLookup.get(item.key);
    const currentChecked = optimisticChecked[item.key] ?? (current?.checked ?? false);
    const nextChecked = !currentChecked;

    setOptimisticChecked((prev) => ({ ...prev, [item.key]: nextChecked }));
    setPendingKeys((prev) => ({ ...prev, [item.key]: true }));

    startTransition(async () => {
      try {
        await toggleShoppingItem({
          weekKey,
          line: item.line,
          category: item.category,
          manual: item.manual,
          checked: nextChecked,
        });
      } finally {
        setPendingKeys((prev) => {
          const next = { ...prev };
          delete next[item.key];
          return next;
        });
      }
    });
  };

  const handleSuppress = (item: { key: string; line: string; manual: boolean; category: string; id?: string }) => {
    setSuppressedKeys((prev) => ({ ...prev, [item.key]: true }));
    setPendingKeys((prev) => ({ ...prev, [item.key]: true }));

    startTransition(async () => {
      try {
        if (item.manual && item.id) {
          await removeManualShoppingItem({ id: item.id });
          return;
        }

        await suppressShoppingItem({
          weekKey,
          line: item.line,
          category: item.category,
          manual: item.manual,
        });
      } finally {
        setPendingKeys((prev) => {
          const next = { ...prev };
          delete next[item.key];
          return next;
        });
      }
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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Shopping List</h1>
          <p className="text-slate-500 dark:text-slate-400">Confirm what you have and what you need.</p>
        </div>
        <ShoppingActions shareText={shareText} />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Add Manual Items</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1.5fr_1fr_auto]">
          <input
            value={manualLine}
            onChange={(event) => setManualLine(event.target.value)}
            placeholder="Paper towels, coffee, etc."
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <select
            value={manualCategory}
            onChange={(event) => setManualCategory(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
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
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          No ingredients yet. Add meals in the planner to generate your list.
        </div>
      ) : (
        <div className="max-w-4xl space-y-8">
          {mergedCategories.map((category) => (
            <div key={category.name} className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{category.name}</h3>
              <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {category.items.map((item) => {
                    const isChecked =
                      optimisticChecked[item.key] ?? (persistedLookup.get(item.key)?.checked ?? false);
                    const isSaving = pendingKeys[item.key] ?? false;

                    return (
                      <li key={item.key} className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">
                        <div className="flex items-start justify-between gap-4">
                          <label className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() =>
                                handleToggle({
                                  key: item.key,
                                  line: item.line,
                                  manual: item.manual,
                                  category: category.name,
                                })
                              }
                              className="mt-1 h-4 w-4 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-900"
                            />
                            <div>
                              <div className={isChecked ? "line-through text-slate-400 dark:text-slate-500" : ""}>{item.line}</div>
                              {item.recipes.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {item.recipes.map((recipe) => (
                                    <span
                                      key={`${item.key}-${recipe}`}
                                      className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600"
                                    >
                                      {recipe}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </label>

                          <div className="flex items-center gap-3">
                            {item.count > 1 ? (
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                x{item.count}
                              </span>
                            ) : null}
                            {isSaving ? <span className="text-xs text-slate-400 dark:text-slate-500">Saving...</span> : null}
                            <button
                              type="button"
                              onClick={() =>
                                handleSuppress({
                                  key: item.key,
                                  line: item.line,
                                  manual: item.manual,
                                  category: category.name,
                                  id: item.id,
                                })
                              }
                              className="text-xs font-semibold text-rose-500"
                              disabled={isSaving || isPending}
                            >
                              Remove
                            </button>
                          </div>
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
