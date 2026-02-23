import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { getBootstrapHouseholdId } from "@/lib/household";
import { ensureHouseholdShareToken, setGuestSessionCookie } from "@/lib/household-access";

const DEFAULT_HOUSEHOLD_NAME = "My Household";
const isServerAuthBypassed = () => /^(1|true|yes)$/i.test(process.env.DISABLE_AUTH ?? "");

export async function POST(request: NextRequest) {
  if (isServerAuthBypassed()) {
    await getBootstrapHouseholdId();
    return NextResponse.redirect(new URL("/recipes", request.url), 303);
  }

  const name = process.env.DEFAULT_HOUSEHOLD_NAME?.trim() || DEFAULT_HOUSEHOLD_NAME;

  try {
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
  } catch (error) {
    console.error("[household-share] failed to start household", {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.redirect(new URL("/login?start=error", request.url), 303);
  }
}
