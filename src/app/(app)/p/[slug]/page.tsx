"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import FolderContentsGrid from "@/components/FolderContentsGrid";
import RichEditor from "@/components/RichEditor";
import MarkdownView from "@/components/MarkdownView";

// ✅ role
import { AppRole, getMyRoleBrowser, canEdit } from "@/lib/role.client";

type PageType = "folder" | "doc" | "sop" | "report" | "calendar";

type PageRow = {
  id: string;
  title: string;
  slug: string;
  type: PageType;
  content_md?: string | null; // kamu simpan HTML di sini
  status?: string | null;
};

export default function PageView() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const [role, setRole] = useState<AppRole>("viewer");

  const [page, setPage] = useState<PageRow | null>(null);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<"edit" | "preview">("preview");
  const [draftContent, setDraftContent] = useState<string>(""); // HTML
  const [dirty, setDirty] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const allowEdit = canEdit(role);

  function flash(msg: string) {
    setSaveMsg(msg);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setSaveMsg(null), 2000);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  // ✅ load role
  useEffect(() => {
    (async () => {
      const r = await getMyRoleBrowser();
      setRole(r);
    })();
  }, []);

  // ✅ kalau role tidak boleh edit, paksa preview terus
  useEffect(() => {
    if (!allowEdit) setMode("preview");
  }, [allowEdit]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      const { data, error } = await supabase
        .from("pages")
        .select("id,title,slug,type,content_md,status")
        .eq("slug", slug)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.warn(error.message);
        setPage(null);
        setDraftContent("");
        setDirty(false);
        setLoading(false);
        return;
      }

      const p = (data ?? null) as PageRow | null;
      setPage(p);

      setDraftContent(p?.content_md ?? "");
      setDirty(false);

      setLoading(false);
    }

    if (slug) void load();
    return () => {
      mounted = false;
    };
  }, [slug, supabase]);

  async function handleSave() {
    if (!page) return;

    // ✅ viewer tidak boleh save
    if (!allowEdit) {
      flash("Anda tidak punya izin untuk edit.");
      return;
    }

    if (!dirty) {
      flash("Tidak ada perubahan.");
      return;
    }

    setSaving(true);
    setSaveMsg(null);

    const { error } = await supabase.from("pages").update({ content_md: draftContent }).eq("id", page.id);

    setSaving(false);

    if (error) {
      setSaveMsg(`Gagal save: ${error.message}`);
      return;
    }

    setPage((prev) => (prev ? { ...prev, content_md: draftContent } : prev));
    setDirty(false);
    flash("Saved ✅");
  }

if (loading)
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="text-white/60">Loading...</div>
    </div>
  );

if (!page)
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="text-white/60">Page tidak ditemukan.</div>
    </div>
  );

  const isFolder = page.type === "folder";

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <div className="text-3xl font-bold text-white truncate">{page.title}</div>
          <div className="text-sm text-white/55 mt-1">
            {isFolder ? "Folder" : "Page"} • {page.status === "draft" ? "Draft" : "Published"} •{" "}
            {dirty ? <span className="text-yellow-300/90">Unsaved</span> : <span className="text-emerald-300/90">Saved</span>}
          </div>
        </div>

        {/* ✅ tombol kanan atas: hanya tampil kalau boleh edit */}
        {allowEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className={`px-3 py-2 rounded-md text-sm border transition ${
                mode === "preview" ? "bg-white/10 border-white/15" : "border-white/10 hover:bg-white/10"
              }`}
              onClick={() => setMode("preview")}
            >
              Preview
            </button>

            <button
              type="button"
              className={`px-3 py-2 rounded-md text-sm border transition ${
                mode === "edit" ? "bg-white/10 border-white/15" : "border-white/10 hover:bg-white/10"
              }`}
              onClick={() => setMode("edit")}
            >
              Edit
            </button>

            <button
              type="button"
              className="px-3 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
              style={{ backgroundColor: "rgb(var(--dc-primary))", color: "rgb(var(--dc-dark))" }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>

      {saveMsg && <div className="text-xs text-white/70 mb-4">{saveMsg}</div>}

      {/* Folder cards */}
      {isFolder && (
        <>
          <FolderContentsGrid folderId={page.id} showDrafts title="Isi Folder" />
          <div className="h-px w-full bg-white/10 my-6" />
        </>
      )}

      {/* Content card */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
        <div className="text-sm font-semibold text-white/85 mb-3">{isFolder ? "Catatan Folder" : "Konten"}</div>

        {/* ✅ EDIT mode hanya untuk allowEdit, selain itu selalu preview */}
        {allowEdit && mode === "edit" ? (
          <RichEditor
            value={draftContent}
            editable={true}
            onChangeHtml={(nextHtml) => {
              setDraftContent(nextHtml);
              setDirty(true);
            }}
            placeholder="Tulis pakai Heading (H1/H2/H3), list, dll..."
          />
        ) : (
          <MarkdownView html={draftContent} />
        )}
      </div>
    </div>
  );
}
