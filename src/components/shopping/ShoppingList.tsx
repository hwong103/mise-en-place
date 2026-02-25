"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ShoppingCategory } from "@/lib/shopping";
import type { ShoppingListItem } from "@prisma/client";
import ShoppingActions from "@/components/shopping/ShoppingActions";
import {
  addManualShoppingItem,
  clearShoppingListWeek,
  removeManualShoppingItem,
  suppressShoppingItem,
  toggleShoppingItem,
  updateShoppingItemLocation,
} from "@/app/(dashboard)/shopping/actions";
import {
  buildShoppingItemKey,
  buildShoppingLocationPreferenceKey,
  DEFAULT_SHOPPING_LOCATION,
  DEFAULT_SHOPPING_LOCATIONS,
  normalizeShoppingLocation,
} from "@/lib/shopping-location";

const SUPPRESS_PREFIX = "__suppress__:";
const isSuppressedMarkerLine = (line: string) => line.startsWith(SUPPRESS_PREFIX);
const parseSuppressedMarkerLine = (line: string) =>
  isSuppressedMarkerLine(line) ? line.slice(SUPPRESS_PREFIX.length) : line;

const normalizeLocationLabel = (value: string) => value.trim().replace(/\s+/g, " ");
const buildLocationPanelId = (location: string) =>
  `shopping-location-${location
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;

const mergeLocationOptions = (...groups: Array<readonly string[] | string[]>) => {
  const seen = new Set<string>();
  const merged: string[] = [];

  groups.forEach((group) => {
    group.forEach((value) => {
      const normalized = normalizeLocationLabel(value);
      if (!normalized) {
        return;
      }
      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      merged.push(normalized);
    });
  });

  return merged;
};

type ShoppingListProps = {
  weekKey: string;
  categories: ShoppingCategory[];
  persistedItems: ShoppingListItem[];
  locationPreferences: Record<string, string>;
  shareInviteUrl: string | null;
};

type MergedItem = {
  line: string;
  count: number;
  amountSummary?: string;
  key: string;
  manual: boolean;
  id?: string;
  recipes: string[];
  category: string;
  location: string;
};

export default function ShoppingList({
  weekKey,
  categories,
  persistedItems,
  locationPreferences,
  shareInviteUrl,
}: ShoppingListProps) {
  const router = useRouter();
  const [manualLine, setManualLine] = useState("");
  const [manualCategory, setManualCategory] = useState("Other");
  const [manualLocation, setManualLocation] = useState(DEFAULT_SHOPPING_LOCATION);
  const [newLocation, setNewLocation] = useState("");
  const [optimisticChecked, setOptimisticChecked] = useState<Record<string, boolean>>({});
  const [optimisticLocations, setOptimisticLocations] = useState<Record<string, string>>({});
  const [suppressedKeys, setSuppressedKeys] = useState<Record<string, boolean>>({});
  const [pendingKeys, setPendingKeys] = useState<Record<string, boolean>>({});
  const [activeLocation, setActiveLocation] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const initialLocationOptions = useMemo(
    () =>
      mergeLocationOptions(
        DEFAULT_SHOPPING_LOCATIONS,
        Object.values(locationPreferences),
        persistedItems.map((item) => item.location)
      ),
    [locationPreferences, persistedItems]
  );
  const [locationOptions, setLocationOptions] = useState<string[]>(initialLocationOptions);

  useEffect(() => {
    setLocationOptions((current) => mergeLocationOptions(current, initialLocationOptions));
  }, [initialLocationOptions]);

  const persistedLookup = useMemo(() => {
    const map = new Map<string, ShoppingListItem>();
    persistedItems.forEach((item) => {
      if (isSuppressedMarkerLine(item.line)) {
        return;
      }
      const key = buildShoppingItemKey(item.category, item.line, item.manual);
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
      set.add(buildShoppingItemKey(item.category, targetLine, false));
    });
    return set;
  }, [persistedItems]);

  const categoryOrderLookup = useMemo(() => {
    const lookup = new Map<string, number>();
    categories.forEach((category, index) => {
      lookup.set(category.name, index);
    });
    return lookup;
  }, [categories]);

  const mergedLocations = useMemo(() => {
    const isItemSuppressed = (key: string) => suppressedKeys[key] || suppressedAutoKeySet.has(key);

    const addItemToLocationMap = (
      map: Map<string, Map<string, MergedItem[]>>,
      location: string,
      category: string,
      item: Omit<MergedItem, "category" | "location">
    ) => {
      const locationName = normalizeShoppingLocation(location);
      const categoryMap = map.get(locationName) ?? new Map<string, MergedItem[]>();
      const categoryItems = categoryMap.get(category) ?? [];
      categoryItems.push({
        ...item,
        category,
        location: locationName,
      });
      categoryMap.set(category, categoryItems);
      map.set(locationName, categoryMap);
    };

    const locationMap = new Map<string, Map<string, MergedItem[]>>();

    categories.forEach((category) => {
      category.items.forEach((item) => {
        const key = buildShoppingItemKey(category.name, item.line, false);
        if (isItemSuppressed(key)) {
          return;
        }

        const persisted = persistedLookup.get(key);
        const preferenceKey = buildShoppingLocationPreferenceKey(category.name, item.line);
        const location =
          optimisticLocations[key] ??
          persisted?.location ??
          locationPreferences[preferenceKey] ??
          DEFAULT_SHOPPING_LOCATION;

        addItemToLocationMap(locationMap, location, category.name, {
          line: item.line,
          count: item.count,
          amountSummary: item.amountSummary,
          key,
          manual: false,
          id: persisted?.id,
          recipes: item.recipes,
        });
      });
    });

    persistedItems
      .filter((item) => item.manual && !isSuppressedMarkerLine(item.line))
      .forEach((item) => {
        const key = buildShoppingItemKey(item.category, item.line, true);
        if (isItemSuppressed(key)) {
          return;
        }

        const location = optimisticLocations[key] ?? item.location ?? DEFAULT_SHOPPING_LOCATION;
        addItemToLocationMap(locationMap, location, item.category, {
          line: item.line,
          count: 1,
          amountSummary: undefined,
          key,
          manual: true,
          id: item.id,
          recipes: [],
        });
      });

    return Array.from(locationMap.entries())
      .map(([locationName, categoryMap]) => ({
        name: locationName,
        categories: Array.from(categoryMap.entries())
          .map(([name, items]) => ({
            name,
            items: items.sort((a, b) => a.line.localeCompare(b.line)),
          }))
          .sort((a, b) => {
            const aOrder = categoryOrderLookup.get(a.name) ?? Number.MAX_SAFE_INTEGER;
            const bOrder = categoryOrderLookup.get(b.name) ?? Number.MAX_SAFE_INTEGER;
            if (aOrder !== bOrder) {
              return aOrder - bOrder;
            }
            return a.name.localeCompare(b.name);
          }),
      }))
      .filter((location) => location.categories.length > 0)
      .sort((a, b) => {
        const aDefault = DEFAULT_SHOPPING_LOCATIONS.findIndex((value) => value === a.name);
        const bDefault = DEFAULT_SHOPPING_LOCATIONS.findIndex((value) => value === b.name);
        const aPriority = aDefault === -1 ? Number.MAX_SAFE_INTEGER : aDefault;
        const bPriority = bDefault === -1 ? Number.MAX_SAFE_INTEGER : bDefault;
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        return a.name.localeCompare(b.name);
      });
  }, [
    categories,
    categoryOrderLookup,
    locationPreferences,
    optimisticLocations,
    persistedItems,
    persistedLookup,
    suppressedAutoKeySet,
    suppressedKeys,
  ]);

  useEffect(() => {
    if (mergedLocations.length === 0) {
      setActiveLocation(null);
      return;
    }

    setActiveLocation((current) => {
      if (current && mergedLocations.some((location) => location.name === current)) {
        return current;
      }
      return mergedLocations[0].name;
    });
  }, [mergedLocations]);

  const activeLocationGroup = useMemo(() => {
    if (!activeLocation) {
      return mergedLocations[0] ?? null;
    }

    return mergedLocations.find((location) => location.name === activeLocation) ?? mergedLocations[0] ?? null;
  }, [activeLocation, mergedLocations]);

  const categoryOptions = useMemo(() => {
    const names = new Set<string>(categories.map((category) => category.name));
    names.add("Other");
    return Array.from(names);
  }, [categories]);

  const handleToggle = (item: { key: string; line: string; manual: boolean; category: string; location: string }) => {
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
          location: item.location,
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

  const handleSuppress = (item: {
    key: string;
    line: string;
    manual: boolean;
    category: string;
    location: string;
    id?: string;
  }) => {
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
          location: item.location,
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

  const handleLocationChange = (item: {
    key: string;
    line: string;
    manual: boolean;
    category: string;
    location: string;
  }) => {
    const location = normalizeShoppingLocation(item.location);

    setOptimisticLocations((prev) => ({ ...prev, [item.key]: location }));
    setLocationOptions((current) => mergeLocationOptions(current, [location]));
    setPendingKeys((prev) => ({ ...prev, [item.key]: true }));

    startTransition(async () => {
      try {
        await updateShoppingItemLocation({
          weekKey,
          line: item.line,
          category: item.category,
          manual: item.manual,
          location,
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

    const location = normalizeShoppingLocation(manualLocation);
    setManualLine("");
    setLocationOptions((current) => mergeLocationOptions(current, [location]));

    startTransition(async () => {
      await addManualShoppingItem({
        weekKey,
        line: trimmed,
        category: manualCategory,
        location,
      });
    });
  };

  const handleAddLocation = () => {
    const location = normalizeLocationLabel(newLocation);
    if (!location) {
      return;
    }

    setLocationOptions((current) => mergeLocationOptions(current, [location]));
    setManualLocation(location);
    setNewLocation("");
  };

  const handleClearList = () => {
    const confirmed = window.confirm("Clear all shopping items for this week?");
    if (!confirmed) {
      return;
    }

    const autoItems = categories.flatMap((category) =>
      category.items.map((item) => ({
        line: item.line,
        category: category.name,
      }))
    );

    setIsClearing(true);
    startTransition(async () => {
      try {
        await clearShoppingListWeek({ weekKey, autoItems });
        router.refresh();
      } finally {
        setIsClearing(false);
      }
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Shopping List</h1>
          <p className="text-slate-500 dark:text-slate-400">Confirm what you have and what you need.</p>
        </div>
        <ShoppingActions
          shareInviteUrl={shareInviteUrl}
          onClearList={handleClearList}
          clearing={isClearing}
        />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Add Manual Items</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1.5fr_1fr_1fr_auto]">
          <input
            value={manualLine}
            onChange={(event) => setManualLine(event.target.value)}
            placeholder="Paper towels, coffee, etc."
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
          <select
            value={manualLocation}
            onChange={(event) => setManualLocation(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            {locationOptions.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddManual}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={isPending}
          >
            Add
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            value={newLocation}
            onChange={(event) => setNewLocation(event.target.value)}
            placeholder="Add a new location"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none sm:max-w-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={handleAddLocation}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Add Location
          </button>
        </div>
      </section>

      {mergedLocations.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          No ingredients yet. Add meals in the planner to generate your list.
        </div>
      ) : (
        <div className="space-y-6">
          <div
            className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            role="tablist"
            aria-label="Shopping locations"
          >
            {mergedLocations.map((locationGroup) => {
              const itemCount = locationGroup.categories.reduce(
                (total, category) => total + category.items.length,
                0
              );
              const isActive = locationGroup.name === activeLocationGroup?.name;
              return (
                <button
                  key={locationGroup.name}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={buildLocationPanelId(locationGroup.name)}
                  onClick={() => setActiveLocation(locationGroup.name)}
                  className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {locationGroup.name}
                  <span className={`ml-2 text-xs ${isActive ? "text-emerald-100" : "text-slate-500 dark:text-slate-400"}`}>
                    {itemCount}
                  </span>
                </button>
              );
            })}
          </div>

          {activeLocationGroup ? (
            <section
              key={activeLocationGroup.name}
              id={buildLocationPanelId(activeLocationGroup.name)}
              role="tabpanel"
              className="space-y-6"
            >
              <h2 className="text-base font-extrabold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
                {activeLocationGroup.name}
              </h2>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {activeLocationGroup.categories.map((category) => (
                  <div key={`${activeLocationGroup.name}-${category.name}`} className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {category.name}
                    </h3>
                    <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {category.items.map((item) => {
                          const isChecked =
                            optimisticChecked[item.key] ?? (persistedLookup.get(item.key)?.checked ?? false);
                          const isSaving = pendingKeys[item.key] ?? false;
                          const itemLocationOptions = mergeLocationOptions(locationOptions, [item.location]);

                          return (
                            <li key={item.key} className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
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
                                        location: item.location,
                                      })
                                    }
                                    className="mt-1 h-4 w-4 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-900"
                                  />
                                  <div>
                                    <div className={isChecked ? "line-through text-slate-400 dark:text-slate-500" : ""}>
                                      {item.line}
                                    </div>
                                    {item.amountSummary ? (
                                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Amount: {item.amountSummary}
                                      </div>
                                    ) : null}
                                    {item.recipes.length > 0 ? (
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        {item.recipes.map((recipe) => (
                                          <span
                                            key={`${item.key}-${recipe}`}
                                            className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"
                                          >
                                            {recipe}
                                          </span>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                </label>

                                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                  <select
                                    value={item.location}
                                    onChange={(event) =>
                                      handleLocationChange({
                                        key: item.key,
                                        line: item.line,
                                        manual: item.manual,
                                        category: category.name,
                                        location: event.target.value,
                                      })
                                    }
                                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                    disabled={isSaving || isPending}
                                    aria-label={`Location for ${item.line}`}
                                  >
                                    {itemLocationOptions.map((location) => (
                                      <option key={location} value={location}>
                                        {location}
                                      </option>
                                    ))}
                                  </select>
                                  {item.amountSummary ? (
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                      {item.amountSummary}
                                    </span>
                                  ) : item.count > 1 ? (
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                      x{item.count}
                                    </span>
                                  ) : null}
                                  {isSaving ? (
                                    <span className="text-xs text-slate-400 dark:text-slate-500">Saving...</span>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSuppress({
                                        key: item.key,
                                        line: item.line,
                                        manual: item.manual,
                                        category: category.name,
                                        location: item.location,
                                        id: item.id,
                                      })
                                    }
                                    className="rounded-full p-1 text-rose-500 transition-colors hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-900/30"
                                    disabled={isSaving || isPending}
                                    aria-label={`Remove ${item.line}`}
                                    title="Remove item"
                                  >
                                    <Trash2 className="h-4 w-4" strokeWidth={1.8} />
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
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
