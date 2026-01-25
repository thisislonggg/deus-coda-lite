"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import { createPortal } from "react-dom";

type PageType = "folder" | "doc" | "sop" | "report" | "calendar" | "link";

type PageRow = {
  id: string;
  title: string;
  slug: string;
  parent_id: string | null;
  type: PageType;
  icon?: string | null; // ✅ NEW
  status?: string | null;
};

function meta(type: PageType) {
  switch (type) {
    case "folder":
      return { 
        emoji: "📁", 
        label: "Folder", 
        badge: "bg-slate-200 dark:bg-slate-700 text-black dark:text-white" 
      };
    case "sop":
      return { 
        emoji: "📘", 
        label: "SOP", 
        badge: "bg-slate-200 dark:bg-slate-700 text-black dark:text-white" 
      };
    case "doc":
      return { 
        emoji: "📄", 
        label: "Doc", 
        badge: "bg-slate-200 dark:bg-slate-700 text-black dark:text-white" 
      };
    case "report":
      return { 
        emoji: "📊", 
        label: "Report", 
        badge: "bg-slate-200 dark:bg-slate-700 text-black dark:text-white" 
      };
    case "calendar":
      return { 
        emoji: "📅", 
        label: "Calendar", 
        badge: "bg-slate-200 dark:bg-slate-700 text-black dark:text-white" 
      };
    case "link":
      return { 
        emoji: "🔗", 
        label: "Link", 
        badge: "bg-slate-200 dark:bg-slate-700 text-black dark:text-white" 
      };
  }
}

const ICON_PRESETS: Record<PageType | "general", string[]> = {
  folder: ["📁", "📂", "🗂️", "🗃️", "🧩", "🧱", "⭐", "🔥"],
  doc: ["📄", "📝", "📌", "🧾", "📎", "✅", "⭐", "💡"],
  sop: ["📘", "📜", "✅", "🧾", "🔒", "⚙️", "🧪", "📌"],
  report: ["📊", "📈", "📉", "🧮", "📑", "🗒️", "🎯", "⭐"],
  calendar: ["📅", "🗓️", "⏰", "🕒", "🔔", "📍", "✅", "⭐"],
  link: ["🔗", "🌐", "📎", "🧷", "🧭", "🪝", "⭐", "💡"],
  general: ["⭐", "🔥", "💡", "🎯", "🧰", "🧪", "🚀", "📌", "🧷", "✅"],
};

export default function FolderContentsGrid({
  folderId,
  showDrafts = true,
  title = "Isi Folder",
}: {
  folderId: string;
  showDrafts?: boolean;
  title?: string;
}) {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const router = useRouter();

  const [items, setItems] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Icon picker state
  const [pickerOpenForId, setPickerOpenForId] = useState<string | null>(null);
  const [customIcon, setCustomIcon] = useState("");
  const [pickerPosition, setPickerPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      let q = supabase
        .from("pages")
        .select("id,title,slug,parent_id,type,icon,status") // ✅ icon added
        .eq("parent_id", folderId);

      if (!showDrafts) q = q.eq("status", "published");

      const { data, error } = await q;

      if (!mounted) return;

      if (error) {
        console.warn("load folder items error:", error.message);
        setItems([]);
      } else {
        const raw = (data ?? []) as PageRow[];
        raw.sort((a, b) => {
          const af = a.type === "folder";
          const bf = b.type === "folder";
          if (af !== bf) return af ? -1 : 1;
          return (a.title ?? "").localeCompare(b.title ?? "");
        });
        setItems(raw);
      }

      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [folderId, showDrafts, supabase]);

  async function updateIcon(pageId: string, icon: string | null) {
    // Optimistic update
    setItems((prev) => prev.map((it) => (it.id === pageId ? { ...it, icon } : it)));

    const { error } = await supabase.from("pages").update({ icon }).eq("id", pageId);

    if (error) {
      console.warn("update icon error:", error.message);
      // rollback by reloading (simple + safe)
      setPickerOpenForId(null);
      setCustomIcon("");
      setPickerPosition(null);
      // reload
      setLoading(true);
      const { data } = await supabase
        .from("pages")
        .select("id,title,slug,parent_id,type,icon,status")
        .eq("parent_id", folderId);
      setItems((data ?? []) as PageRow[]);
      setLoading(false);
      return;
    }

    setPickerOpenForId(null);
    setCustomIcon("");
    setPickerPosition(null);
  }

  function openIconPicker(e: React.MouseEvent, pageId: string) {
    e.preventDefault();
    e.stopPropagation();
    
    const button = e.currentTarget as HTMLButtonElement;
    const rect = button.getBoundingClientRect();
    
    // Hitung posisi popup
    const top = rect.bottom + window.scrollY + 8; // 8px margin
    const left = Math.min(
      rect.left + window.scrollX,
      window.innerWidth - 300 // Lebar popup + margin
    );
    
    setPickerPosition({ top, left });
    setPickerOpenForId(pickerOpenForId === pageId ? null : pageId);
    setCustomIcon("");
  }

  // Close picker on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerOpenForId && !(e.target as Element).closest('.icon-picker-popup')) {
        setPickerOpenForId(null);
        setPickerPosition(null);
        setCustomIcon("");
      }
    }

    if (pickerOpenForId) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [pickerOpenForId]);

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-sm font-semibold text-[var(--color-text)]">{title}</div>
        {!loading && <div className="text-xs text-[var(--color-muted)]">{items.length} item</div>}
      </div>

      {loading ? (
        <div className="text-sm text-[var(--color-muted)]">Loading...</div>
      ) : !items.length ? (
        <div className="rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] px-4 py-4 text-sm text-[var(--color-muted)]">
          Folder ini masih kosong.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((p) => {
            const m = meta(p.type);
            const shownIcon = (p.icon?.trim() ? p.icon : m.emoji) as string;
            const presets = [...(ICON_PRESETS[p.type] ?? []), ...ICON_PRESETS.general];
            const open = pickerOpenForId === p.id;

            return (
              <div key={p.id} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    router.push(`/p/${p.slug}`);
                    router.refresh();
                  }}
                  className={[
                    "group w-full text-left rounded-2xl border border-[var(--border-main)]",
                    "bg-[var(--bg-card)] hover:bg-[var(--bg-card)]/80",
                    "shadow-[0_10px_30px_rgba(0,0,0,0.10)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.30)]",
                    "transition overflow-hidden",
                    "focus:outline-none focus:ring-2 focus:ring-yellow-400/30",
                  ].join(" ")}
                >
                  <div className="p-4 flex items-start gap-3">
                    {/* Icon area (clickable without opening page) */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => openIconPicker(e, p.id)}
                        className="h-12 w-12 rounded-xl bg-[var(--bg-surface)] grid place-items-center text-2xl ring-1 ring-[var(--border-main)] hover:bg-[var(--sidebar-hover)]"
                        title="Ubah icon"
                      >
                        {shownIcon}
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-[15px] font-semibold text-[var(--color-text)] leading-snug truncate">{p.title}</div>

                        <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-semibold ${m.badge}`}>
                          {m.label}
                        </span>
                      </div>

                      <div className="mt-1 text-xs text-[var(--color-muted)] line-clamp-2">
                        Klik untuk membuka {p.type === "folder" ? "folder" : "page"} ini.
                      </div>
                    </div>
                  </div>

                  <div className="px-4 py-3 border-t border-[var(--border-main)] flex items-center justify-between">
                    <span className="text-xs text-[var(--color-muted)]">{p.status === "draft" ? "Draft" : "Published"}</span>
                    <span className="text-xs text-[var(--color-text)]/80 group-hover:text-[var(--color-text)]">Open →</span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Icon Picker Portal */}
      {pickerOpenForId && pickerPosition && (() => {
        const page = items.find(p => p.id === pickerOpenForId);
        if (!page) return null;
        
        const m = meta(page.type);
        const presets = [...(ICON_PRESETS[page.type] ?? []), ...ICON_PRESETS.general];

        return createPortal(
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-[9998] bg-transparent"
              onClick={() => {
                setPickerOpenForId(null);
                setPickerPosition(null);
                setCustomIcon("");
              }}
            />
            
            {/* Popup */}
            <div 
              className="icon-picker-popup fixed z-[9999] w-72 rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] shadow-2xl p-3"
              style={{
                top: `${pickerPosition.top}px`,
                left: `${pickerPosition.left}px`,
                maxWidth: 'calc(100vw - 16px)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-xs text-[var(--color-muted)] mb-2">Pilih icon</div>

              <div className="grid grid-cols-8 gap-1">
                {presets.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    className="h-9 w-9 rounded-lg hover:bg-[var(--sidebar-hover)] grid place-items-center text-lg transition-colors"
                    onClick={() => void updateIcon(pickerOpenForId, ic)}
                    title={ic}
                  >
                    {ic}
                  </button>
                ))}
              </div>

              <div className="h-px bg-[var(--border-main)] my-3" />

              <div className="text-xs text-[var(--color-muted)] mb-2">Custom (paste emoji sendiri)</div>
              <div className="flex gap-2">
                <input
                  value={customIcon}
                  onChange={(e) => setCustomIcon(e.target.value)}
                  placeholder="contoh: 🧾"
                  className="flex-1 rounded-md bg-[var(--bg-surface)] border border-[var(--border-main)] px-2 py-2 text-sm text-[var(--color-text)] outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const ic = customIcon.trim();
                      if (ic) void updateIcon(pickerOpenForId, ic);
                    }
                  }}
                />
                <button
                  type="button"
                  className="px-3 py-2 rounded-md text-sm border border-[var(--border-main)] hover:bg-[var(--sidebar-hover)] transition-colors"
                  onClick={() => {
                    const ic = customIcon.trim();
                    if (ic) void updateIcon(pickerOpenForId, ic);
                  }}
                >
                  Set
                </button>
              </div>

              <button
                type="button"
                className="mt-3 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
                onClick={() => void updateIcon(pickerOpenForId, null)}
              >
                Hapus icon
              </button>
            </div>
          </>,
          document.body
        );
      })()}
    </section>
  );
}