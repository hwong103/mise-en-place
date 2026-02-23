import prisma from "@/lib/prisma";
import { getCurrentAuthUser, getOrCreateAppUserId } from "@/lib/auth";
import {
  clearGuestSessionCookie,
  readGuestSessionCookie,
  setGuestSessionCookie,
  validateGuestSession,
} from "@/lib/household-access";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const DEFAULT_HOUSEHOLD_NAME = "My Household";
const isServerAuthDisabled = () => /^(1|true|yes)$/i.test(process.env.DISABLE_AUTH ?? "");
const isPreviewPublicAuthDisabled = () =>
  (process.env.VERCEL_ENV ?? "").toLowerCase() === "preview" &&
  /^(1|true|yes)$/i.test(process.env.NEXT_PUBLIC_DISABLE_AUTH ?? "");
const isAuthDisabled = () => isServerAuthDisabled() || isPreviewPublicAuthDisabled();

export const ensureDefaultHouseholdForUser = async (userId: string) => {
  const existingMembership = await prisma.householdMember.findFirst({
    where: { userId },
    select: { householdId: true },
    orderBy: { joinedAt: "asc" },
  });

  if (existingMembership) {
    return existingMembership.householdId;
  }

  const name = process.env.DEFAULT_HOUSEHOLD_NAME?.trim() || DEFAULT_HOUSEHOLD_NAME;
  const created = await prisma.$transaction(async (tx) => {
    const household = await tx.household.create({
      data: { name },
      select: { id: true },
    });

    await tx.householdMember.create({
      data: {
        userId,
        householdId: household.id,
        role: "OWNER",
      },
    });

    return household;
  });

  return created.id;
};

type UnauthenticatedBehavior = "redirect" | "throw";

export type AccessActorType =
  | "authenticated_manager"
  | "authenticated_member"
  | "guest_manager"
  | "guest_member"
  | "debug_manager";

export type AccessSource = "auth" | "guest" | "bootstrap";

export type AccessContext = {
  householdId: string;
  actorType: AccessActorType;
  canManageLink: boolean;
  source: AccessSource;
  shareTokenVersion: number;
};

const resolveGuestAccessContext = async (): Promise<AccessContext | null> => {
  const cookieStore = await cookies();
  try {
    const guestSession = readGuestSessionCookie(cookieStore);
    if (!guestSession) {
      return null;
    }

    const validated = await validateGuestSession(guestSession);
    if (!validated) {
      clearGuestSessionCookie(cookieStore);
      return null;
    }

    setGuestSessionCookie(cookieStore, guestSession);

    return {
      householdId: validated.householdId,
      actorType: validated.guestRole === "manager" ? "guest_manager" : "guest_member",
      canManageLink: validated.canManageLink,
      source: "guest",
      shareTokenVersion: validated.shareTokenVersion,
    };
  } catch (error) {
    console.warn("[household-share] failed to resolve guest session; clearing cookie", {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    clearGuestSessionCookie(cookieStore);
    return null;
  }
};

const resolveAuthenticatedAccessContext = async (): Promise<AccessContext | null> => {
  const authUser = await getCurrentAuthUser();
  if (!authUser) {
    return null;
  }

  const appUserId = await getOrCreateAppUserId(authUser);
  const membership = await prisma.householdMember.findFirst({
    where: { userId: appUserId },
    select: {
      householdId: true,
      role: true,
      household: {
        select: {
          shareTokenVersion: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  if (membership) {
    const canManageLink = membership.role === "OWNER" || membership.role === "ADMIN";
    return {
      householdId: membership.householdId,
      actorType: canManageLink ? "authenticated_manager" : "authenticated_member",
      canManageLink,
      source: "auth",
      shareTokenVersion: membership.household.shareTokenVersion,
    };
  }

  const householdId = await ensureDefaultHouseholdForUser(appUserId);
  const household = await prisma.household.findUnique({
    where: { id: householdId },
    select: { shareTokenVersion: true },
  });

  return {
    householdId,
    actorType: "authenticated_manager",
    canManageLink: true,
    source: "auth",
    shareTokenVersion: household?.shareTokenVersion ?? 1,
  };
};

export const getCurrentAccessContext = async (
  unauthenticatedBehavior: UnauthenticatedBehavior = "redirect"
): Promise<AccessContext> => {
  const guestContext = await resolveGuestAccessContext();
  if (guestContext) {
    return guestContext;
  }

  if (isAuthDisabled()) {
    return {
      householdId: await getBootstrapHouseholdId(),
      actorType: "debug_manager",
      canManageLink: true,
      source: "bootstrap",
      shareTokenVersion: 0,
    };
  }

  const authContext = await resolveAuthenticatedAccessContext();
  if (authContext) {
    return authContext;
  }

  if (unauthenticatedBehavior === "redirect") {
    redirect("/login");
  }

  throw new Error("UNAUTHORIZED");
};

export const getCurrentHouseholdId = async (
  unauthenticatedBehavior: UnauthenticatedBehavior = "redirect"
) => {
  const accessContext = await getCurrentAccessContext(unauthenticatedBehavior);
  return accessContext.householdId;
};

// Kept only for local/dev bootstrap scripts; do not use this in request authorization paths.
export const getBootstrapHouseholdId = async () => {
  const existing = await prisma.household.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existing) {
    return existing.id;
  }

  const name = process.env.DEFAULT_HOUSEHOLD_NAME?.trim() || DEFAULT_HOUSEHOLD_NAME;
  const created = await prisma.household.create({
    data: { name },
    select: { id: true },
  });
  return created.id;
};
