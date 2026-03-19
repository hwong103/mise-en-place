"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { CATEGORY_ORDER, type ShoppingCategory } from "@/lib/shopping";
import type { ShoppingListItem } from "@/lib/db-types";
import ShoppingActions from "@/components/shopping/ShoppingActions";
import { useAccessibleDialog } from "@/components/ui/useAccessibleDialog";
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
const toDisplayCategoryName = (category: string) => (category === "Pantry" ? "Dry Goods" : category);

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
  _optimistic?: boolean;
  _status?: "saving" | "error";
};

type OptimisticManualItem = {
  tempId: string;
  line: string;
  category: string;
  location: string;
  status: "saving" | "error";
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
  const [optimisticManualItems, setOptimisticManualItems] = useState<OptimisticManualItem[]>([]);
  const [suppressedKeys, setSuppressedKeys] = useState<Record<string, boolean>>({});
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const [pendingKeys, setPendingKeys] = useState<Record<string, boolean>>({});
  const [activeLocation, setActiveLocation] = useState<string | null>(null);
  const [completedTrayExpandedByLocation, setCompletedTrayExpandedByLocation] = useState<
    Record<string, boolean>
  >({});
  const [isClearing, setIsClearing] = useState(false);
  const [isMobileManualOpen, setIsMobileManualOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const mobileManualInputRef = useRef<HTMLInputElement>(null);
  const mobileManualDialogRef = useAccessibleDialog<HTMLDivElement>({
    isOpen: isMobileManualOpen,
    onClose: () => setIsMobileManualOpen(false),
    initialFocusRef: mobileManualInputRef,
  });

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
      displayCategory: string,
      item: Omit<MergedItem, "location">
    ) => {
      const locationName = normalizeShoppingLocation(location);
      const categoryMap = map.get(locationName) ?? new Map<string, MergedItem[]>();
      const categoryItems = categoryMap.get(displayCategory) ?? [];
      categoryItems.push({
        ...item,
        location: locationName,
      });
      categoryMap.set(displayCategory, categoryItems);
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

        addItemToLocationMap(locationMap, location, toDisplayCategoryName(category.name), {
          line: item.line,
          count: item.count,
          amountSummary: item.amountSummary,
          key,
          manual: false,
          id: persisted?.id,
          recipes: item.recipes,
          category: category.name,
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
        addItemToLocationMap(locationMap, location, toDisplayCategoryName(item.category), {
          line: item.line,
          count: 1,
          amountSummary: undefined,
          key,
          manual: true,
          id: item.id,
          recipes: [],
          category: item.category,
        });
      });

    optimisticManualItems.forEach((item) => {
      const alreadyPersisted = persistedItems.some(
        (persisted) =>
          persisted.manual &&
          persisted.line.trim().toLowerCase() === item.line.trim().toLowerCase() &&
          persisted.category === item.category
      );
      if (alreadyPersisted) {
        return;
      }

      const key = buildShoppingItemKey(item.category, item.line, true);
      if (isItemSuppressed(key)) {
        return;
      }

      addItemToLocationMap(locationMap, item.location, toDisplayCategoryName(item.category), {
        line: item.line,
        count: 1,
        amountSummary: undefined,
        key: `optimistic-${item.tempId}`,
        manual: true,
        id: undefined,
        recipes: [],
        category: item.category,
        _optimistic: true,
        _status: item.status,
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
    optimisticManualItems,
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

  const activeLocationView = useMemo(() => {
    if (!activeLocationGroup) {
      return null;
    }

    const categorized = activeLocationGroup.categories
      .map((category) => {
        const activeItems: MergedItem[] = [];

        category.items.forEach((item) => {
          const isChecked = optimisticChecked[item.key] ?? (persistedLookup.get(item.key)?.checked ?? false);
          if (isChecked) {
            return;
          }
          activeItems.push(item);
        });

        return {
          name: category.name,
          activeItems,
        };
      })
      .filter((category) => category.activeItems.length > 0);

    const completedItems = activeLocationGroup.categories.flatMap((category) =>
      category.items.filter((item) => optimisticChecked[item.key] ?? (persistedLookup.get(item.key)?.checked ?? false))
    );

    return {
      name: activeLocationGroup.name,
      activeCategories: categorized,
      completedItems,
    };
  }, [activeLocationGroup, optimisticChecked, persistedLookup]);

  const categoryOptions = useMemo(() => {
    return [...CATEGORY_ORDER];
  }, []);

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
    const tempId = crypto.randomUUID();

    setOptimisticManualItems((prev) => [
      ...prev,
      { tempId, line: trimmed, category: manualCategory, location, status: "saving" },
    ]);
    setLocationOptions((current) => mergeLocationOptions(current, [location]));
    setManualLine("");
    setIsMobileManualOpen(false);

    addManualShoppingItem({
        weekKey,
        line: trimmed,
        category: manualCategory,
        location,
      })
      .then(() => {
        setOptimisticManualItems((prev) => prev.filter((item) => item.tempId !== tempId));
      })
      .catch(() => {
        setOptimisticManualItems((prev) =>
          prev.map((item) => (item.tempId === tempId ? { ...item, status: "error" } : item))
        );
        setSaveErrors((prev) => [...prev, `Failed to save "${trimmed}"`]);
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

  const manualSection = (options?: {
    mobile?: boolean;
    embedded?: boolean;
    inputRef?: React.RefObject<HTMLInputElement | null>;
  }) => {
    const isMobile = options?.mobile ?? false;
    const isEmbedded = options?.embedded ?? false;

    return (
      <section
        className={`${
          isEmbedded
            ? "rounded-none border-0 bg-transparent p-0 shadow-none dark:bg-transparent"
            : "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        } ${
          isMobile ? "" : "hidden sm:block"
        }`}
      >
        {!isEmbedded ? (
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Add Manual Items</h2>
        ) : null}
        {saveErrors.length > 0 ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
            <div className="flex items-center justify-between gap-2">
              <span>{saveErrors[saveErrors.length - 1]}</span>
              <button
                type="button"
                onClick={() => setSaveErrors([])}
                className="text-xs font-semibold underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <input
            ref={options?.inputRef}
            value={manualLine}
            onChange={(event) => setManualLine(event.target.value)}
            placeholder="Paper towels, coffee, etc."
            className="order-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm focus:border-[var(--accent)] focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <select
            value={manualCategory}
            onChange={(event) => setManualCategory(event.target.value)}
            className="order-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 sm:order-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
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
            className="order-4 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 sm:order-3 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
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
            className="order-2 w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-base font-semibold text-white disabled:opacity-60 sm:order-4 sm:w-auto sm:py-2 sm:text-sm"
            disabled={!manualLine.trim()}
          >
            Add
          </button>
        </div>

        <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700 marker:hidden dark:text-slate-200">
            Add another shopping location
          </summary>
          <div className="mt-3 grid gap-3 sm:max-w-sm">
            <input
              value={newLocation}
              onChange={(event) => setNewLocation(event.target.value)}
              placeholder="Add a new location"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-[var(--accent)] focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={handleAddLocation}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Save Location
            </button>
          </div>
        </details>
      </section>
    );
  };

  return (
    <div className="space-y-6">
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

      {manualSection()}

      {mergedLocations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          No ingredients yet. Add meals in the planner to generate your list.
        </div>
      ) : (
        <div className="space-y-4">
          <div
            className="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            role="tablist"
            aria-label="Shopping locations"
          >
            {mergedLocations.map((locationGroup) => {
              const itemCount = locationGroup.categories.reduce((total, category) => {
                const activeCount = category.items.filter(
                  (item) => !(optimisticChecked[item.key] ?? (persistedLookup.get(item.key)?.checked ?? false))
                ).length;
                return total + activeCount;
              }, 0);
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
                      ? "bg-[var(--accent)] text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {locationGroup.name}
                  <span className={`ml-2 text-xs ${isActive ? "text-white/70" : "text-slate-500 dark:text-slate-400"}`}>
                    {itemCount}
                  </span>
                </button>
              );
            })}
          </div>

          {activeLocationView ? (
            <section
              key={activeLocationView.name}
              id={buildLocationPanelId(activeLocationView.name)}
              role="tabpanel"
              className="space-y-4"
            >
              {activeLocationView.activeCategories.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  All items done for this location.
                </div>
              ) : null}

              <div className="columns-1 gap-4 sm:columns-2">
                {activeLocationView.activeCategories.map((category) => (
                  <div
                    key={`${activeLocationView.name}-${category.name}`}
                    className="mb-4 break-inside-avoid space-y-2"
                  >
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {category.name}
                    </h3>
                    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {category.activeItems.map((item) => {
                          const isChecked =
                            optimisticChecked[item.key] ?? (persistedLookup.get(item.key)?.checked ?? false);
                          const isSaving = pendingKeys[item.key] ?? item._optimistic === true;
                          const isSaveError = item._status === "error";
                          const itemLocationOptions = mergeLocationOptions(locationOptions, [item.location]);

                          return (
                            <li key={item.key} className="px-4 py-3.5 text-sm text-slate-700 dark:text-slate-200">
                              <div className="flex items-center gap-2">
                                <label className="flex min-w-0 flex-1 items-start gap-3">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() =>
                                      handleToggle({
                                        key: item.key,
                                        line: item.line,
                                        manual: item.manual,
                                        category: item.category,
                                        location: item.location,
                                      })
                                    }
                                    className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-900"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div
                                      className={`truncate ${
                                        isChecked ? "line-through text-slate-400 dark:text-slate-500" : ""
                                      }`}
                                    >
                                      {item.line}
                                    </div>
                                    {item.manual || item.recipes.length > 0 ? (
                                      <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                                        {item.manual ? (
                                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                            Manual
                                          </span>
                                        ) : null}
                                        {item.recipes.map((recipe) => (
                                          <span
                                            key={`${item.key}-${recipe}`}
                                            className="rounded bg-teal-50 px-1.5 py-0.5 font-medium text-teal-700 dark:bg-teal-950/50 dark:text-teal-300"
                                          >
                                            {recipe}
                                          </span>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                </label>

                                <div className="flex shrink-0 items-center gap-1.5">
                                  <select
                                    value={item.location}
                                    onChange={(event) =>
                                      handleLocationChange({
                                        key: item.key,
                                        line: item.line,
                                        manual: item.manual,
                                        category: item.category,
                                        location: event.target.value,
                                      })
                                    }
                                    className="w-[7.5rem] rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
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
                                    <span className="text-xs text-slate-500 dark:text-slate-400">{item.amountSummary}</span>
                                  ) : item.count > 1 ? (
                                    <span className="text-xs text-slate-500 dark:text-slate-400">x{item.count}</span>
                                  ) : null}
                                  {isSaveError ? (
                                    <span className="text-xs text-rose-500">Failed to save</span>
                                  ) : isSaving ? (
                                    <span className="text-xs text-slate-400 dark:text-slate-500">Saving...</span>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSuppress({
                                        key: item.key,
                                        line: item.line,
                                        manual: item.manual,
                                        category: item.category,
                                        location: item.location,
                                        id: item.id,
                                      })
                                    }
                                    className="shrink-0 rounded-full p-2 text-rose-500 transition-colors hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-900/30"
                                    disabled={isSaving || isPending || item._optimistic}
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

              {activeLocationView.completedItems.length > 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() =>
                      setCompletedTrayExpandedByLocation((prev) => ({
                        ...prev,
                        [activeLocationView.name]: !prev[activeLocationView.name],
                      }))
                    }
                    className="flex w-full items-center justify-between px-4 py-2 text-left text-sm font-semibold text-slate-700 dark:text-slate-200"
                    aria-expanded={completedTrayExpandedByLocation[activeLocationView.name] ?? false}
                  >
                    <span>Completed ({activeLocationView.completedItems.length})</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {completedTrayExpandedByLocation[activeLocationView.name] ? "Hide" : "Show"}
                    </span>
                  </button>
                  {completedTrayExpandedByLocation[activeLocationView.name] ? (
                    <ul className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                      {activeLocationView.completedItems.map((item) => {
                        const isSaving = pendingKeys[item.key] ?? item._optimistic === true;
                        const itemLocationOptions = mergeLocationOptions(locationOptions, [item.location]);

                        return (
                          <li
                            key={`completed-${item.key}`}
                            className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm text-slate-600 dark:text-slate-300"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate line-through text-slate-400 dark:text-slate-500">{item.line}</span>
                              <select
                                value={item.location}
                                onChange={(event) =>
                                  handleLocationChange({
                                    key: item.key,
                                    line: item.line,
                                    manual: item.manual,
                                    category: item.category,
                                    location: event.target.value,
                                  })
                                }
                                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                disabled={isSaving || isPending}
                                aria-label={`Location for ${item.line}`}
                              >
                                {itemLocationOptions.map((location) => (
                                  <option key={location} value={location}>
                                    {location}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleToggle({
                                  key: item.key,
                                  line: item.line,
                                  manual: item.manual,
                                  category: item.category,
                                  location: item.location,
                                })
                              }
                              disabled={isSaving || isPending}
                              className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              Undo
                            </button>
                            {isSaving ? (
                              <span className="text-xs text-slate-400 dark:text-slate-500">Saving...</span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      )}

      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => setIsMobileManualOpen(true)}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-4 z-30 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-900/20"
          aria-haspopup="dialog"
          aria-expanded={isMobileManualOpen}
          aria-controls="mobile-manual-items-dialog"
        >
          <Plus className="h-4 w-4" />
          Add item
        </button>

        {isMobileManualOpen ? (
          <div className="fixed inset-0 z-40">
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
              onClick={() => setIsMobileManualOpen(false)}
              aria-label="Close add manual items"
            />
            <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] px-3">
              <div
                ref={mobileManualDialogRef}
                id="mobile-manual-items-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="mobile-manual-items-title"
                className="flex max-h-[calc(100dvh-env(safe-area-inset-top)-6.5rem)] flex-col rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
                tabIndex={-1}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2
                      id="mobile-manual-items-title"
                      className="text-base font-bold text-slate-900 dark:text-slate-100"
                    >
                      Add Manual Items
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Tuck in anything you forgot before checkout.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileManualOpen(false)}
                    className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    aria-label="Close add manual items"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="-mr-1 overflow-y-auto pr-1">
                  {manualSection({ mobile: true, embedded: true, inputRef: mobileManualInputRef })}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
