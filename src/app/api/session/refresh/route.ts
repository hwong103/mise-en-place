import { NextRequest, NextResponse } from "next/server";

import {
  clearGuestSessionCookie,
  readGuestSessionCookie,
  setGuestSessionCookie,
  validateGuestSession,
} from "@/lib/household-access";

export async function POST(request: NextRequest) {
  const session = readGuestSessionCookie(request.cookies);
  const response = new NextResponse(null, { status: 204 });

  if (!session) {
    return response;
  }

  const validated = await validateGuestSession(session);
  if (!validated) {
    clearGuestSessionCookie(response.cookies);
    return response;
  }

  setGuestSessionCookie(response.cookies, {
    householdId: validated.householdId,
    shareTokenVersion: validated.shareTokenVersion,
    role: session.role,
  });

  return response;
}
