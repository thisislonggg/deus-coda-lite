"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import FolderContentsGrid from "@/components/FolderContentsGrid";
import RichEditor from "@/components/RichEditor";
import MarkdownView from "@/components/MarkdownView";

// role
import { AppRole, getMyRoleBrowser, canEdit } from "@/lib/role.client";

type PageType = "folder" | "doc" | "sop" | "report" | "calendar" | "link";

type PageRow = {
  id: string;
  title: string;
  slug: string;
  type: PageType;
  content_md?: string | null;     // HTML notes
  status?: string | null;
  external_url?: string | null;   // ✅ link url
};

function toEmbeddableGoogleUrl(url: string) {
  // Sheets
  if (url.includes("docs.google.com/spreadsheets")) {
    return url.replace(/\/edit.*$/, "/preview");
  }
  // Docs
  if (url.includes("docs.google.com/document")) {
    return url.replace(/\/edit.*$/, "/preview");
  }
  // Slides
  if (url.includes("docs.google.com/presentation")) {
    return url.replace(/\/edit.*$/, "/preview");
  }
  return url; // fallback
}

export default function PageView() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [role, setRole] = useState<AppRole>("viewer");

  const [page, setPage] = useState<PageRow | null>(null);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<"edit" | "preview">("preview");
  const [draftContent, setDraftContent] = useState<string>(""); // HTML notes
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

  // load role
  useEffect(() => {
    (async () => {
      const r = await getMyRoleBrowser();
      setRole(r);
    })();
  }, []);

  // force preview if not allowed
  useEffect(() => {
    if (!allowEdit) setMode("preview");
  }, [allowEdit]);

  // load page
  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      const { data, error } = await supabase
        .from("pages")
        .select("id,title,slug,type,content_md,status,external_url")
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

    const { error } = await supabase
      .from("pages")
      .update({ content_md: draftContent })
      .eq("id", page.id);

    setSaving(false);

    if (error) {
      setSaveMsg(`Gagal save: ${error.message}`);
      return;
    }

    setPage((prev) => (prev ? { ...prev, content_md: draftContent } : prev));
    setDirty(false);
    flash("Saved ✅");
  }

  // ✅ biar loading tidak putih (tetap gelap)
  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-white/60 p-6">Loading...</div>;
  }
  if (!page) {
    return <div className="min-h-screen bg-slate-950 text-white/60 p-6">Page tidak ditemukan.</div>;
  }

  const isFolder = page.type === "folder";
  const isLink = page.type === "link";
  const url = (page.external_url ?? "").trim();
  const embedUrl = url ? toEmbeddableGoogleUrl(url) : "";

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <div className="text-3xl font-bold text-white truncate">{page.title}</div>
          <div className="text-sm text-white/55 mt-1">
            {isFolder ? "Folder" : isLink ? "Google Link" : "Page"} •{" "}
            {page.status === "draft" ? "Draft" : "Published"} •{" "}
            {dirty ? (
              <span className="text-yellow-300/90">Unsaved</span>
            ) : (
              <span className="text-emerald-300/90">Saved</span>
            )}
          </div>
        </div>

        {/* Buttons (edit only for admin/editor) */}
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

      {/* ✅ Coda-like Link Preview Card */}
      {isLink && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 mb-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white/90">Preview</div>
            </div>

            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-md text-sm border border-white/15 hover:bg-white/10"
              >
                🔗 Open
              </a>
            )}
          </div>

          {embedUrl ? (
            <div className="rounded-xl overflow-hidden border border-white/10 bg-black">
              <iframe
                src={embedUrl}
                className="w-full h-[70vh]"
                allow="clipboard-read; clipboard-write"
              />
            </div>
          ) : (
            <div className="text-sm text-white/60">
              Link belum ada atau format link belum didukung untuk embed.
            </div>
          )}
        </div>
      )}

      {/* Notes / Content */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
        <div className="text-sm font-semibold text-white/85 mb-3">
          {isFolder ? "Catatan Folder" : isLink ? "Catatan Link" : "Konten"}
        </div>

        {allowEdit && mode === "edit" ? (
          <RichEditor
            value={draftContent}
            editable={true}
            onChangeHtml={(nextHtml) => {
              setDraftContent(nextHtml);
              setDirty(true);
            }}
            placeholder="Tulis catatan… (H1/H2/H3, list, dll)"
          />
        ) : (
          <MarkdownView html={draftContent} />
        )}
      </div>
    </div>
  );
}
