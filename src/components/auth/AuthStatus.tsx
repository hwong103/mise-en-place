"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

export default function AuthStatus() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  if (loading) {
    return <span className="text-xs text-slate-400">Loading...</span>;
  }

  if (!user) {
    return (
      <a
        href="/login"
        className="rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Login
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-[200px] truncate text-xs text-slate-500 md:inline">{label}</span>
      <button
        type="button"
        onClick={async () => {
          await supabase.auth.signOut();
          window.location.assign("/login");
        }}
        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
      >
        Logout
      </button>
    </div>
  );
}
