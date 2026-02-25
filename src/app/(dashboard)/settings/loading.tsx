export default function SettingsLoading() {
  return (
    <div className="max-w-3xl space-y-8">
      <div className="space-y-2">
        <div className="h-8 w-36 rounded-full bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-64 rounded-full bg-slate-100 dark:bg-slate-900" />
      </div>

      {Array.from({ length: 4 }).map((_, index) => (
        <section key={index} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="h-5 w-48 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="mt-4 space-y-3">
            <div className="h-4 w-full rounded-full bg-slate-100 dark:bg-slate-900" />
            <div className="h-4 w-5/6 rounded-full bg-slate-100 dark:bg-slate-900" />
            <div className="h-10 w-40 rounded-xl bg-slate-200 dark:bg-slate-800" />
          </div>
        </section>
      ))}
    </div>
  );
}
