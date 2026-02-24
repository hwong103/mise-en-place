import Link from "next/link";

import AuthStatus from "@/components/auth/AuthStatus";
import { getCurrentAccessContext } from "@/lib/household";

export default async function HeaderAccessControls() {
  let hasHouseholdAccess = false;
  let showSettings = false;
  let accessSource: "guest" | "auth" | "bootstrap" | null = null;

  try {
    const accessContext = await getCurrentAccessContext("throw");
    hasHouseholdAccess = true;
    showSettings = accessContext.canManageLink;
    accessSource = accessContext.source;
  } catch {
    // Anonymous visitors can still access public routes.
  }

  return (
    <>
      {showSettings ? (
        <Link
          href="/settings"
          prefetch={false}
          className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-emerald-200 hover:text-emerald-700 md:inline-flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-emerald-400/30 dark:hover:text-emerald-300"
        >
          Settings
        </Link>
      ) : null}
      <AuthStatus hasHouseholdAccess={hasHouseholdAccess} accessSource={accessSource} />
    </>
  );
}
