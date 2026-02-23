import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabasePublicEnv = Boolean(supabaseUrl && supabaseAnonKey);

let browserClient: SupabaseClient | null | undefined;

export const getBrowserSupabaseClient = () => {
  if (!hasSupabasePublicEnv) {
    return null;
  }

  if (browserClient !== undefined) {
    return browserClient;
  }

  browserClient = createBrowserClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return browserClient;
};
