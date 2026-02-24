"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import SubmitButton from "@/components/forms/SubmitButton";

type HouseholdNameEditorProps = {
  initialName: string;
  canEdit: boolean;
  action: (formData: FormData) => void | Promise<void>;
};

export default function HouseholdNameEditor({ initialName, canEdit, action }: HouseholdNameEditorProps) {
  const [editing, setEditing] = useState(false);

  if (!canEdit) {
    return <span>{initialName}</span>;
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span>{initialName}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Edit household name"
          title="Edit household name"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        name="name"
        defaultValue={initialName}
        required
        minLength={1}
        maxLength={80}
        className="w-full min-w-56 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 md:w-auto"
      />
      <SubmitButton
        label="Save"
        pendingLabel="Saving..."
        className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
      />
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
      >
        Cancel
      </button>
    </form>
  );
}
