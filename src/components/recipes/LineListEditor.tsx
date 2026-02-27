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
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

export const HEADER_PREFIX = "## ";

type LineListEditorProps = {
  name: string;
  initialItems: string[];
  ordered?: boolean;
  placeholder?: string;
  addLabel?: string;
  allowHeaders?: boolean;
};

type Item = {
  id: string;
  value: string;
};

const createInitialItems = (initialItems: string[]) =>
  initialItems.map((value, index) => ({ id: `item-${index}`, value }));

const nextItemId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const autoResize = (element: HTMLTextAreaElement) => {
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
};

type RowProps = {
  id: string;
  value: string;
  index: number;
  ordered: boolean;
  focusOnMount: boolean;
  onFocusHandled: () => void;
  onUpdate: (id: string, value: string) => void;
  onDelete: (id: string) => void;
  onInsertAfter: (id: string) => void;
};

function SortableRow({
  id,
  value,
  index,
  ordered,
  focusOnMount,
  onFocusHandled,
  onUpdate,
  onDelete,
  onInsertAfter,
}: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isHeader = value.startsWith(HEADER_PREFIX);
  const displayValue = isHeader ? value.slice(HEADER_PREFIX.length) : value;

  useEffect(() => {
    if (!textareaRef.current) {
      return;
    }
    autoResize(textareaRef.current);
  }, [value]);

  useEffect(() => {
    if (!focusOnMount || !textareaRef.current) {
      return;
    }
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
    onFocusHandled();
  }, [focusOnMount, id, onFocusHandled]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleInput = (event: FormEvent<HTMLTextAreaElement>) => {
    const element = event.currentTarget;
    autoResize(element);
    // Preserve the header prefix in the stored value
    onUpdate(id, isHeader ? `${HEADER_PREFIX}${element.value}` : element.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onInsertAfter(id);
      return;
    }

    if (event.key === "Backspace" && value.trim().length === 0) {
      event.preventDefault();
      onDelete(id);
    }

    // When backspace clears a header to just "## ", treat it as empty and delete
    if (event.key === "Backspace" && isHeader && displayValue.trim().length === 0) {
      event.preventDefault();
      onDelete(id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-3 ${isHeader ? "pb-0.5 pt-2" : "py-1"}`}
    >
      <button
        type="button"
        className="mt-2 cursor-grab text-slate-400 opacity-0 transition-opacity group-hover:opacity-100"
        aria-label={`Reorder item ${index + 1}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {isHeader ? (
        <span className="mt-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          §
        </span>
      ) : ordered ? (
        <span className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          {index + 1}.
        </span>
      ) : (
        <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
      )}
      <textarea
        ref={textareaRef}
        rows={1}
        value={displayValue}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className={`flex-1 resize-none overflow-hidden bg-transparent leading-relaxed focus:outline-none ${
          isHeader
            ? "text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400"
            : "text-sm text-slate-700 dark:text-slate-200"
        }`}
      />
      <button
        type="button"
        onClick={() => onDelete(id)}
        className="mt-1.5 text-slate-400 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
        aria-label={`Delete item ${index + 1}`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function LineListEditor({
  name,
  initialItems,
  ordered = false,
  placeholder = "Add item...",
  addLabel = "+ Add item",
  allowHeaders = false,
}: LineListEditorProps) {
  const [items, setItems] = useState<Item[]>(() => createInitialItems(initialItems));
  const [newItem, setNewItem] = useState("");
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
  const newInputRef = useRef<HTMLInputElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
  const serializedValue = useMemo(() => items.map((item) => item.value).join("\n"), [items]);

  const updateItem = useCallback((id: string, value: string) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, value } : item)));
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id);
      if (index === -1) {
        return current;
      }
      const next = current.filter((item) => item.id !== id);
      if (next.length === 0) {
        newInputRef.current?.focus();
        return next;
      }
      const focusIndex = Math.max(0, index - 1);
      setFocusItemId(next[focusIndex].id);
      return next;
    });
  }, []);

  const insertAfter = useCallback((id: string) => {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id);
      if (index === -1) {
        return current;
      }
      const nextId = nextItemId();
      const next = [...current];
      next.splice(index + 1, 0, { id: nextId, value: "" });
      setFocusItemId(nextId);
      return next;
    });
  }, []);

  const appendNewItem = useCallback(() => {
    const trimmed = newItem.trim();
    if (!trimmed) {
      return;
    }
    setItems((current) => [...current, { id: nextItemId(), value: trimmed }]);
    setNewItem("");
    newInputRef.current?.focus();
  }, [newItem]);

  const appendHeader = useCallback(() => {
    const newId = nextItemId();
    setItems((current) => [...current, { id: newId, value: HEADER_PREFIX }]);
    setFocusItemId(newId);
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    setItems((current) => {
      const oldIndex = current.findIndex((item) => item.id === active.id);
      const newIndex = current.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) {
        return current;
      }
      return arrayMove(current, oldIndex, newIndex);
    });
  };

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950/70">
      <input type="hidden" name={name} value={serializedValue} />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {items.map((item, index) => (
              <SortableRow
                key={item.id}
                id={item.id}
                value={item.value}
                index={index}
                ordered={ordered}
                focusOnMount={focusItemId === item.id}
                onFocusHandled={() => setFocusItemId(null)}
                onUpdate={updateItem}
                onDelete={deleteItem}
                onInsertAfter={insertAfter}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
        <input
          ref={newInputRef}
          type="text"
          value={newItem}
          onChange={(event) => setNewItem(event.target.value)}
          onBlur={appendNewItem}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              appendNewItem();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <button
          type="button"
          onClick={appendNewItem}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          {addLabel}
        </button>
        {allowHeaders ? (
          <button
            type="button"
            onClick={appendHeader}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
            title="Add a section header"
          >
            + Header
          </button>
        ) : null}
      </div>
    </div>
  );
}
