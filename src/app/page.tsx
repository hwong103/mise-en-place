import Link from "next/link";
import { Plus, Utensils, Calendar, ShoppingCart } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center space-y-12 py-12 text-center">
      <div className="space-y-4">
        <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
          Cooking, <span className="text-indigo-600">Simplified.</span>
        </h1>
        <p className="mx-auto max-w-[600px] text-lg text-slate-600 md:text-xl">
          Your household&apos;s shared recipe repository with smart prep-groups, automated planning, and seamless shopping lists.
        </p>
      </div>

      <div className="grid w-full max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/recipes" className="group flex flex-col items-center space-y-4 rounded-3xl border border-slate-200 bg-white p-8 transition-all hover:border-indigo-600 hover:shadow-xl">
          <div className="rounded-2xl bg-indigo-50 p-4 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
            <Utensils size={32} />
          </div>
          <h3 className="text-xl font-bold">Recipes</h3>
          <p className="text-sm text-slate-500">Manage your household library with OCR and scraping.</p>
        </Link>

        <Link href="/planner" className="group flex flex-col items-center space-y-4 rounded-3xl border border-slate-200 bg-white p-8 transition-all hover:border-indigo-600 hover:shadow-xl">
          <div className="rounded-2xl bg-blue-50 p-4 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
            <Calendar size={32} />
          </div>
          <h3 className="text-xl font-bold">Planner</h3>
          <p className="text-sm text-slate-500">Drag & drop recipes into your weekly schedule.</p>
        </Link>

        <Link href="/shopping" className="group flex flex-col items-center space-y-4 rounded-3xl border border-slate-200 bg-white p-8 transition-all hover:border-indigo-600 hover:shadow-xl">
          <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
            <ShoppingCart size={32} />
          </div>
          <h3 className="text-xl font-bold">Shopping</h3>
          <p className="text-sm text-slate-500">Auto-generated lists based on your meal plan.</p>
        </Link>

        <Link
          href="/recipes#add-recipe"
          className="group flex flex-col items-center justify-center space-y-4 rounded-3xl border-2 border-dashed border-slate-200 p-8 transition-all hover:border-indigo-600"
        >
          <div className="rounded-2xl bg-slate-50 p-4 text-slate-400">
            <Plus size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-400">Add New</h3>
          <p className="text-sm text-slate-400 text-center text-balance">Add your first household recipe.</p>
        </Link>
      </div>
    </div>
  );
}
