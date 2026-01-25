"use client";

import { useMemo, useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

// Komponen utama dengan Suspense wrapper
function ResetPasswordContent() {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"verify" | "input" | "success">("verify");
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

  // Extract token from URL
  useEffect(() => {
    const checkToken = async () => {
      try {
        // Cek apakah user sudah memiliki session valid
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // Jika sudah ada session, langsung ke input password
          setIsValidToken(true);
          setStep("input");
          return;
        }

        // Coba ekstrak token dari berbagai sumber
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        const tokenFromHash = hashParams.get('access_token') || hashParams.get('token');
        
        const searchParams = new URLSearchParams(window.location.search);
        const tokenFromQuery = searchParams.get('token');
        
        const token = tokenFromHash || tokenFromQuery;

        if (!token) {
          setIsValidToken(false);
          return;
        }

        // Coba set session dengan token
        const { error: tokenError } = await supabase.auth.setSession({
          access_token: token,
          refresh_token: "",
        });

        if (tokenError) {
          console.error("Token error:", tokenError);
          setIsValidToken(false);
          return;
        }

        // Token valid, lanjut ke input password
        setIsValidToken(true);
        setStep("input");
        
        // Clear URL hash/query untuk keamanan
        window.history.replaceState({}, "", window.location.pathname);
        
      } catch (err) {
        console.error("Error checking token:", err);
        setIsValidToken(false);
      }
    };

    checkToken();
  }, [supabase.auth]);

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
      // Cek session sebelum update
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError("Session tidak valid. Silakan minta link reset password baru.");
        setLoading(false);
        return;
      }

      // Update user password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      // Password changed successfully
      setStep("success");
      setMessage("Password berhasil diubah! Anda akan diarahkan ke halaman login.");

      // Sign out untuk fresh session
      await supabase.auth.signOut();

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
      setLoading(false);
    }
  }

  // Render berdasarkan step
  if (step === "verify") {
    return (
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 p-6 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-white/10 rounded-xl animate-pulse"></div>
          <div className="mt-4 w-32 h-6 bg-white/10 rounded animate-pulse"></div>
          <div className="mt-1 w-48 h-4 bg-white/5 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (isValidToken === false) {
    return (
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
          <p className="mt-2 text-xs text-white/50">
            Pastikan Anda mengklik link lengkap dari email atau minta link baru.
          </p>
          <div className="mt-4 flex flex-col gap-3 w-full">
            <Link
              href="/forgot-password"
              className="px-4 py-3 rounded-lg bg-yellow-400 text-black font-semibold hover:bg-yellow-500 transition-colors text-center"
            >
              Minta Link Baru
            </Link>
            <Link
              href="/login"
              className="px-4 py-3 rounded-lg border border-white/15 text-white font-semibold hover:bg-white/10 transition-colors text-center"
            >
              Kembali ke Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (step === "input") {
    return (
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
          <h1 className="mt-4 text-xl font-semibold text-white">Password Baru</h1>
          <p className="mt-1 text-sm text-white/70">
            Masukkan password baru untuk akun Anda
          </p>
        </div>

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

        <div className="mt-6 pt-4 border-t border-white/10 text-center text-sm text-white/70">
          <Link href="/" className="text-yellow-300 hover:underline">
            ← Kembali ke Home
          </Link>
        </div>
      </div>
    );
  }

  // Success step
  return (
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
        <h1 className="mt-4 text-xl font-semibold text-white">Berhasil!</h1>
        <p className="mt-1 text-sm text-white/70">Password telah diubah</p>
      </div>

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

      <div className="mt-6 pt-4 border-t border-white/10 text-center text-sm text-white/70">
        <Link href="/" className="text-yellow-300 hover:underline">
          ← Kembali ke Home
        </Link>
      </div>
    </div>
  );
}

// Loading component untuk Suspense
function ResetPasswordLoading() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 p-6 shadow-xl">
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-white/10 rounded-xl animate-pulse"></div>
        <div className="mt-4 w-32 h-6 bg-white/10 rounded animate-pulse"></div>
        <div className="mt-1 w-48 h-4 bg-white/5 rounded animate-pulse"></div>
      </div>
      <div className="mt-6 space-y-4">
        <div className="w-full h-12 bg-white/10 rounded-lg animate-pulse"></div>
        <div className="w-full h-12 bg-white/10 rounded-lg animate-pulse"></div>
        <div className="w-full h-12 bg-yellow-400/30 rounded-lg animate-pulse"></div>
      </div>
    </div>
  );
}

// Halaman utama dengan dynamic export
export const dynamic = 'force-dynamic';

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
      <Suspense fallback={<ResetPasswordLoading />}>
        <ResetPasswordContent />
      </Suspense>
    </main>
  );
}