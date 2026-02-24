import Link from "next/link";

import prisma from "@/lib/prisma";
import { getCurrentAuthUser } from "@/lib/auth";
import { getCurrentAccessContext } from "@/lib/household";
import { getCurrentHouseholdShareLink } from "@/lib/household-access";

import { claimCurrentHousehold, rotateHouseholdShareLink } from "./actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const accessContext = await getCurrentAccessContext();
  const resolvedSearchParams = (await searchParams) ?? {};

  const claimed = Array.isArray(resolvedSearchParams.claimed)
    ? resolvedSearchParams.claimed[0]
    : resolvedSearchParams.claimed;
  const rotated = Array.isArray(resolvedSearchParams.rotated)
    ? resolvedSearchParams.rotated[0]
    : resolvedSearchParams.rotated;
  const claim = Array.isArray(resolvedSearchParams.claim)
    ? resolvedSearchParams.claim[0]
    : resolvedSearchParams.claim;

  const household = await prisma.household.findFirst({
    where: { id: accessContext.householdId },
    include: {
      claimedBy: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!household) {
    return (
      <div className="max-w-2xl rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        No household was found for your account.
      </div>
    );
  }

  const shareLink = accessContext.canManageLink
    ? await getCurrentHouseholdShareLink(household.id)
    : null;

  const isUnclaimed = household.claimedByUserId === null;
  const authUser =
    isUnclaimed && accessContext.canManageLink ? await getCurrentAuthUser() : null;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Settings</h1>
        <p className="text-slate-500">Manage household access and members.</p>
      </div>

      {claimed === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Household ownership has been claimed successfully.
        </div>
      ) : null}

      {rotated === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Household invite link rotated. Previous links no longer work.
        </div>
      ) : null}

      {claim === "conflict" ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          This household was already claimed by another account.
        </div>
      ) : null}

      {claim === "forbidden" ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Only the current household manager can claim ownership.
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Household</h2>
        <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
          <div>
            <dt className="font-semibold text-slate-500">Name</dt>
            <dd className="mt-1 text-slate-800">{household.name}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Members</dt>
            <dd className="mt-1 text-slate-800">{household.members.length}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Claimed</dt>
            <dd className="mt-1 text-slate-800">{isUnclaimed ? "No" : "Yes"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Claim owner</dt>
            <dd className="mt-1 text-slate-800">
              {household.claimedBy
                ? household.claimedBy.name ?? household.claimedBy.email
                : "Not claimed yet"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Household Share Link</h2>

        {accessContext.canManageLink && shareLink ? (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="household-share-link">
                Invite URL
              </label>
              <input
                id="household-share-link"
                readOnly
                value={shareLink.url}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              />
              <p className="mt-2 text-xs text-slate-500">
                Anyone with this link can access and edit recipes, planner, and shopping list.
              </p>
            </div>

            <form action={rotateHouseholdShareLink}>
              <button
                type="submit"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-rose-200 hover:text-rose-700"
              >
                Rotate Invite Link
              </button>
            </form>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Only the household manager can view or rotate the invite link.
          </div>
        )}
      </section>

      {isUnclaimed && accessContext.canManageLink ? (
        <section className="rounded-3xl border border-dashed border-emerald-200 bg-emerald-50/50 p-6 text-sm text-slate-700">
          <h2 className="text-lg font-bold text-slate-900">Claim Household Ownership</h2>
          <p className="mt-2 text-slate-600">
            Claiming links this household to your Supabase login so you can manage access from any device.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            {authUser ? (
              <form action={claimCurrentHousehold}>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
                >
                  Claim This Household
                </button>
              </form>
            ) : (
              <Link
                href="/login?next=/claim-household"
                className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
              >
                Login to Claim
              </Link>
            )}
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Members</h2>
        {household.members.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No members yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-100">
            {household.members.map((member) => (
              <li key={member.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-800">{member.user.name ?? member.user.email}</p>
                  <p className="text-slate-500">{member.user.email}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {member.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
