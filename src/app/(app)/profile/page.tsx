"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

export default function ProfilePage() {
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const [loading, setLoading] = useState(true);

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");

  // profile
  const [fullName, setFullName] = useState<string>("");

  // password
  const [newPassword, setNewPassword] = useState<string>("");
  const [newPassword2, setNewPassword2] = useState<string>("");

  // theme (PROFILE ONLY)
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  const [savingName, setSavingName] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function flash(message: string, isError = false) {
    if (isError) {
      setErr(message);
      setMsg(null);
    } else {
      setMsg(message);
      setErr(null);
    }
    window.setTimeout(() => {
      setMsg(null);
      setErr(null);
    }, 2500);
  }

  /* =======================
   * THEME HANDLER (PROFILE)
   * ======================= */
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(saved);
    }
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);

    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(next);

    localStorage.setItem("theme", next);
  }

  /* =======================
   * LOAD PROFILE
   * ======================= */
  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      const { data: authData, error: authErr } = await supabase.auth.getUser();

      if (!mounted) return;

      if (authErr || !authData.user) {
        setLoading(false);
        flash("Anda belum login.", true);
        return;
      }

      const u = authData.user;
      setUserId(u.id);
      setEmail(u.email ?? "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", u.id)
        .maybeSingle();

      if (!mounted) return;

      if (profile) {
        setFullName(profile.full_name ?? "");
      }

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function saveName() {
    if (!userId) return;

    setSavingName(true);
    setErr(null);
    setMsg(null);

    const { error: upErr } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: fullName.trim(),
      updated_at: new Date().toISOString(),
    });

    const { error: metaErr } = await supabase.auth.updateUser({
      data: { full_name: fullName.trim() },
    });

    setSavingName(false);

    if (upErr) return flash(`Gagal simpan nama: ${upErr.message}`, true);
    if (metaErr) return flash(`Nama tersimpan, tapi metadata gagal: ${metaErr.message}`, true);

    flash("Nama berhasil diperbarui ✅");
  }

  async function savePassword() {
    setErr(null);
    setMsg(null);

    if (!newPassword || newPassword.length < 8) {
      return flash("Password minimal 8 karakter.", true);
    }
    if (newPassword !== newPassword2) {
      return flash("Konfirmasi password tidak sama.", true);
    }

    setSavingPass(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSavingPass(false);

    if (error) return flash(`Gagal ganti password: ${error.message}`, true);

    setNewPassword("");
    setNewPassword2("");
    flash("Password berhasil diganti ✅");
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] p-6 transition-colors">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Edit Profile</h1>
          <p className="text-[var(--color-muted)] text-sm mt-1">
            Ubah nama, password, dan tema tampilan.
          </p>
        </div>

        {loading ? (
          <div className="text-[var(--color-muted)]">Loading...</div>
        ) : (
          <>
            {err && <div className="mb-4 text-sm text-red-500">{err}</div>}
            {msg && <div className="mb-4 text-sm text-green-600">{msg}</div>}

            {/* ================= THEME CARD ================= */}
            <div className="rounded-2xl border border-black/10 dark:border-[var(--border-main)] bg-[var(--bg-card)]/70 dark:bg-slate-900/50 p-5 mb-5">
              <div className="text-sm font-semibold mb-3">Theme</div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-[var(--color-muted)]">
                  Mode tampilan aplikasi
                </div>

                <button
                  type="button"
                  onClick={toggleTheme}
                  className="px-4 py-2 rounded-lg font-semibold border border-black/10 dark:border-white/15 hover:bg-black/5 dark:hover:bg-[var(--bg-card)]/10 text-[var(--color-text)]"
                >
                  {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
                </button>
              </div>
            </div>

            {/* ================= INFO CARD ================= */}
            <div className="rounded-2xl border border-black/10 dark:border-[var(--border-main)] bg-[var(--bg-card)]/70 dark:bg-slate-900/50 p-5 mb-5">
              <div className="text-sm font-semibold mb-3">Info Akun</div>

              <div className="grid gap-3">
                <div>
                  <div className="text-xs text-[var(--color-muted)] mb-1">Email</div>
                  <div className="rounded-lg bg-black/5 dark:bg-[var(--bg-card)]/5 border border-black/10 dark:border-[var(--border-main)] px-3 py-2">
                    {email || "-"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-[var(--color-muted)] mb-1">Nama Lengkap</div>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-lg bg-black/5 dark:bg-[var(--bg-card)]/10 border border-black/10 dark:border-white/15 px-3 py-2 outline-none text-[var(--color-text)]"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={saveName}
                    disabled={savingName}
                    className="px-4 py-2 rounded-lg font-semibold text-black bg-[var(--color-accent)] disabled:opacity-60"
                  >
                    {savingName ? "Saving..." : "Simpan Nama"}
                  </button>
                </div>
              </div>
            </div>

            {/* ================= PASSWORD CARD ================= */}
            <div className="rounded-2xl border border-black/10 dark:border-[var(--border-main)] bg-[var(--bg-card)]/70 dark:bg-slate-900/50 p-5">
              <div className="text-sm font-semibold mb-3">Ganti Password</div>

              <div className="grid gap-3">
                <input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="password"
                  placeholder="Password baru"
                  className="w-full rounded-lg bg-black/5 dark:bg-[var(--bg-card)]/10 border border-black/10 dark:border-white/15 px-3 py-2 outline-none text-[var(--color-text)]"
                />

                <input
                  value={newPassword2}
                  onChange={(e) => setNewPassword2(e.target.value)}
                  type="password"
                  placeholder="Konfirmasi password"
                  className="w-full rounded-lg bg-black/5 dark:bg-[var(--bg-card)]/10 border border-black/10 dark:border-white/15 px-3 py-2 outline-none text-[var(--color-text)]"
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={savePassword}
                    disabled={savingPass}
                    className="px-4 py-2 rounded-lg font-semibold text-black bg-[var(--color-accent)] disabled:opacity-60"
                  >
                    {savingPass ? "Saving..." : "Ganti Password"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}