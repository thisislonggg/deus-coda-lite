import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";

export function createSupabaseRouteClient() {
  // Cast ke RequestCookies supaya TS ngerti getAll/set ada
  const cookieStore = cookies() as unknown as RequestCookies;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set({ name, value, ...options });
          });
        },
      },
    }
  );
}
