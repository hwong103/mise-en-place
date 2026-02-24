import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logServerPerf } from "@/lib/server-perf";

type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
};

const normalizeUserName = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const readClaimString = (claims: Record<string, unknown>, key: string) => {
  const value = claims[key];
  return typeof value === "string" ? value.trim() : "";
};

const authUserFromClaims = (claims: Record<string, unknown>) => {
  const id = readClaimString(claims, "sub");
  const email = readClaimString(claims, "email").toLowerCase();
  if (!id || !email) {
    return null;
  }

  const fullName = normalizeUserName(readClaimString(claims, "full_name"));
  const name = normalizeUserName(readClaimString(claims, "name"));

  return {
    id,
    email,
    name: fullName ?? name ?? null,
  };
};

export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  const startedAt = Date.now();
  let authSource: "claims" | "get_user" | "none" = "none";
  try {
    const supabase = await createSupabaseServerClient();
    const claimsResult = await supabase.auth.getClaims();
    if (!claimsResult.error && claimsResult.data?.claims) {
      const claimsUser = authUserFromClaims(claimsResult.data.claims as Record<string, unknown>);
      if (claimsUser) {
        authSource = "claims";
        logServerPerf({
          phase: "auth.resolve_user",
          route: "/server/auth/current-user",
          startedAt,
          success: true,
          meta: { source: authSource },
        });
        return claimsUser;
      }
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      logServerPerf({
        phase: "auth.resolve_user",
        route: "/server/auth/current-user",
        startedAt,
        success: false,
        meta: { source: authSource, reason: "missing_user" },
      });
      return null;
    }

    const email = data.user.email?.trim().toLowerCase();
    if (!email) {
      logServerPerf({
        phase: "auth.resolve_user",
        route: "/server/auth/current-user",
        startedAt,
        success: false,
        meta: { source: authSource, reason: "missing_email" },
      });
      return null;
    }

    authSource = "get_user";
    const authUser = {
      id: data.user.id,
      email,
      name:
        normalizeUserName(data.user.user_metadata?.full_name) ??
        normalizeUserName(data.user.user_metadata?.name) ??
        null,
    };

    logServerPerf({
      phase: "auth.resolve_user",
      route: "/server/auth/current-user",
      startedAt,
      success: true,
      meta: { source: authSource },
    });

    return authUser;
  } catch (error) {
    logServerPerf({
      phase: "auth.resolve_user",
      route: "/server/auth/current-user",
      startedAt,
      success: false,
      meta: {
        source: authSource,
        error: error instanceof Error ? error.message : "unknown_error",
      },
    });
    return null;
  }
}

export async function requireCurrentAuthUser(): Promise<AuthUser> {
  const user = await getCurrentAuthUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function getOrCreateAppUserId(authUser: AuthUser): Promise<string> {
  const byProviderUserId = await prisma.user.findUnique({
    where: { authProviderUserId: authUser.id },
    select: { id: true },
  });

  if (byProviderUserId) {
    return byProviderUserId.id;
  }

  const existing = await prisma.user.findUnique({
    where: { email: authUser.email },
    select: { id: true, authProviderUserId: true, name: true },
  });

  if (existing) {
    if (
      !existing.authProviderUserId ||
      (authUser.name !== null && authUser.name !== undefined && existing.name !== authUser.name)
    ) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          authProviderUserId: existing.authProviderUserId ?? authUser.id,
          ...(authUser.name !== null && authUser.name !== undefined ? { name: authUser.name } : {}),
        },
      });
    }
    return existing.id;
  }

  const created = await prisma.user.create({
    data: {
      email: authUser.email,
      authProviderUserId: authUser.id,
      name: authUser.name,
    },
    select: { id: true },
  });

  return created.id;
}
