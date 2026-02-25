"use client";

import { useEffect, useState } from "react";

export default function UnsavedBadge({ formId }: { formId: string }) {
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!form) {
      return;
    }

    const handleInput = () => setDirty(true);
    form.addEventListener("input", handleInput);
    form.addEventListener("change", handleInput);

    return () => {
      form.removeEventListener("input", handleInput);
      form.removeEventListener("change", handleInput);
    };
  }, [formId]);

  if (!dirty) {
    return null;
  }

  return (
    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Unsaved changes</span>
  );
}
