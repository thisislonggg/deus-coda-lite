"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

type PageType = "folder" | "doc" | "sop" | "report" | "calendar";
type PageRow = {
  id: string;
  title: string;
  slug: string;
  parent_id: string | null;
  type: PageType;
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
  }
}

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

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      let q = supabase
        .from("pages")
        .select("id,title,slug,parent_id,type,status")
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

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  router.push(`/p/${p.slug}`);
                  router.refresh();
                }}
                className={[
                  "group text-left rounded-2xl border border-white/10",
                  "bg-slate-900/60 hover:bg-slate-900/80",
                  "shadow-[0_10px_30px_rgba(0,0,0,0.30)]",
                  "transition overflow-hidden",
                  "focus:outline-none focus:ring-2 focus:ring-yellow-400/30",
                ].join(" ")}
              >
                <div className="p-4 flex items-start gap-3">
                  <div className="h-12 w-12 rounded-xl bg-slate-800 grid place-items-center text-2xl ring-1 ring-white/10">
                    {m.emoji}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[15px] font-semibold text-white leading-snug truncate">
                        {p.title}
                      </div>

                      <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full ${m.badge}`}>
                        {m.label}
                      </span>
                    </div>

                    <div className="mt-1 text-xs text-white/60 line-clamp-2">
                      Klik untuk membuka {p.type === "folder" ? "folder" : "page"} ini.
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs text-white/60">
                    {p.status === "draft" ? "Draft" : "Published"}
                  </span>
                  <span className="text-xs text-white/80 group-hover:text-white">
                    Open →
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
