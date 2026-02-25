import { NextRequest, NextResponse } from "next/server";

import {
  clearGuestSessionCookie,
  resolveHouseholdFromShareToken,
  setGuestSessionCookie,
} from "@/lib/household-access";

const DEFAULT_JOIN_REDIRECT = "/recipes";

const resolveJoinRedirectPath = (value: string | null) => {
  const normalized = value?.trim();
  if (!normalized) {
    return DEFAULT_JOIN_REDIRECT;
  }

  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    return DEFAULT_JOIN_REDIRECT;
  }

  return normalized;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const resolved = await params;
  const result = await resolveHouseholdFromShareToken(resolved.token ?? "");

  if (!result) {
    const invalidResponse = NextResponse.redirect(new URL("/?join=invalid", request.url), 302);
    clearGuestSessionCookie(invalidResponse.cookies);
    console.warn("[household-share] join failed", {
      reason: "invalid_token",
    });
    return invalidResponse;
  }

  const redirectPath = resolveJoinRedirectPath(request.nextUrl.searchParams.get("next"));
  const response = NextResponse.redirect(new URL(redirectPath, request.url), 302);
  setGuestSessionCookie(response.cookies, {
    householdId: result.householdId,
    shareTokenVersion: result.shareTokenVersion,
    role: "member",
  });

  console.info("[household-share] join success", {
    householdId: result.householdId,
  });

  return response;
}
