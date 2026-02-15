import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

  browserClient = createClient(supabaseUrl!, supabaseAnonKey!);
  return browserClient;
};
