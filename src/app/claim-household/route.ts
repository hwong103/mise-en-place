import { NextRequest, NextResponse } from "next/server";

import { getCurrentAuthUser, getOrCreateAppUserId } from "@/lib/auth";
import { getCurrentAccessContext } from "@/lib/household";
import { claimHousehold, setGuestSessionCookie } from "@/lib/household-access";

export async function GET(request: NextRequest) {
  let accessContext;
  try {
    accessContext = await getCurrentAccessContext("throw");
  } catch {
    return NextResponse.redirect(new URL("/login?next=/claim-household", request.url), 302);
  }

  if (accessContext.source !== "guest") {
    return NextResponse.redirect(new URL("/settings", request.url), 302);
  }

  if (!accessContext.canManageLink) {
    return NextResponse.redirect(new URL("/settings?claim=forbidden", request.url), 302);
  }

  const authUser = await getCurrentAuthUser();
  if (!authUser) {
    return NextResponse.redirect(new URL("/login?next=/claim-household", request.url), 302);
  }

  const userId = await getOrCreateAppUserId(authUser);

  try {
    await claimHousehold(accessContext.householdId, userId);
  } catch (error) {
    if (error instanceof Error && error.message === "HOUSEHOLD_ALREADY_CLAIMED") {
      return NextResponse.redirect(new URL("/settings?claim=conflict", request.url), 302);
    }
    throw error;
  }

  const response = NextResponse.redirect(new URL("/settings?claimed=1", request.url), 302);
  setGuestSessionCookie(response.cookies, {
    householdId: accessContext.householdId,
    shareTokenVersion: accessContext.shareTokenVersion,
    role: "member",
  });

  return response;
}
