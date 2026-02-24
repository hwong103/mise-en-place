export default function RecipeDetailLoading() {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 p-6 md:p-8">
        <div className="space-y-4">
          <div className="h-9 w-40 rounded-xl bg-white/20" />
          <div className="h-10 w-2/3 rounded-xl bg-white/25" />
          <div className="h-5 w-1/2 rounded-xl bg-white/15" />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="h-6 w-36 rounded-full bg-slate-200" />
                <div className="mt-4 space-y-3">
                  {Array.from({ length: 6 }).map((__, rowIndex) => (
                    <div key={rowIndex} className="h-4 rounded-full bg-slate-100" />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="h-6 w-24 rounded-full bg-slate-200" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-4 rounded-full bg-slate-100" />
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="h-6 w-24 rounded-full bg-slate-200" />
            <div className="mt-4 h-40 rounded-2xl bg-slate-100" />
          </div>
        </aside>
      </div>
    </div>
  );
}
