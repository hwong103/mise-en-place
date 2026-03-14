"use client";

import { useSearchParams } from "next/navigation";

export default function HomeJoinStatus() {
  const searchParams = useSearchParams();
  const joinStatus = searchParams.get("join");

  if (joinStatus !== "invalid") {
    return null;
  }

  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      That household invite link is invalid or expired. Ask the household manager for a new link.
    </div>
  );
}
