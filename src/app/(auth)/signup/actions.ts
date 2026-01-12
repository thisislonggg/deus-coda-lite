"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerActionClient } from "@/lib/supabaseServerAction";

export async function signupAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  if (!email || !password) {
    return { ok: false, message: "Email dan password wajib diisi." };
  }
  if (password.length < 6) {
    return { ok: false, message: "Password minimal 6 karakter." };
  }
  if (password !== confirm) {
    return { ok: false, message: "Konfirmasi password tidak sama." };
  }

  const supabase = await createSupabaseServerActionClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // kalau email confirmation kamu ON, user akan diminta verifikasi dulu
      emailRedirectTo: "http://localhost:3000/login",
    },
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  // Kalau email confirmation OFF, biasanya sudah login -> langsung redirect
  redirect("/p/deus-code");
}
