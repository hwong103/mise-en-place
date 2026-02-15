export default function PlannerLoading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-6 w-40 rounded-full bg-slate-200" />
          <div className="h-4 w-72 rounded-full bg-slate-100" />
        </div>
        <div className="h-10 w-48 rounded-xl bg-slate-200" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <div className="h-4 w-24 rounded-full bg-slate-200" />
          <div className="h-10 rounded-xl bg-slate-100" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-10 rounded-2xl bg-white shadow-sm" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4">
              <div className="h-3 w-20 rounded-full bg-slate-100" />
              <div className="h-24 rounded-2xl bg-slate-50" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
