"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

export default function LoginPage() {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) return setErr(error.message);

    router.replace("/p/deus-code");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 p-6 shadow-xl">
        {/* Logo */}
        <div className="flex flex-col items-center text-center">
          <Image src="/logo-deus.webp" alt="Deus Code" width={64} height={64} priority className="rounded-xl" />
          <h1 className="mt-4 text-xl font-semibold text-white">Login</h1>
          <p className="mt-1 text-sm text-white/70">Masuk untuk akses SOP & Docs</p>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-3 text-white outline-none"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-3 text-white outline-none"
          />

          {err && <div className="text-sm text-red-300">{err}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-yellow-400 px-4 py-3 font-semibold text-black disabled:opacity-60"
          >
            {loading ? "Loading..." : "Login"}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-white/70">
          Belum punya akun?{" "}
          <Link href="/signup" className="text-yellow-300 hover:underline">
            Sign Up
          </Link>
        </div>

        <div className="mt-2 text-center text-xs text-white/50">
          <Link href="/" className="hover:underline">Kembali</Link>
        </div>
      </div>
    </main>
  );
}
