"use client";

import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

export async function getMyNameBrowser(): Promise<string | null> {
  const supabase = createSupabaseBrowser();

  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return null;

  // ambil dari profiles dulu
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", uid)
    .maybeSingle();

  if (!error && data?.full_name) return data.full_name;

  // fallback: metadata
  const metaName = (userRes.user?.user_metadata as any)?.full_name;
  return metaName ?? null;
}
