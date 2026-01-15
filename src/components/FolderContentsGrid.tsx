"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

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
      return { emoji: "📁", label: "Folder", badge: "bg-slate-700/60 text-white" };
    case "sop":
      return { emoji: "📘", label: "SOP", badge: "bg-yellow-400/20 text-yellow-100" };
    case "doc":
      return { emoji: "📄", label: "Doc", badge: "bg-slate-700/60 text-white" };
    case "report":
      return { emoji: "📊", label: "Report", badge: "bg-blue-500/20 text-blue-100" };
    case "calendar":
      return { emoji: "📅", label: "Calendar", badge: "bg-emerald-500/20 text-emerald-100" };
    case "link":
      return { emoji: "🔗", label: "Link", badge: "bg-purple-500/20 text-purple-100" };
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
  }

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-sm font-semibold text-white/90">{title}</div>
        {!loading && <div className="text-xs text-white/60">{items.length} item</div>}
      </div>

      {loading ? (
        <div className="text-sm text-white/70">Loading...</div>
      ) : !items.length ? (
        <div className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-4 text-sm text-white/70">
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
                    "group w-full text-left rounded-2xl border border-white/10",
                    "bg-slate-900/60 hover:bg-slate-900/80",
                    "shadow-[0_10px_30px_rgba(0,0,0,0.30)]",
                    "transition overflow-hidden",
                    "focus:outline-none focus:ring-2 focus:ring-yellow-400/30",
                  ].join(" ")}
                >
                  <div className="p-4 flex items-start gap-3">
                    {/* Icon area (clickable without opening page) */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPickerOpenForId((cur) => (cur === p.id ? null : p.id));
                          setCustomIcon("");
                        }}
                        className="h-12 w-12 rounded-xl bg-slate-800 grid place-items-center text-2xl ring-1 ring-white/10 hover:bg-slate-800/80"
                        title="Ubah icon"
                      >
                        {shownIcon}
                      </button>

                      {/* Picker popover */}
                      {open && (
                        <div
                          className="absolute z-50 mt-2 w-72 rounded-2xl border border-white/10 bg-slate-950 shadow-xl p-3"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          <div className="text-xs text-white/60 mb-2">Pilih icon</div>

                          <div className="grid grid-cols-8 gap-1">
                            {presets.map((ic) => (
                              <button
                                key={ic}
                                type="button"
                                className="h-9 w-9 rounded-lg hover:bg-white/10 grid place-items-center text-lg"
                                onClick={() => void updateIcon(p.id, ic)}
                                title={ic}
                              >
                                {ic}
                              </button>
                            ))}
                          </div>

                          <div className="h-px bg-white/10 my-3" />

                          <div className="text-xs text-white/60 mb-2">Custom (paste emoji sendiri)</div>
                          <div className="flex gap-2">
                            <input
                              value={customIcon}
                              onChange={(e) => setCustomIcon(e.target.value)}
                              placeholder="contoh: 🧾"
                              className="flex-1 rounded-md bg-white/5 border border-white/10 px-2 py-2 text-sm text-white outline-none"
                            />
                            <button
                              type="button"
                              className="px-3 py-2 rounded-md text-sm border border-white/10 hover:bg-white/10"
                              onClick={() => {
                                const ic = customIcon.trim();
                                if (ic) void updateIcon(p.id, ic);
                              }}
                            >
                              Set
                            </button>
                          </div>

                          <button
                            type="button"
                            className="mt-3 text-xs text-white/60 hover:text-white"
                            onClick={() => void updateIcon(p.id, null)}
                          >
                            Hapus icon
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-[15px] font-semibold text-white leading-snug truncate">{p.title}</div>

                        <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full ${m.badge}`}>{m.label}</span>
                      </div>

                      <div className="mt-1 text-xs text-white/60 line-clamp-2">
                        Klik untuk membuka {p.type === "folder" ? "folder" : "page"} ini.
                      </div>
                    </div>
                  </div>

                  <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs text-white/60">{p.status === "draft" ? "Draft" : "Published"}</span>
                    <span className="text-xs text-white/80 group-hover:text-white">Open →</span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
