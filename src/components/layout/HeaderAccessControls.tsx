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
          className="ui-button ui-button-secondary ui-button-pill ui-button-compact hidden md:inline-flex"
        >
          Settings
        </Link>
      ) : null}
      <AuthStatus hasHouseholdAccess={hasHouseholdAccess} accessSource={accessSource} />
    </>
  );
}
