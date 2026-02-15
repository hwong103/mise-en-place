import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
};

const normalizeUserName = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return null;
  }

  const email = data.user.email?.trim().toLowerCase();
  if (!email) {
    return null;
  }

  return {
    id: data.user.id,
    email,
    name:
      normalizeUserName(data.user.user_metadata?.full_name) ??
      normalizeUserName(data.user.user_metadata?.name) ??
      null,
  };
}

export async function requireCurrentAuthUser(): Promise<AuthUser> {
  const user = await getCurrentAuthUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function getOrCreateAppUserId(authUser: AuthUser): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { email: authUser.email },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.user.create({
    data: {
      email: authUser.email,
      name: authUser.name,
    },
    select: { id: true },
  });

  return created.id;
}
