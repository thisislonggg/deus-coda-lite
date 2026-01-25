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
  icon?: string | null;          // ✅ NEW
  content_md?: string | null;    // HTML notes
  status?: string | null;
  external_url?: string | null;  // link url
};

function toEmbeddableGoogleUrl(url: string) {
  if (url.includes("docs.google.com/spreadsheets")) return url.replace(/\/edit.*$/, "/preview");
  if (url.includes("docs.google.com/document")) return url.replace(/\/edit.*$/, "/preview");
  if (url.includes("docs.google.com/presentation")) return url.replace(/\/edit.*$/, "/preview");
  return url;
}

function defaultIconByType(t: PageType) {
  if (t === "folder") return "📁";
  if (t === "sop") return "📜";
  if (t === "calendar") return "🗓️";
  if (t === "report") return "📊";
  if (t === "link") return "🔗";
  return "📄";
}

// Simple inline icon preset (feel like Coda)
const ICON_PRESETS: Record<PageType | "general", string[]> = {
  folder: ["📁", "📂", "🗂️", "🧩", "🗃️", "🧠", "🧱", "⭐"],
  doc: ["📄", "📝", "📌", "🧾", "📎", "✅", "⭐", "💡"],
  sop: ["📜", "✅", "🧾", "🧠", "🔒", "📌", "🧪", "⚙️"],
  report: ["📊", "📈", "📉", "🧮", "📑", "🗒️", "🎯", "⭐"],
  calendar: ["🗓️", "📅", "⏰", "🕒", "🔔", "📍", "✅", "⭐"],
  link: ["🔗", "🌐", "📎", "🧷", "🧭", "🪝", "⭐", "💡"],
  general: ["⭐", "🔥", "💡", "🎯", "🧰", "🧪", "🚀", "📌", "🧷", "✅"],
};

export default function PageView() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [role, setRole] = useState<AppRole>("viewer");

  const [page, setPage] = useState<PageRow | null>(null);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<"edit" | "preview">("preview");
  const [draftContent, setDraftContent] = useState<string>("");
  const [dirty, setDirty] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const allowEdit = canEdit(role);

  // icon picker state
  const [iconOpen, setIconOpen] = useState(false);
  const [customIcon, setCustomIcon] = useState("");
  
  // Ref untuk popup icon picker
  const iconPopupRef = useRef<HTMLDivElement>(null);
  const iconButtonRef = useRef<HTMLButtonElement>(null);

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

  // Effect untuk menutup popup icon ketika klik di luar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Jika popup terbuka dan klik di luar popup DAN di luar tombol icon
      if (iconOpen && 
          iconPopupRef.current && 
          !iconPopupRef.current.contains(event.target as Node) &&
          iconButtonRef.current &&
          !iconButtonRef.current.contains(event.target as Node)) {
        setIconOpen(false);
      }
    }
    
    // Tambahkan event listener
    document.addEventListener("mousedown", handleClickOutside);
    
    // Cleanup
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [iconOpen]); // Hanya re-run ketika iconOpen berubah

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
        .select("id,title,slug,type,icon,content_md,status,external_url") // ✅ icon added
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

  async function updateIcon(next: string | null) {
    if (!page) return;
    if (!allowEdit) return;

    const { error } = await supabase.from("pages").update({ icon: next }).eq("id", page.id);

    if (error) {
      flash("Gagal update icon");
      return;
    }

    setPage((p) => (p ? { ...p, icon: next } : p));
    flash("Icon updated ✅");
    setIconOpen(false); // Tutup popup setelah icon di-update
  }

  // loading states
  if (loading) {
    return <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] p-6">Loading...</div>;
  }
  if (!page) {
    return <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] p-6">Page tidak ditemukan.</div>;
  }

  const isFolder = page.type === "folder";
  const isLink = page.type === "link";
  const url = (page.external_url ?? "").trim();
  const embedUrl = url ? toEmbeddableGoogleUrl(url) : "";

  const shownIcon = (page.icon?.trim() ? page.icon : defaultIconByType(page.type)) as string;
  const presetIcons = [...(ICON_PRESETS[page.type] ?? []), ...ICON_PRESETS.general];

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        {/* Left: icon + title */}
        <div className="min-w-0 flex items-start gap-3">
          {/* Icon */}
          <div className="relative shrink-0">
            {allowEdit ? (
              <>
                <button
                  ref={iconButtonRef}
                  type="button"
                  onClick={() => setIconOpen((v) => !v)}
                  className="h-11 w-11 rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] hover:bg-[var(--bg-card)]/80 grid place-items-center text-2xl"
                  title="Ubah icon"
                >
                  {shownIcon}
                </button>

                {iconOpen && (
                  <div 
                    ref={iconPopupRef}
                    className="absolute z-50 mt-2 w-72 rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] shadow-xl p-3"
                  >
                    <div className="text-xs text-[var(--color-text)]/60 mb-2">Pilih icon</div>

                    <div className="grid grid-cols-8 gap-1">
                      {presetIcons.map((ic) => (
                        <button
                          key={ic}
                          type="button"
                          className="h-9 w-9 rounded-lg hover:bg-[var(--sidebar-hover)] grid place-items-center text-lg"
                          onClick={() => {
                            void updateIcon(ic);
                          }}
                        >
                          {ic}
                        </button>
                      ))}
                    </div>

                    <div className="h-px bg-[var(--border-main)] my-3" />

                    <div className="text-xs text-[var(--color-text)]/60 mb-2">Custom (paste emoji sendiri)</div>
                    <div className="flex gap-2">
                      <input
                        value={customIcon}
                        onChange={(e) => setCustomIcon(e.target.value)}
                        placeholder="contoh: 🧾"
                        className="flex-1 rounded-md bg-[var(--bg-card)] border border-[var(--border-main)] px-2 py-2 text-sm text-[var(--color-text)] outline-none"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const ic = customIcon.trim();
                            if (ic) void updateIcon(ic);
                            setCustomIcon("");
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="px-3 py-2 rounded-md text-sm border border-[var(--border-main)] hover:bg-[var(--sidebar-hover)]"
                        onClick={() => {
                          const ic = customIcon.trim();
                          if (ic) void updateIcon(ic);
                          setCustomIcon("");
                        }}
                      >
                        Set
                      </button>
                    </div>

                    <button
                      type="button"
                      className="mt-3 text-xs text-[var(--color-text)]/60 hover:text-[var(--color-text)]"
                      onClick={() => {
                        void updateIcon(null);
                      }}
                    >
                      Hapus icon
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="h-11 w-11 rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] grid place-items-center text-2xl">
                {shownIcon}
              </div>
            )}
          </div>

          {/* Title + meta */}
          <div className="min-w-0">
            <div className="text-3xl font-bold text-[var(--color-text)] truncate">{page.title}</div>
            <div className="text-sm text-[var(--color-muted)] mt-1">
              {isFolder ? "Folder" : isLink ? "Google Link" : "Page"} •{" "}
              {page.status === "draft" ? "Draft" : "Published"} •{" "}
              {dirty ? <span className="text-yellow-600 dark:text-yellow-300/90">Unsaved</span> : <span className="text-emerald-600 dark:text-emerald-300/90">Saved</span>}
            </div>
          </div>
        </div>

        {/* Buttons (edit only for admin/editor) */}
        {allowEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className={`px-3 py-2 rounded-md text-sm border transition ${
                mode === "preview" ? "bg-[var(--sidebar-hover)] border-[var(--border-main)]" : "border-[var(--border-main)] hover:bg-[var(--sidebar-hover)]"
              }`}
              onClick={() => setMode("preview")}
            >
              Preview
            </button>

            <button
              type="button"
              className={`px-3 py-2 rounded-md text-sm border transition ${
                mode === "edit" ? "bg-[var(--sidebar-hover)] border-[var(--border-main)]" : "border-[var(--border-main)] hover:bg-[var(--sidebar-hover)]"
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

      {saveMsg && <div className="text-xs text-[var(--color-text)]/70 mb-4">{saveMsg}</div>}

      {/* Folder cards */}
      {isFolder && (
        <>
          <FolderContentsGrid folderId={page.id} showDrafts title="Isi Folder" />
          <div className="h-px w-full bg-[var(--border-main)] my-6" />
        </>
      )}

      {/* Link Preview Card */}
      {isLink && (
        <div className="rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-5 mb-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--color-text)]">Preview</div>
            </div>

            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-md text-sm border border-[var(--border-main)] hover:bg-[var(--sidebar-hover)]"
              >
                🔗 Open
              </a>
            )}
          </div>

          {embedUrl ? (
            <div className="rounded-xl overflow-hidden border border-[var(--border-main)] bg-black">
              <iframe src={embedUrl} className="w-full h-[70vh]" allow="clipboard-read; clipboard-write" />
            </div>
          ) : (
            <div className="text-sm text-[var(--color-muted)]">Link belum ada atau format link belum didukung untuk embed.</div>
          )}
        </div>
      )}

      {/* Notes / Content */}
      <div className="rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-6 min-w-0">
        <div className="text-sm font-semibold text-[var(--color-text)] mb-3">{isFolder ? "Catatan Folder" : isLink ? "Catatan Link" : "Konten"}</div>

        {allowEdit && mode === "edit" ? (
          <RichEditor
            value={draftContent}
            editable={true}
            uploadFolder={`pages/${page.id}`}
            onChangeHtml={(nextHtml) => {
              setDraftContent(nextHtml);
              setDirty(true);
            }}
            placeholder="Tulis catatan… (H1/H2/H3, list, dll)"
          />
        ) : (
          <div
            className="
              text-[var(--color-text)]
              [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:my-3
              [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:my-3
              [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:my-3
              [&_p]:my-2
              [&_li]:my-1

              whitespace-pre-wrap break-words [overflow-wrap:anywhere]
              [&_pre]:overflow-x-auto
            "
            dangerouslySetInnerHTML={{ __html: draftContent }}
          />
        )}
      </div>
    </div>
  );
}