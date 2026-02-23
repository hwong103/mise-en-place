import { NextResponse } from "next/server";

import { clearGuestSessionCookie } from "@/lib/household-access";

export async function POST() {
  const response = new NextResponse(null, { status: 204 });
  clearGuestSessionCookie(response.cookies);
  return response;
}
