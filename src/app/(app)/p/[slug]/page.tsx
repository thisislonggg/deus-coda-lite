"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import FolderContentsGrid from "@/components/FolderContentsGrid";
import RichEditor from "@/components/RichEditor";
import { debounce } from "lodash";

// role
import { AppRole, getMyRoleBrowser, canEdit } from "@/lib/role.client";

type PageType = "folder" | "doc" | "sop" | "report" | "calendar" | "link";

type PageRow = {
  id: string;
  title: string;
  slug: string;
  type: PageType;
  icon?: string | null;
  content_md?: string | null;
  status?: string | null;
  external_url?: string | null;
};
function isContentEmpty(html?: string | null) {
  if (!html) return true;

  const cleaned = html
    .replace(/<p><\/p>/gi, "")
    .replace(/<br\s*\/?>/gi, "")
    .replace(/&nbsp;/gi, "")
    .trim();

  return cleaned === "";
}

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

// Fungsi untuk mengkonversi warna konten berdasarkan tema
function convertColorsForTheme(html: string, toDarkMode: boolean): string {
  if (!html) return html;
  
  if (toDarkMode) {
    // Light → Dark
    return html
      .replace(/color:\s*#30A230/gi, 'color: #ABF4AB')
      .replace(/color:\s*#B43A40/gi, 'color: #DF9094')
      .replace(/color:\s*#E9BC00/gi, 'color: #F0DC88')
      .replace(/color:\s*#787878/gi, 'color: #D5D5C9')
      .replace(/color:\s*#191919/gi, 'color: #FFFFFF')
      .replace(/color:\s*#30a230/gi, 'color: #ABF4AB')
      .replace(/color:\s*#b43a40/gi, 'color: #DF9094')
      .replace(/color:\s*#e9bc00/gi, 'color: #F0DC88');
  } else {
    // Dark → Light
    return html
      .replace(/color:\s*#ABF4AB/gi, 'color: #30A230')
      .replace(/color:\s*#DF9094/gi, 'color: #B43A40')
      .replace(/color:\s*#F0DC88/gi, 'color: #E9BC00')
      .replace(/color:\s*#D5D5C9/gi, 'color: #787878')
      .replace(/color:\s*#FFFFFF/gi, 'color: #191919')
      .replace(/color:\s*#abf4ab/gi, 'color: #30A230')
      .replace(/color:\s*#df9094/gi, 'color: #B43A40')
      .replace(/color:\s*#f0dc88/gi, 'color: #E9BC00');
  }
}

// CSS untuk override warna berdasarkan tema
const getColorOverrideCSS = (isDarkMode: boolean) => {
  if (isDarkMode) {
    return `
      .theme-color-override [style*="color: #30A230"],
      .theme-color-override [style*="color:#30A230"],
      .theme-color-override [style*="color: #30a230"],
      .theme-color-override [style*="color:#30a230"] { color: #ABF4AB !important; }
      .theme-color-override [style*="color: #B43A40"],
      .theme-color-override [style*="color:#B43A40"],
      .theme-color-override [style*="color: #b43a40"],
      .theme-color-override [style*="color:#b43a40"] { color: #DF9094 !important; }
      .theme-color-override [style*="color: #E9BC00"],
      .theme-color-override [style*="color:#E9BC00"],
      .theme-color-override [style*="color: #e9bc00"],
      .theme-color-override [style*="color:#e9bc00"] { color: #F0DC88 !important; }
      .theme-color-override [style*="color: #787878"],
      .theme-color-override [style*="color:#787878"] { color: #D5D5C9 !important; }
      .theme-color-override [style*="color: #191919"],
      .theme-color-override [style*="color:#191919"] { color: #FFFFFF !important; }
    `;
  } else {
    return `
      .theme-color-override [style*="color: #ABF4AB"],
      .theme-color-override [style*="color:#ABF4AB"],
      .theme-color-override [style*="color: #abf4ab"],
      .theme-color-override [style*="color:#abf4ab"] { color: #30A230 !important; }
      .theme-color-override [style*="color: #DF9094"],
      .theme-color-override [style*="color:#DF9094"],
      .theme-color-override [style*="color: #df9094"],
      .theme-color-override [style*="color:#df9094"] { color: #B43A40 !important; }
      .theme-color-override [style*="color: #F0DC88"],
      .theme-color-override [style*="color:#F0DC88"],
      .theme-color-override [style*="color: #f0dc88"],
      .theme-color-override [style*="color:#f0dc88"] { color: #E9BC00 !important; }
      .theme-color-override [style*="color: #D5D5C9"],
      .theme-color-override [style*="color:#D5D5C9"],
      .theme-color-override [style*="color: #d5d5c9"],
      .theme-color-override [style*="color:#d5d5c9"] { color: #787878 !important; }
      .theme-color-override [style*="color: #FFFFFF"],
      .theme-color-override [style*="color:#FFFFFF"],
      .theme-color-override [style*="color: #ffffff"],
      .theme-color-override [style*="color:#ffffff"] { color: #191919 !important; }
    `;
  }
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
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);

  const timerRef = useRef<number | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);

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

  // Auto-save function
 const saveContent = useCallback(async () => {
    if (!page || !allowEdit || !dirty) return;

    setSaving(true);

    const contentToSave = draftContent;

    const { error } = await supabase
      .from("pages")
      .update({
        content_md: contentToSave,
        updated_at: new Date().toISOString(),
      })
      .eq("id", page.id);

    setSaving(false);

    if (error) {
      flash(`Auto-save gagal: ${error.message}`);
      return;
    }

    setPage((prev) => (prev ? { ...prev, content_md: contentToSave } : prev));
    setDirty(false);
    setLastSaveTime(new Date());
  }, [page, allowEdit, dirty, draftContent, supabase]);

  // Debounced auto-save
  const debouncedSave = useCallback(
    debounce(() => {
      if (autoSaveEnabled && allowEdit && dirty) {
        saveContent();
      }
    }, 3000), // Auto-save after 3 seconds of inactivity
    [autoSaveEnabled, allowEdit, dirty, saveContent]
  );

  // Manual save function
  const handleSave = useCallback(async () => {
    if (!page) return;

    if (!allowEdit) {
      flash("Anda tidak punya izin untuk edit.");
      return;
    }

    if (!dirty) {
      flash("Tidak ada perubahan.");
      return;
    }

    await saveContent();
    flash("Saved ✅");
  }, [page, allowEdit, dirty, saveContent]);

  // Effect untuk menutup popup icon ketika klik di luar
   useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        iconOpen &&
        iconPopupRef.current &&
        !iconPopupRef.current.contains(event.target as Node) &&
        iconButtonRef.current &&
        !iconButtonRef.current.contains(event.target as Node)
      ) {
        setIconOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [iconOpen]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (autoSaveEnabled && dirty) debouncedSave();
    return () => debouncedSave.cancel();
  }, [draftContent, autoSaveEnabled, dirty, debouncedSave]);

  useEffect(() => {
    if (!autoSaveEnabled || !allowEdit) return;
    const interval = setInterval(() => {
      if (dirty) saveContent();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoSaveEnabled, allowEdit, dirty, saveContent]);

  useEffect(() => {
    (async () => {
      const r = await getMyRoleBrowser();
      setRole(r);
    })();
  }, []);

  useEffect(() => {
    if (!allowEdit) setMode("preview");
  }, [allowEdit]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("pages")
        .select("id,title,slug,type,icon,content_md,status,external_url")
        .eq("slug", slug)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        setPage(null);
        setDraftContent("");
        setDirty(false);
        setLoading(false);
        return;
      }

      const p = (data ?? null) as PageRow | null;
      setDraftContent(p?.content_md || "");
      setPage(p);
      setDirty(false);
      setLoading(false);
    }

    if (slug) void load();
    return () => {
      mounted = false;
    };
  }, [slug, supabase]);

  // Handler untuk perubahan konten
  const handleContentChange = useCallback((nextHtml: string) => {
    setDraftContent(nextHtml);
    setDirty(true);
  }, []);

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
    setIconOpen(false);
  }

  // Toggle auto-save
  const toggleAutoSave = () => {
    setAutoSaveEnabled(!autoSaveEnabled);
  };

  // loading states
  if (loading) {
    return <div className="h-full bg-[var(--color-bg)] text-[var(--color-text)] p-6">Loading...</div>;
  }
  if (!page) {
    return <div className="h-full bg-[var(--color-bg)] text-[var(--color-text)] p-6">Page tidak ditemukan.</div>;
  }

  const isFolder = page.type === "folder";
  const isLink = page.type === "link";
  const url = (page.external_url ?? "").trim();
  const embedUrl = url ? toEmbeddableGoogleUrl(url) : "";

  const shownIcon = (page.icon?.trim() ? page.icon : defaultIconByType(page.type)) as string;
  const presetIcons = [...(ICON_PRESETS[page.type] ?? []), ...ICON_PRESETS.general];

  return (
    <div className="h-full bg-[var(--color-bg)] text-[var(--color-text)] p-6 relative">

      {/* ======================================================
          ✅ MOBILE HEADER (SEKARANG BENAR-BENAR MUNCUL)
      ====================================================== */}
      <div className="md:hidden mb-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] flex items-center justify-center text-xl shrink-0">
            {shownIcon}
          </div>
          <div className="min-w-0">
            <div className="text-lg font-semibold leading-tight truncate">
              {page.title}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
              <span>{isFolder ? "Folder" : "Page"} · {page.status}</span>
              <span className={`px-2 py-0.5 rounded-full ${dirty ? "bg-yellow-500/20 text-yellow-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                {dirty ? "Unsaved" : "Saved"}
              </span>
              {lastSaveTime && (
                <span>Terakhir: {lastSaveTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              )}
            </div>
          </div>
        </div>

        {allowEdit && (
          <>
            <div className="flex items-center gap-1 mr-2">
              <button
                type="button"
                onClick={toggleAutoSave}
                className={`px-2 py-1 rounded-md text-xs border ${autoSaveEnabled ? 'bg-green-500/20 border-green-500/30 text-green-600 dark:text-green-300' : 'bg-gray-500/20 border-gray-500/30 text-gray-600 dark:text-gray-300'}`}
                title={autoSaveEnabled ? "Auto-save aktif" : "Auto-save nonaktif"}
              >
                {autoSaveEnabled ? "🔄 Auto" : "⏸️ Auto"}
              </button>
              <span className="text-xs text-[var(--color-muted)]">{autoSaveEnabled ? "ON" : "OFF"}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
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
            </div>

            <button
              onClick={saveContent}
              disabled={!dirty || saving}
              className="w-full py-3 rounded-xl font-semibold"
              style={{ backgroundColor: "rgb(var(--dc-primary))", color: "rgb(var(--dc-dark))" }}
            >
              {saving ? "Saving…" : "Save Now"}
            </button>
          </>
        )}
      </div>

      {/* ======================================================
          DESKTOP HEADER (TIDAK DIUBAH)
      ====================================================== */}
      <div className="hidden md:flex items-start justify-between gap-3 mb-5">
  
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
            <div className="text-sm text-[var(--color-muted)] mt-1 flex flex-wrap items-center gap-2">
              <span>{isFolder ? "Folder" : isLink ? "Google Link" : "Page"} • {page.status === "draft" ? "Draft" : "Published"}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${dirty ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-300/90' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300/90'}`}>
                {dirty ? "Unsaved" : "Saved"}
              </span>
              {lastSaveTime && (
                <span className="text-xs text-[var(--color-muted)]">
                  Terakhir disimpan: {lastSaveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {saving && <span className="text-xs text-blue-500 animate-pulse">Menyimpan...</span>}
            </div>
          </div>
        </div>

        {/* Buttons (edit only for admin/editor) */}
        {allowEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 mr-2">
              <button
                type="button"
                onClick={toggleAutoSave}
                className={`px-2 py-1 rounded-md text-xs border ${autoSaveEnabled ? 'bg-green-500/20 border-green-500/30 text-green-600 dark:text-green-300' : 'bg-gray-500/20 border-gray-500/30 text-gray-600 dark:text-gray-300'}`}
                title={autoSaveEnabled ? "Auto-save aktif" : "Auto-save nonaktif"}
              >
                {autoSaveEnabled ? "🔄 Auto" : "⏸️ Auto"}
              </button>
              <span className="text-xs text-[var(--color-muted)]">{autoSaveEnabled ? "ON" : "OFF"}</span>
            </div>

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
              disabled={saving || !dirty}
            >
              {saving ? "Saving..." : "Save Now"}
            </button>
          </div>
        )}
      </div>

      {saveMsg && (
        <div className="mb-4 p-2 rounded-md bg-[var(--bg-card)] border border-[var(--border-main)]">
          <div className="text-sm text-[var(--color-text)]/80">{saveMsg}</div>
        </div>
      )}

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

{/* MODE EDIT → editor SELALU muncul */}
{allowEdit && mode === "edit" && (
  <div className="rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-6 min-w-0">
    <RichEditor
      value={draftContent}
      editable
      uploadFolder={`pages/${page.id}`}
      onChangeHtml={handleContentChange}
      placeholder={
        isFolder
          ? "Tulis catatan folder…"
          : "Tulis catatan… (H1/H2/H3, list, dll)"
      }
    />
  </div>
)}

{mode === "preview" && !isContentEmpty(draftContent) && (
  <div className="rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-6 min-w-0">
    <div
      key={draftContent}
      className="dc-content break-words overflow-wrap-anywhere"
      dangerouslySetInnerHTML={{ __html: draftContent }}
    />
  </div>
)}

    </div>
  );
}