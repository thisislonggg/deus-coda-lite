import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseRoute";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Jika ada error, redirect ke login dengan pesan error
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  // Jika tidak ada code, redirect ke login
  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = createSupabaseRouteClient();
  
  try {
    const { error: supabaseError } = await supabase.auth.exchangeCodeForSession(code);

    if (supabaseError) {
      console.error("Auth callback error:", supabaseError);
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(supabaseError.message)}`
      );
    }

    // Berhasil, redirect ke halaman reset password
    return NextResponse.redirect(`${origin}/reset-password`);
  } catch (err) {
    console.error("Unexpected error in auth callback:", err);
    return NextResponse.redirect(`${origin}/login?error=Unexpected+error`);
  }
}