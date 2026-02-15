export default function RecipesLoading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-6 w-40 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-72 rounded-full bg-slate-100 dark:bg-slate-900" />
        </div>
        <div className="h-10 w-32 rounded-xl bg-slate-200 dark:bg-slate-800" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="h-4 w-16 rounded-full bg-slate-100 dark:bg-slate-900" />
        <div className="mt-3 h-10 w-full rounded-xl bg-slate-100 dark:bg-slate-900" />
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="h-4 w-32 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="h-3 w-48 rounded-full bg-slate-100 dark:bg-slate-900" />
              </div>
              <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-900" />
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 3 }).map((__, tagIndex) => (
                <div key={tagIndex} className="h-6 w-16 rounded-full bg-slate-100 dark:bg-slate-900" />
              ))}
            </div>
            <div className="flex gap-3">
              <div className="h-9 w-28 rounded-xl bg-slate-200 dark:bg-slate-800" />
              <div className="h-9 w-28 rounded-xl bg-slate-100 dark:bg-slate-900" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
