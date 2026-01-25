"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"request" | "success">("request");

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setStep("success");
      setMessage("Email reset password telah dikirim. Silakan cek inbox/spam Anda.");
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
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
            {step === "request" ? "Reset Password" : "Cek Email Anda"}
          </h1>
          <p className="mt-1 text-sm text-white/70">
            {step === "request" 
              ? "Masukkan email untuk reset password" 
              : "Instruksi telah dikirim ke email"}
          </p>
        </div>

        {step === "request" ? (
          <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
            <div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email terdaftar"
                type="email"
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
              {loading ? "Mengirim..." : "Kirim Reset Link"}
            </button>
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            {message && (
              <div className="text-sm text-green-300 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                {message}
              </div>
            )}

            <div className="text-sm text-white/70 bg-white/5 border border-white/10 rounded-lg p-4">
              <p className="mb-2">✅ Email reset password telah dikirim ke:</p>
              <p className="font-medium text-yellow-300">{email}</p>
              <p className="mt-3 text-xs">
                Link akan berlaku selama 24 jam. Jika tidak menerima email, periksa folder spam atau 
                <button 
                  onClick={() => setStep("request")}
                  className="text-yellow-300 hover:underline ml-1"
                >
                  kirim ulang
                </button>.
              </p>
            </div>

            <Link
              href="/login"
              className="block text-center w-full rounded-lg border border-white/15 px-4 py-3 font-semibold text-white hover:bg-white/10 transition-colors"
            >
              Kembali ke Login
            </Link>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-white/10 text-center text-sm text-white/70">
          <Link href="/login" className="text-yellow-300 hover:underline">
            ← Kembali ke Login
          </Link>
          <span className="mx-2">•</span>
          <Link href="/" className="text-yellow-300 hover:underline">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}