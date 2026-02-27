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
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type PrepGroup = {
  title: string;
  items: string[];
};

type GroupItem = {
  id: string;
  value: string;
};

type Group = {
  id: string;
  title: string;
  items: GroupItem[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const uid = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const autoResize = (el: HTMLTextAreaElement) => {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

const toGroups = (prepGroups: PrepGroup[]): Group[] =>
  prepGroups.map((g) => ({
    id: uid(),
    title: g.title,
    items: g.items.map((v) => ({ id: uid(), value: v })),
  }));

/** Serialize back to the text format that parsePrepGroupsFromText understands. */
const serialize = (groups: Group[]): string =>
  groups
    .filter((g) => g.title.trim() || g.items.some((i) => i.value.trim()))
    .map(
      (g) =>
        `${g.title.trim() || "Prep"}\n${g.items
          .filter((i) => i.value.trim())
          .map((i) => `- ${i.value.trim()}`)
          .join("\n")}`
    )
    .join("\n\n");

// ─── Item row (within a group) ────────────────────────────────────────────────

type ItemRowProps = {
  id: string;
  value: string;
  focusOnMount: boolean;
  onFocusHandled: () => void;
  onUpdate: (id: string, value: string) => void;
  onDelete: (id: string) => void;
  onInsertAfter: (id: string) => void;
};

function SortableItemRow({
  id,
  value,
  focusOnMount,
  onFocusHandled,
  onUpdate,
  onDelete,
  onInsertAfter,
}: ItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (textareaRef.current) autoResize(textareaRef.current);
  }, [value]);

  useEffect(() => {
    if (!focusOnMount || !textareaRef.current) return;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(
      textareaRef.current.value.length,
      textareaRef.current.value.length
    );
    onFocusHandled();
  }, [focusOnMount, id, onFocusHandled]);

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="group flex items-start gap-3 py-1">
      <button
        type="button"
        className="mt-2 cursor-grab text-slate-400 opacity-0 transition-opacity group-hover:opacity-100"
        aria-label="Reorder item"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onInput={(e: FormEvent<HTMLTextAreaElement>) => {
          autoResize(e.currentTarget);
          onUpdate(id, e.currentTarget.value);
        }}
        onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onInsertAfter(id);
          } else if (e.key === "Backspace" && value.trim().length === 0) {
            e.preventDefault();
            onDelete(id);
          }
        }}
        className="flex-1 resize-none overflow-hidden bg-transparent text-sm leading-relaxed text-slate-700 focus:outline-none dark:text-slate-200"
      />
      <button
        type="button"
        onClick={() => onDelete(id)}
        className="mt-1.5 text-slate-400 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
        aria-label="Delete item"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Group card ───────────────────────────────────────────────────────────────

type GroupCardProps = {
  group: Group;
  focusItemId: string | null;
  onFocusHandled: () => void;
  onUpdateTitle: (groupId: string, title: string) => void;
  onUpdateItem: (groupId: string, itemId: string, value: string) => void;
  onDeleteItem: (groupId: string, itemId: string) => void;
  onInsertItemAfter: (groupId: string, itemId: string) => void;
  onAppendItem: (groupId: string, value: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onItemDragEnd: (groupId: string, event: DragEndEvent) => void;
};

function GroupCard({
  group,
  focusItemId,
  onFocusHandled,
  onUpdateTitle,
  onUpdateItem,
  onDeleteItem,
  onInsertItemAfter,
  onAppendItem,
  onDeleteGroup,
  onItemDragEnd,
}: GroupCardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [newItem, setNewItem] = useState("");
  const newInputRef = useRef<HTMLInputElement | null>(null);
  const itemIds = useMemo(() => group.items.map((i) => i.id), [group.items]);

  const appendNewItem = useCallback(() => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    onAppendItem(group.id, trimmed);
    setNewItem("");
    newInputRef.current?.focus();
  }, [newItem, group.id, onAppendItem]);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
      {/* Header row */}
      <div className="group flex items-center gap-2 pb-2">
        <input
          type="text"
          value={group.title}
          onChange={(e) => onUpdateTitle(group.id, e.target.value)}
          placeholder="Group name"
          className="flex-1 bg-transparent text-xs font-semibold uppercase tracking-widest text-slate-500 placeholder-slate-300 focus:outline-none dark:text-slate-400 dark:placeholder-slate-600"
        />
        <button
          type="button"
          onClick={() => onDeleteGroup(group.id)}
          className="text-slate-300 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100 dark:text-slate-600"
          aria-label={`Delete group ${group.title}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Items */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(e) => onItemDragEnd(group.id, e)}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <SortableItemRow
                key={item.id}
                id={item.id}
                value={item.value}
                focusOnMount={focusItemId === item.id}
                onFocusHandled={onFocusHandled}
                onUpdate={(itemId, value) => onUpdateItem(group.id, itemId, value)}
                onDelete={(itemId) => onDeleteItem(group.id, itemId)}
                onInsertAfter={(itemId) => onInsertItemAfter(group.id, itemId)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add item input */}
      <div className="mt-2 flex items-center gap-2 border-t border-slate-200 pt-2 dark:border-slate-700/60">
        <input
          ref={newInputRef}
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onBlur={appendNewItem}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              appendNewItem();
            }
          }}
          placeholder="Add item..."
          className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <button
          type="button"
          onClick={appendNewItem}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          + Add
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type PrepGroupEditorProps = {
  name: string;
  initialGroups: PrepGroup[];
};

export default function PrepGroupEditor({ name, initialGroups }: PrepGroupEditorProps) {
  const [groups, setGroups] = useState<Group[]>(() => toGroups(initialGroups));
  const [focusItemId, setFocusItemId] = useState<string | null>(null);

  const groupSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const serializedValue = useMemo(() => serialize(groups), [groups]);
  const groupIds = useMemo(() => groups.map((g) => g.id), [groups]);

  // ── Group-level mutations ────────────────────────────────────────────────

  const updateTitle = useCallback((groupId: string, title: string) => {
    setGroups((gs) => gs.map((g) => (g.id === groupId ? { ...g, title } : g)));
  }, []);

  const deleteGroup = useCallback((groupId: string) => {
    setGroups((gs) => gs.filter((g) => g.id !== groupId));
  }, []);

  const addGroup = useCallback(() => {
    setGroups((gs) => [...gs, { id: uid(), title: "", items: [] }]);
  }, []);

  const handleGroupDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setGroups((gs) => {
      const oldIndex = gs.findIndex((g) => g.id === active.id);
      const newIndex = gs.findIndex((g) => g.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return gs;
      return arrayMove(gs, oldIndex, newIndex);
    });
  }, []);

  // ── Item-level mutations ─────────────────────────────────────────────────

  const updateItem = useCallback((groupId: string, itemId: string, value: string) => {
    setGroups((gs) =>
      gs.map((g) =>
        g.id === groupId
          ? { ...g, items: g.items.map((i) => (i.id === itemId ? { ...i, value } : i)) }
          : g
      )
    );
  }, []);

  const deleteItem = useCallback((groupId: string, itemId: string) => {
    setGroups((gs) =>
      gs.map((g) => {
        if (g.id !== groupId) return g;
        const index = g.items.findIndex((i) => i.id === itemId);
        if (index === -1) return g;
        const next = g.items.filter((i) => i.id !== itemId);
        if (next.length > 0) {
          setFocusItemId(next[Math.max(0, index - 1)].id);
        }
        return { ...g, items: next };
      })
    );
  }, []);

  const insertItemAfter = useCallback((groupId: string, afterItemId: string) => {
    setGroups((gs) =>
      gs.map((g) => {
        if (g.id !== groupId) return g;
        const newId = uid();
        setFocusItemId(newId);
        const index = g.items.findIndex((i) => i.id === afterItemId);
        const next = [...g.items];
        // If not found (e.g. empty group), append at end.
        next.splice(index === -1 ? next.length : index + 1, 0, { id: newId, value: "" });
        return { ...g, items: next };
      })
    );
  }, []);

  const appendItem = useCallback((groupId: string, value: string) => {
    setGroups((gs) =>
      gs.map((g) => {
        if (g.id !== groupId) return g;
        const newId = uid();
        setFocusItemId(newId);
        return { ...g, items: [...g.items, { id: newId, value }] };
      })
    );
  }, []);

  const handleItemDragEnd = useCallback((groupId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setGroups((gs) =>
      gs.map((g) => {
        if (g.id !== groupId) return g;
        const oldIndex = g.items.findIndex((i) => i.id === active.id);
        const newIndex = g.items.findIndex((i) => i.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return g;
        return { ...g, items: arrayMove(g.items, oldIndex, newIndex) };
      })
    );
  }, []);

  return (
    <div className="mt-4 space-y-3">
      <input type="hidden" name={name} value={serializedValue} />

      {/* Draggable group cards */}
      <DndContext
        sensors={groupSensors}
        collisionDetection={closestCenter}
        onDragEnd={handleGroupDragEnd}
      >
        <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {groups.map((group) => (
              <SortableGroupCard
                key={group.id}
                group={group}
                focusItemId={focusItemId}
                onFocusHandled={() => setFocusItemId(null)}
                onUpdateTitle={updateTitle}
                onUpdateItem={updateItem}
                onDeleteItem={deleteItem}
                onInsertItemAfter={insertItemAfter}
                onAppendItem={appendItem}
                onDeleteGroup={deleteGroup}
                onItemDragEnd={handleItemDragEnd}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={addGroup}
        className="w-full rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-500 hover:border-emerald-400 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
      >
        + Add group
      </button>
    </div>
  );
}

// ─── Sortable wrapper for GroupCard ──────────────────────────────────────────

function SortableGroupCard(props: GroupCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: props.group.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="group/card relative">
      {/* Drag handle for the whole group card */}
      <button
        type="button"
        className="absolute -left-5 top-3 cursor-grab text-slate-300 opacity-0 transition-opacity group-hover/card:opacity-100 dark:text-slate-600"
        aria-label={`Reorder group ${props.group.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <GroupCard {...props} />
    </div>
  );
}
