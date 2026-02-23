import { NextRequest, NextResponse } from "next/server";

import {
  clearGuestSessionCookie,
  resolveHouseholdFromShareToken,
  setGuestSessionCookie,
} from "@/lib/household-access";

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

  const response = NextResponse.redirect(new URL("/recipes", request.url), 302);
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
