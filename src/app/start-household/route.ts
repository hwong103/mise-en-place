import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { ensureHouseholdShareToken, setGuestSessionCookie } from "@/lib/household-access";

const DEFAULT_HOUSEHOLD_NAME = "My Household";

export async function POST(request: NextRequest) {
  const name = process.env.DEFAULT_HOUSEHOLD_NAME?.trim() || DEFAULT_HOUSEHOLD_NAME;

  const household = await prisma.household.create({
    data: { name },
    select: { id: true },
  });

  const shareToken = await ensureHouseholdShareToken(household.id);
  const response = NextResponse.redirect(new URL("/recipes", request.url), 303);

  setGuestSessionCookie(response.cookies, {
    householdId: household.id,
    shareTokenVersion: shareToken.shareTokenVersion,
    role: "manager",
  });

  console.info("[household-share] started anonymous household", {
    householdId: household.id,
  });

  return response;
}
