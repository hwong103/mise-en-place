import { cache } from "react";
import { headers } from "next/headers";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/better-auth";
import { logServerPerf } from "@/lib/server-perf";

export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
};

const normalizeUserName = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const toAuthUser = (session: unknown): AuthUser | null => {
  const candidate = session as
    | {
        user?: {
          id?: unknown;
          email?: unknown;
          name?: unknown;
          image?: unknown;
        };
      }
    | null
    | undefined;
  const user = candidate?.user;

  const id = typeof user?.id === "string" ? user.id.trim() : "";
  const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";

  if (!id || !email) {
    return null;
  }

  return {
    id,
    email,
    name: normalizeUserName(typeof user?.name === "string" ? user.name : null),
    image: typeof user?.image === "string" ? user.image : null,
  };
};

const resolveCurrentAuthUser = cache(async (): Promise<AuthUser | null> => {
  const startedAt = Date.now();
  try {
    const headerStore = await headers();
    const session = await auth.api.getSession({
      headers: new Headers(headerStore),
    });
    const authUser = toAuthUser(session);

    logServerPerf({
      phase: "auth.resolve_user",
      route: "/server/auth/current-user",
      startedAt,
      success: Boolean(authUser),
      meta: {
        source: "better_auth_session",
      },
    });

    return authUser;
  } catch (error) {
    logServerPerf({
      phase: "auth.resolve_user",
      route: "/server/auth/current-user",
      startedAt,
      success: false,
      meta: {
        source: "better_auth_session",
        error: error instanceof Error ? error.message : "unknown_error",
      },
    });
    return null;
  }
});

export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  return resolveCurrentAuthUser();
}

export async function requireCurrentAuthUser(): Promise<AuthUser> {
  const user = await getCurrentAuthUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function getOrCreateAppUserId(authUser: AuthUser): Promise<string> {
  const byBetterAuthUserId = await prisma.user.findUnique({
    where: { betterAuthUserId: authUser.id },
    select: { id: true },
  });

  if (byBetterAuthUserId) {
    return byBetterAuthUserId.id;
  }

  const existing = await prisma.user.findUnique({
    where: { email: authUser.email },
    select: {
      id: true,
      betterAuthUserId: true,
      authProviderUserId: true,
      name: true,
      avatarUrl: true,
    },
  });

  if (existing) {
    const shouldUpdateName =
      authUser.name !== null && authUser.name !== undefined && existing.name !== authUser.name;
    const shouldUpdateAvatar = authUser.image !== null && authUser.image !== undefined && existing.avatarUrl !== authUser.image;

    if (!existing.betterAuthUserId || shouldUpdateName || shouldUpdateAvatar) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          betterAuthUserId: existing.betterAuthUserId ?? authUser.id,
          ...(shouldUpdateName ? { name: authUser.name } : {}),
          ...(shouldUpdateAvatar ? { avatarUrl: authUser.image } : {}),
        },
      });
    }

    return existing.id;
  }

  const created = await prisma.user.create({
    data: {
      email: authUser.email,
      authProviderUserId: authUser.id,
      betterAuthUserId: authUser.id,
      name: authUser.name,
      avatarUrl: authUser.image,
    },
    select: { id: true },
  });

  return created.id;
}
