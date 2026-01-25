import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseRoute";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/p/deus-code";

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = createSupabaseRouteClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}