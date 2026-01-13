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

      // ambil profiles
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", u.id)
        .maybeSingle();

      if (!mounted) return;

      if (!profileErr && profile) {
        setFullName(profile.full_name ?? "");
      } else {
        // jika profile belum ada, buat default dari metadata bila ada
        const metaName = (u.user_metadata?.full_name as string | undefined) ?? "";
        setFullName(metaName);
        // optional: auto create
        await supabase.from("profiles").upsert({
          id: u.id,
          full_name: metaName,
          updated_at: new Date().toISOString(),
        });
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

    // 1) simpan ke profiles
    const { error: upErr } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: fullName.trim(),
      updated_at: new Date().toISOString(),
    });

    // 2) optional: simpan juga ke auth user_metadata biar gampang dipakai di UI
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
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Edit Profile</h1>
          <p className="text-white/60 text-sm mt-1">Ubah nama & password akun Anda.</p>
        </div>

        {loading ? (
          <div className="text-white/60">Loading...</div>
        ) : (
          <>
            {err && <div className="mb-4 text-sm text-red-300">{err}</div>}
            {msg && <div className="mb-4 text-sm text-emerald-300">{msg}</div>}

            {/* Card: Info */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 mb-5">
              <div className="text-sm font-semibold text-white/85 mb-3">Info Akun</div>

              <div className="grid gap-3">
                <div>
                  <div className="text-xs text-white/50 mb-1">Email</div>
                  <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white/80">
                    {email || "-"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-white/50 mb-1">Nama Lengkap</div>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Masukkan nama lengkap"
                    className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 text-white outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={saveName}
                    disabled={savingName}
                    className="px-4 py-2 rounded-lg font-semibold text-black bg-yellow-400 disabled:opacity-60"
                  >
                    {savingName ? "Saving..." : "Simpan Nama"}
                  </button>
                </div>
              </div>
            </div>

            {/* Card: Password */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
              <div className="text-sm font-semibold text-white/85 mb-3">Ganti Password</div>

              <div className="grid gap-3">
                <input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Password baru (min 8 karakter)"
                  type="password"
                  className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 text-white outline-none"
                />

                <input
                  value={newPassword2}
                  onChange={(e) => setNewPassword2(e.target.value)}
                  placeholder="Konfirmasi password baru"
                  type="password"
                  className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 text-white outline-none"
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={savePassword}
                    disabled={savingPass}
                    className="px-4 py-2 rounded-lg font-semibold text-black bg-yellow-400 disabled:opacity-60"
                  >
                    {savingPass ? "Saving..." : "Ganti Password"}
                  </button>
                </div>

                <div className="text-xs text-white/50">
                  Catatan: jika session expired / security policy, Supabase bisa minta login ulang.
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}