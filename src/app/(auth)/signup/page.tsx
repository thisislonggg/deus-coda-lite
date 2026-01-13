"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

export default function SignupPage() {
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    const name = fullName.trim();
    const mail = email.trim();

    if (!name) return setErr("Nama tidak boleh kosong.");
    if (!mail) return setErr("Email tidak boleh kosong.");
    if (password.length < 6) return setErr("Password minimal 6 karakter.");

    setLoading(true);

    // 1) Sign up + simpan metadata (ini yang paling pasti tersimpan)
    const { data, error } = await supabase.auth.signUp({
      email: mail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: { full_name: name },
      },
    });

    if (error) {
      setLoading(false);
      setErr(error.message);
      return;
    }

    const userId = data.user?.id;

    // 2) Coba upsert ke profiles (lebih aman daripada insert)
    // NOTE: Jika email confirmation aktif dan session belum ada,
    // RLS bisa menolak upsert karena auth.uid() belum tersedia.
    // Kita tidak hard-fail, cukup warning.
    if (userId) {
      const { error: profileErr } = await supabase.from("profiles").upsert(
        {
          id: userId,
          full_name: name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      if (profileErr) {
        console.warn("Upsert profiles failed:", profileErr.message);
        // tetap lanjut sukses signup, tapi kasih info supaya kamu tau penyebabnya
        setMsg(
          "Signup berhasil. Nama tersimpan di akun, tapi belum masuk ke tabel profiles (biasanya karena email confirmation/RLS). Setelah login, nama tetap akan muncul dari metadata."
        );
      } else {
        setMsg("Signup berhasil. Cek email untuk verifikasi (kalau email confirmation aktif).");
      }
    } else {
      setMsg("Signup berhasil. Cek email untuk verifikasi (kalau email confirmation aktif).");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 p-6 shadow-xl">
        {/* Logo */}
        <div className="flex flex-col items-center text-center">
          <Image
            src="/logo-deus.webp"
            alt="Deus Code"
            width={64}
            height={64}
            priority
            className="rounded-xl"
          />
          <h1 className="mt-4 text-xl font-semibold text-white">Sign Up</h1>
          <p className="mt-1 text-sm text-white/70">Buat akun untuk akses preview SOP</p>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          {/* Nama */}
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nama Lengkap"
            type="text"
            disabled={loading}
            className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-3 text-white outline-none placeholder:text-white/40 focus:ring-2 focus:ring-yellow-400/30 disabled:opacity-60"
          />

          {/* Email */}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            disabled={loading}
            className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-3 text-white outline-none placeholder:text-white/40 focus:ring-2 focus:ring-yellow-400/30 disabled:opacity-60"
          />

          {/* Password */}
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 6 karakter)"
            type="password"
            disabled={loading}
            className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-3 text-white outline-none placeholder:text-white/40 focus:ring-2 focus:ring-yellow-400/30 disabled:opacity-60"
          />

          {err && <div className="text-sm text-red-300">{err}</div>}
          {msg && <div className="text-sm text-green-300">{msg}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-yellow-400 px-4 py-3 font-semibold text-black disabled:opacity-60"
          >
            {loading ? "Loading..." : "Create account"}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-white/70">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-yellow-300 hover:underline">
            Login
          </Link>
        </div>

        <div className="mt-2 text-center text-xs text-white/50">
          <Link href="/" className="hover:underline">
            Kembali
          </Link>
        </div>
      </div>
    </main>
  );
}