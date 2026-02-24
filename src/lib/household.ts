import prisma from "@/lib/prisma";
import { getCurrentAuthUser, getOrCreateAppUserId } from "@/lib/auth";
import {
  clearGuestSessionCookie,
  readGuestSessionCookie,
  setGuestSessionCookie,
  validateGuestSession,
} from "@/lib/household-access";
import { logServerPerf } from "@/lib/server-perf";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

const DEFAULT_HOUSEHOLD_NAME = "My Household";
const BOOTSTRAP_CACHE_TTL_MS = 5 * 60 * 1000;
const isServerAuthDisabled = () => /^(1|true|yes)$/i.test(process.env.DISABLE_AUTH ?? "");
const isPreviewPublicAuthDisabled = () =>
  (process.env.VERCEL_ENV ?? "").toLowerCase() === "preview" &&
  /^(1|true|yes)$/i.test(process.env.NEXT_PUBLIC_DISABLE_AUTH ?? "");
const isAuthDisabled = () => isServerAuthDisabled() || isPreviewPublicAuthDisabled();

let cachedBootstrapHouseholdId: string | null = null;
let cachedBootstrapHouseholdIdAt = 0;

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
  const startedAt = Date.now();
  const cookieStore = await cookies();
  try {
    const guestSession = readGuestSessionCookie(cookieStore);
    if (!guestSession) {
      logServerPerf({
        phase: "household.resolve_guest_context",
        route: "/server/household/guest-context",
        startedAt,
        success: true,
        meta: { has_guest_session: false },
      });
      return null;
    }

    const validateStartedAt = Date.now();
    const validated = await validateGuestSession(guestSession);
    const validateMs = Date.now() - validateStartedAt;
    if (!validated) {
      clearGuestSessionCookie(cookieStore);
      logServerPerf({
        phase: "household.resolve_guest_context",
        route: "/server/household/guest-context",
        startedAt,
        success: false,
        meta: { has_guest_session: true, validate_ms: validateMs, reason: "invalid_session" },
      });
      return null;
    }

    setGuestSessionCookie(cookieStore, guestSession);

    logServerPerf({
      phase: "household.resolve_guest_context",
      route: "/server/household/guest-context",
      startedAt,
      householdId: validated.householdId,
      success: true,
      meta: {
        has_guest_session: true,
        validate_ms: validateMs,
        role: validated.guestRole,
      },
    });

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
    logServerPerf({
      phase: "household.resolve_guest_context",
      route: "/server/household/guest-context",
      startedAt,
      success: false,
      meta: { error: error instanceof Error ? error.message : "unknown_error" },
    });
    return null;
  }
};

const resolveAuthenticatedAccessContext = async (): Promise<AccessContext | null> => {
  const startedAt = Date.now();
  const authResolveStartedAt = Date.now();
  const authUser = await getCurrentAuthUser();
  const authResolveMs = Date.now() - authResolveStartedAt;
  if (!authUser) {
    logServerPerf({
      phase: "household.resolve_authenticated_context",
      route: "/server/household/auth-context",
      startedAt,
      success: true,
      meta: { has_auth_user: false, auth_resolve_ms: authResolveMs },
    });
    return null;
  }

  const appUserIdResolveStartedAt = Date.now();
  const appUserId = await getOrCreateAppUserId(authUser);
  const appUserIdResolveMs = Date.now() - appUserIdResolveStartedAt;

  const membershipReadStartedAt = Date.now();
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
  const membershipReadMs = Date.now() - membershipReadStartedAt;

  if (membership) {
    const canManageLink = membership.role === "OWNER" || membership.role === "ADMIN";
    logServerPerf({
      phase: "household.resolve_authenticated_context",
      route: "/server/household/auth-context",
      startedAt,
      householdId: membership.householdId,
      success: true,
      meta: {
        has_auth_user: true,
        auth_resolve_ms: authResolveMs,
        app_user_id_resolve_ms: appUserIdResolveMs,
        membership_read_ms: membershipReadMs,
        membership_found: true,
      },
    });
    return {
      householdId: membership.householdId,
      actorType: canManageLink ? "authenticated_manager" : "authenticated_member",
      canManageLink,
      source: "auth",
      shareTokenVersion: membership.household.shareTokenVersion,
    };
  }

  const defaultHouseholdResolveStartedAt = Date.now();
  const householdId = await ensureDefaultHouseholdForUser(appUserId);
  const defaultHouseholdResolveMs = Date.now() - defaultHouseholdResolveStartedAt;
  const householdReadStartedAt = Date.now();
  const household = await prisma.household.findUnique({
    where: { id: householdId },
    select: { shareTokenVersion: true },
  });
  const householdReadMs = Date.now() - householdReadStartedAt;

  logServerPerf({
    phase: "household.resolve_authenticated_context",
    route: "/server/household/auth-context",
    startedAt,
    householdId,
    success: true,
    meta: {
      has_auth_user: true,
      auth_resolve_ms: authResolveMs,
      app_user_id_resolve_ms: appUserIdResolveMs,
      membership_read_ms: membershipReadMs,
      membership_found: false,
      default_household_resolve_ms: defaultHouseholdResolveMs,
      household_read_ms: householdReadMs,
    },
  });

  return {
    householdId,
    actorType: "authenticated_manager",
    canManageLink: true,
    source: "auth",
    shareTokenVersion: household?.shareTokenVersion ?? 1,
  };
};

const resolveCurrentAccessContext = cache(async (): Promise<AccessContext | null> => {
  const startedAt = Date.now();
  try {
    const guestContext = await resolveGuestAccessContext();
    if (guestContext) {
      logServerPerf({
        phase: "household.resolve_access_context",
        route: "/server/household/access-context",
        startedAt,
        householdId: guestContext.householdId,
        success: true,
        meta: { source: guestContext.source, actor: guestContext.actorType },
      });
      return guestContext;
    }

    if (isAuthDisabled()) {
      const context = {
        householdId: await getBootstrapHouseholdId(),
        actorType: "debug_manager" as const,
        canManageLink: true,
        source: "bootstrap" as const,
        shareTokenVersion: 0,
      };
      logServerPerf({
        phase: "household.resolve_access_context",
        route: "/server/household/access-context",
        startedAt,
        householdId: context.householdId,
        success: true,
        meta: { source: context.source, actor: context.actorType },
      });
      return context;
    }

    const authContext = await resolveAuthenticatedAccessContext();
    if (authContext) {
      logServerPerf({
        phase: "household.resolve_access_context",
        route: "/server/household/access-context",
        startedAt,
        householdId: authContext.householdId,
        success: true,
        meta: { source: authContext.source, actor: authContext.actorType },
      });
      return authContext;
    }
    logServerPerf({
      phase: "household.resolve_access_context",
      route: "/server/household/access-context",
      startedAt,
      success: false,
      meta: { reason: "unauthorized" },
    });
    return null;
  } catch (error) {
    logServerPerf({
      phase: "household.resolve_access_context",
      route: "/server/household/access-context",
      startedAt,
      success: false,
      meta: { error: error instanceof Error ? error.message : "unknown_error" },
    });
    throw error;
  }
});

export const getCurrentAccessContext = async (
  unauthenticatedBehavior: UnauthenticatedBehavior = "redirect"
): Promise<AccessContext> => {
  const context = await resolveCurrentAccessContext();
  if (context) {
    return context;
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
  const now = Date.now();
  if (
    cachedBootstrapHouseholdId &&
    now - cachedBootstrapHouseholdIdAt < BOOTSTRAP_CACHE_TTL_MS
  ) {
    return cachedBootstrapHouseholdId;
  }

  const existing = await prisma.household.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existing) {
    cachedBootstrapHouseholdId = existing.id;
    cachedBootstrapHouseholdIdAt = now;
    return existing.id;
  }

  const name = process.env.DEFAULT_HOUSEHOLD_NAME?.trim() || DEFAULT_HOUSEHOLD_NAME;
  const created = await prisma.household.create({
    data: { name },
    select: { id: true },
  });
  cachedBootstrapHouseholdId = created.id;
  cachedBootstrapHouseholdIdAt = now;
  return created.id;
};
