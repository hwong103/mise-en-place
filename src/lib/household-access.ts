import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import prisma from "@/lib/prisma";

export type GuestRole = "member" | "manager";

export type GuestSession = {
  householdId: string;
  shareTokenVersion: number;
  role: GuestRole;
};

type SignedSessionPayload = GuestSession & {
  exp: number;
};

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

type MutableCookieStore = CookieReader & {
  set(name: string, value: string, options?: Record<string, unknown>): void;
};

type CookieValidationResult = {
  householdId: string;
  shareTokenVersion: number;
  guestRole: GuestRole;
  canManageLink: boolean;
  claimedByUserId: string | null;
};

const GUEST_SESSION_COOKIE = "mp_household_session";
const DEFAULT_GUEST_SESSION_DAYS = 90;
const SHARE_TOKEN_NAMESPACE = "household-share-token";
const DEV_SIGNING_SECRET = "dev-household-share-secret";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const normalizeJoinNextPath = (value?: string | null) => {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    return null;
  }

  return normalized;
};

const readGuestSessionDays = () => {
  const parsed = Number.parseInt(process.env.HOUSEHOLD_GUEST_SESSION_DAYS ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_GUEST_SESSION_DAYS;
  }
  return parsed;
};

const readSigningSecret = () => {
  const configured = process.env.HOUSEHOLD_SHARE_SIGNING_SECRET?.trim();
  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    if ((process.env.VERCEL_ENV ?? "").toLowerCase() === "production") {
      throw new Error("Missing HOUSEHOLD_SHARE_SIGNING_SECRET");
    }

    // Keep preview deployments operable while env wiring is in progress.
    return DEV_SIGNING_SECRET;
  }

  return DEV_SIGNING_SECRET;
};

const toBuffer = (value: string) => Buffer.from(value, "utf8");

const constantTimeEqual = (left: string, right: string) => {
  const leftBuffer = toBuffer(left);
  const rightBuffer = toBuffer(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
};

const signPayload = (payload: string) =>
  createHmac("sha256", readSigningSecret()).update(payload).digest("base64url");

const encodePayload = (payload: SignedSessionPayload) =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

const decodePayload = (encoded: string): SignedSessionPayload | null => {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const householdId = typeof parsed.householdId === "string" ? parsed.householdId : "";
    const shareTokenVersion =
      typeof parsed.shareTokenVersion === "number" ? parsed.shareTokenVersion : NaN;
    const role = parsed.role;
    const exp = typeof parsed.exp === "number" ? parsed.exp : NaN;

    if (
      !householdId ||
      !Number.isFinite(shareTokenVersion) ||
      !Number.isFinite(exp) ||
      !Number.isInteger(shareTokenVersion)
    ) {
      return null;
    }

    if (role !== "member" && role !== "manager") {
      return null;
    }

    return {
      householdId,
      shareTokenVersion,
      role,
      exp,
    };
  } catch {
    return null;
  }
};

const toSignedCookieValue = (payload: SignedSessionPayload) => {
  const encoded = encodePayload(payload);
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
};

const fromSignedCookieValue = (value: string): SignedSessionPayload | null => {
  const separator = value.lastIndexOf(".");
  if (separator <= 0) {
    return null;
  }

  const encoded = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expectedSignature = signPayload(encoded);

  if (!constantTimeEqual(signature, expectedSignature)) {
    return null;
  }

  return decodePayload(encoded);
};

const getCookieLifetimeSeconds = () => readGuestSessionDays() * 24 * 60 * 60;

const getCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: getCookieLifetimeSeconds(),
});

const setCookieSafely = (
  cookieStore: MutableCookieStore,
  name: string,
  value: string,
  options: Record<string, unknown>
) => {
  try {
    cookieStore.set(name, value, options);
  } catch {
    // Some read-only contexts (for example server component rendering) cannot set cookies.
  }
};

const clearCookie = (cookieStore: MutableCookieStore, name: string) => {
  setCookieSafely(cookieStore, name, "", {
    ...getCookieOptions(),
    maxAge: 0,
  });
};

const createShareToken = (householdId: string, shareTokenVersion: number) =>
  createHmac("sha256", readSigningSecret())
    .update(`${SHARE_TOKEN_NAMESPACE}:${householdId}:${shareTokenVersion}`)
    .digest("base64url");

export const hashShareToken = (token: string) => createHash("sha256").update(token).digest("hex");

const createShareTokenMaterial = (householdId: string, shareTokenVersion: number) => {
  const token = createShareToken(householdId, shareTokenVersion);
  const tokenHash = hashShareToken(token);
  return { token, tokenHash };
};

export const setGuestSessionCookie = (
  cookieStore: MutableCookieStore,
  input: GuestSession
): GuestSession => {
  const payload: SignedSessionPayload = {
    ...input,
    exp: Date.now() + getCookieLifetimeSeconds() * 1000,
  };

  setCookieSafely(cookieStore, GUEST_SESSION_COOKIE, toSignedCookieValue(payload), getCookieOptions());

  return {
    householdId: payload.householdId,
    shareTokenVersion: payload.shareTokenVersion,
    role: payload.role,
  };
};

export const clearGuestSessionCookie = (cookieStore: MutableCookieStore) => {
  clearCookie(cookieStore, GUEST_SESSION_COOKIE);
};

export const readGuestSessionCookie = (cookieStore: CookieReader): GuestSession | null => {
  const rawValue = cookieStore.get(GUEST_SESSION_COOKIE)?.value;
  if (!rawValue) {
    return null;
  }

  const payload = fromSignedCookieValue(rawValue);
  if (!payload) {
    return null;
  }

  if (payload.exp <= Date.now()) {
    return null;
  }

  return {
    householdId: payload.householdId,
    shareTokenVersion: payload.shareTokenVersion,
    role: payload.role,
  };
};

export const validateGuestSession = async (
  session: GuestSession
): Promise<CookieValidationResult | null> => {
  const household = await prisma.household.findUnique({
    where: { id: session.householdId },
    select: {
      id: true,
      shareTokenHash: true,
      shareTokenVersion: true,
      claimedByUserId: true,
    },
  });

  if (!household || !household.shareTokenHash) {
    return null;
  }

  if (session.shareTokenVersion !== household.shareTokenVersion) {
    return null;
  }

  return {
    householdId: household.id,
    shareTokenVersion: household.shareTokenVersion,
    guestRole: session.role,
    canManageLink: session.role === "manager" && household.claimedByUserId === null,
    claimedByUserId: household.claimedByUserId,
  };
};

export const ensureHouseholdShareToken = async (householdId: string) => {
  const household = await prisma.household.findUnique({
    where: { id: householdId },
    select: {
      id: true,
      shareTokenHash: true,
      shareTokenVersion: true,
    },
  });

  if (!household) {
    throw new Error("HOUSEHOLD_NOT_FOUND");
  }

  const material = createShareTokenMaterial(household.id, household.shareTokenVersion);

  if (!household.shareTokenHash || !constantTimeEqual(household.shareTokenHash, material.tokenHash)) {
    await prisma.household.update({
      where: { id: household.id },
      data: { shareTokenHash: material.tokenHash },
    });
  }

  return {
    householdId: household.id,
    shareTokenVersion: household.shareTokenVersion,
    token: material.token,
  };
};

export const rotateHouseholdShareToken = async (householdId: string) => {
  const household = await prisma.household.findUnique({
    where: { id: householdId },
    select: { id: true, shareTokenVersion: true },
  });

  if (!household) {
    throw new Error("HOUSEHOLD_NOT_FOUND");
  }

  const nextVersion = household.shareTokenVersion + 1;
  const material = createShareTokenMaterial(household.id, nextVersion);

  await prisma.household.update({
    where: { id: household.id },
    data: {
      shareTokenVersion: nextVersion,
      shareTokenHash: material.tokenHash,
    },
  });

  return {
    householdId: household.id,
    shareTokenVersion: nextVersion,
    token: material.token,
  };
};

export const resolveHouseholdFromShareToken = async (token: string) => {
  const normalized = token.trim();
  if (!/^[A-Za-z0-9_-]{24,128}$/.test(normalized)) {
    return null;
  }

  const tokenHash = hashShareToken(normalized);
  const household = await prisma.household.findUnique({
    where: { shareTokenHash: tokenHash },
    select: {
      id: true,
      shareTokenHash: true,
      shareTokenVersion: true,
    },
  });

  if (!household || !household.shareTokenHash) {
    return null;
  }

  if (!constantTimeEqual(household.shareTokenHash, tokenHash)) {
    return null;
  }

  const expectedToken = createShareToken(household.id, household.shareTokenVersion);
  if (!constantTimeEqual(normalized, expectedToken)) {
    return null;
  }

  return {
    householdId: household.id,
    shareTokenVersion: household.shareTokenVersion,
  };
};

export const claimHousehold = async (householdId: string, userId: string) => {
  return prisma.$transaction(async (tx) => {
    const household = await tx.household.findUnique({
      where: { id: householdId },
      select: { id: true, claimedByUserId: true },
    });

    if (!household) {
      throw new Error("HOUSEHOLD_NOT_FOUND");
    }

    if (household.claimedByUserId && household.claimedByUserId !== userId) {
      throw new Error("HOUSEHOLD_ALREADY_CLAIMED");
    }

    await tx.household.update({
      where: { id: household.id },
      data: {
        claimedByUserId: userId,
        claimedAt: household.claimedByUserId ? undefined : new Date(),
      },
    });

    await tx.householdMember.upsert({
      where: {
        userId_householdId: {
          userId,
          householdId: household.id,
        },
      },
      update: {
        role: "OWNER",
      },
      create: {
        userId,
        householdId: household.id,
        role: "OWNER",
      },
    });
  });
};

export const buildHouseholdJoinPath = (token: string, nextPath?: string | null) => {
  const path = `/join/${token}`;
  const normalizedNextPath = normalizeJoinNextPath(nextPath);
  if (!normalizedNextPath) {
    return path;
  }

  return `${path}?next=${encodeURIComponent(normalizedNextPath)}`;
};

export const buildHouseholdJoinUrl = (token: string, nextPath?: string | null) => {
  const path = buildHouseholdJoinPath(token, nextPath);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!siteUrl) {
    return path;
  }

  return `${trimTrailingSlash(siteUrl)}${path}`;
};

export const getCurrentHouseholdShareLink = async (householdId: string) => {
  const ensured = await ensureHouseholdShareToken(householdId);
  return {
    householdId: ensured.householdId,
    shareTokenVersion: ensured.shareTokenVersion,
    token: ensured.token,
    path: buildHouseholdJoinPath(ensured.token),
    url: buildHouseholdJoinUrl(ensured.token),
  };
};

export const rotateHouseholdShareLink = async (householdId: string) => {
  const rotated = await rotateHouseholdShareToken(householdId);
  return {
    householdId: rotated.householdId,
    shareTokenVersion: rotated.shareTokenVersion,
    token: rotated.token,
    path: buildHouseholdJoinPath(rotated.token),
    url: buildHouseholdJoinUrl(rotated.token),
  };
};
