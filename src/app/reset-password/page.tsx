"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"input" | "success">("input");

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setError("Token reset password tidak valid atau sudah kadaluarsa.");
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    // Validation
    if (password.length < 6) {
      return setError("Password minimal 6 karakter.");
    }
    if (password !== confirmPassword) {
      return setError("Konfirmasi password tidak cocok.");
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      // Password changed successfully
      setStep("success");
      setMessage("Password berhasil diubah! Anda akan diarahkan ke halaman login.");

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 p-6 shadow-xl">
          <div className="flex flex-col items-center text-center">
            <Image
              src="/logo-deus.webp"
              alt="Deus Code"
              width={64}
              height={64}
              priority
              className="rounded-xl"
            />
            <h1 className="mt-4 text-xl font-semibold text-white">Link Tidak Valid</h1>
            <p className="mt-3 text-sm text-white/70">
              Link reset password tidak valid atau sudah kadaluarsa.
            </p>
            <Link
              href="/forgot-password"
              className="mt-4 text-yellow-300 hover:underline text-sm"
            >
              Minta link reset baru
            </Link>
          </div>
        </div>
      </main>
    );
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
          <h1 className="mt-4 text-xl font-semibold text-white">
            {step === "input" ? "Password Baru" : "Berhasil!"}
          </h1>
          <p className="mt-1 text-sm text-white/70">
            {step === "input" 
              ? "Masukkan password baru untuk akun Anda" 
              : "Password telah diubah"}
          </p>
        </div>

        {step === "input" ? (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password baru (min. 6 karakter)"
                type="password"
                required
                disabled={loading}
                className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-3 text-white outline-none placeholder:text-white/40 focus:ring-2 focus:ring-yellow-400/30 disabled:opacity-60"
              />
            </div>

            <div>
              <input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Konfirmasi password baru"
                type="password"
                required
                disabled={loading}
                className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-3 text-white outline-none placeholder:text-white/40 focus:ring-2 focus:ring-yellow-400/30 disabled:opacity-60"
              />
            </div>

            {error && (
              <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-yellow-400 px-4 py-3 font-semibold text-black disabled:opacity-60 hover:bg-yellow-500 transition-colors"
            >
              {loading ? "Mengubah..." : "Ubah Password"}
            </button>
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            {message && (
              <div className="text-sm text-green-300 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                ✅ {message}
              </div>
            )}

            <div className="text-sm text-white/70 bg-white/5 border border-white/10 rounded-lg p-4">
              <p className="mb-3">Password Anda telah berhasil diubah.</p>
              <p className="text-xs">
                Anda akan otomatis diarahkan ke halaman login. Jika tidak, klik tombol di bawah.
              </p>
            </div>

            <Link
              href="/login"
              className="block text-center w-full rounded-lg bg-yellow-400 px-4 py-3 font-semibold text-black hover:bg-yellow-500 transition-colors"
            >
              Login Sekarang
            </Link>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-white/10 text-center text-sm text-white/70">
          <Link href="/" className="text-yellow-300 hover:underline">
            ← Kembali ke Home
          </Link>
        </div>
      </div>
    </main>
  );
}