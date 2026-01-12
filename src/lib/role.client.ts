// src/lib/role.client.ts
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

export type AppRole = "admin" | "editor" | "viewer";

export async function getMyRoleBrowser(): Promise<AppRole> {
  const supabase = createSupabaseBrowser();

  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return "viewer";

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", uid)
    .limit(1);

  if (error) return "viewer";
  return (data?.[0]?.role as AppRole) ?? "viewer";
}

export function canEdit(role: AppRole) {
  return role === "admin" || role === "editor";
}
export function canAdmin(role: AppRole) {
  return role === "admin";
}
