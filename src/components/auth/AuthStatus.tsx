"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getBrowserSupabaseClient, hasSupabasePublicEnv } from "@/lib/supabase/client";

const isAuthDisabled = /^(1|true|yes)$/i.test(process.env.NEXT_PUBLIC_DISABLE_AUTH ?? "");

export default function AuthStatus() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(hasSupabasePublicEnv);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) {
      return;
    }

    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) {
        return;
      }
      setUser(data.user ?? null);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) {
        return;
      }
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const label = useMemo(() => {
    if (!user) {
      return null;
    }
    return user.email ?? user.user_metadata?.full_name ?? "Signed in";
  }, [user]);

  if (isAuthDisabled) {
    return <span className="text-xs text-amber-600 dark:text-amber-400">Auth disabled</span>;
  }

  if (!hasSupabasePublicEnv) {
    return <span className="text-xs text-amber-600 dark:text-amber-400">Auth not configured</span>;
  }

  if (loading) {
    return <span className="text-xs text-slate-400 dark:text-slate-500">Loading...</span>;
  }

  if (!user) {
    return (
      <a
        href="/login"
        className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Login
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-[200px] truncate text-xs text-slate-500 dark:text-slate-400 md:inline">{label}</span>
      <button
        type="button"
        onClick={async () => {
          const supabase = getBrowserSupabaseClient();
          if (!supabase) {
            return;
          }
          await supabase.auth.signOut();
          window.location.assign("/login");
        }}
        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Logout
      </button>
    </div>
  );
}
