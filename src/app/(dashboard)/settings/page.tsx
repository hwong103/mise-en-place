import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";

export default async function SettingsPage() {
  const householdId = await getCurrentHouseholdId();

  const household = await prisma.household.findFirst({
    where: { id: householdId },
    include: {
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

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Settings</h1>
        <p className="text-slate-500">Manage household preferences and members.</p>
      </div>

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
        </dl>
      </section>

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

      <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
        Invite/member management is intentionally stubbed in this phase.
        Use Supabase Auth user creation plus database membership assignment for now.
      </section>
    </div>
  );
}
