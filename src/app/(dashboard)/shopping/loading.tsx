export default function ShoppingLoading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-6 w-40 rounded-full bg-slate-200" />
          <div className="h-4 w-72 rounded-full bg-slate-100" />
        </div>
        <div className="h-10 w-48 rounded-xl bg-slate-200" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-4 w-36 rounded-full bg-slate-200" />
        <div className="mt-4 grid gap-3 sm:grid-cols-[1.5fr_1fr_auto]">
          <div className="h-10 rounded-xl bg-slate-100" />
          <div className="h-10 rounded-xl bg-slate-100" />
          <div className="h-10 rounded-xl bg-slate-200" />
        </div>
      </div>

      <div className="max-w-3xl space-y-8">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-4">
            <div className="h-3 w-24 rounded-full bg-slate-100" />
            <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
              <div className="space-y-3 p-6">
                {Array.from({ length: 4 }).map((__, itemIndex) => (
                  <div key={itemIndex} className="h-5 w-full rounded-full bg-slate-100" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
