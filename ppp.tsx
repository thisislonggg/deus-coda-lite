"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

import AddMenu from "@/components/AddMenu"; // ✅ punyamu
import { AppRole, getMyRoleBrowser, canEdit } from "@/lib/role.client";

type PageType = "folder" | "doc" | "sop" | "report" | "calendar" | "link";

type PageRow = {
  id: string;
  title: string;
  slug: string;
  type: PageType;
  parent_id: string | null;
  status?: string | null;
  pinned?: boolean | null;
  external_url?: string | null;
};

type PageNode = PageRow & { children: PageNode[] };

function typeEmoji(t: PageType) {
  switch (t) {
    case "folder":
      return "📁";
    case "doc":
      return "📄";
    case "sop":
      return "📘";
    case "report":
      return "📊";
    case "calendar":
      return "📅";
    case "link":
      return "🔗";
    default:
      return "📄";
  }
}

function buildTree(rows: PageRow[]) {
  const map = new Map<string, PageNode>();
  rows.forEach((r) => map.set(r.id, { ...r, children: [] }));

  const roots: PageNode[] = [];
  rows.forEach((r) => {
    const node = map.get(r.id)!;
    if (r.parent_id) {
      const parent = map.get(r.parent_id);
      if (parent) parent.children.push(node);
      else roots.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortRec = (nodes: PageNode[]) => {
    nodes.sort((a, b) => {
      // folder dulu, lalu title
      if (a.type === "folder" && b.type !== "folder") return -1;
      if (a.type !== "folder" && b.type === "folder") return 1;
      return (a.title || "").localeCompare(b.title || "");
    });
    nodes.forEach((n) => sortRec(n.children));
  };

  sortRec(roots);
  return roots;
}

function isDescendant(node: PageNode, slug: string): boolean {
  if (node.slug === slug) return true;
  return node.children.some((c) => isDescendant(c, slug));
}

export default function SidebarTree() {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const router = useRouter();
  const pathname = usePathname();

  const activeSlug = useMemo(() => {
    const m = pathname?.match(/\/p\/([^/]+)/);
    return m?.[1] ?? null;
  }, [pathname]);

  const [role, setRole] = useState<AppRole>("viewer");
  const [myName, setMyName] = useState<string | null>(null);

  const [rows, setRows] = useState<PageRow[]>([]);
  const [query, setQuery] = useState("");

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const expandedRef = useRef(expanded);
  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  const allowEdit = canEdit(role);

  // ---- Load role + profile name
  useEffect(() => {
    (async () => {
      const r = await getMyRoleBrowser();
      setRole(r);

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      // 1) coba dari profiles
      if (user?.id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        const dbName = (prof?.full_name ?? "").trim();
        if (dbName) {
          setMyName(dbName);
          return;
        }
      }

      // 2) fallback user_metadata
      const metaName = (user?.user_metadata?.full_name ?? "").trim();
      setMyName(metaName || "User");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Load pages
  async function loadPages() {
    const { data, error } = await supabase
      .from("pages")
      .select("id,title,slug,type,parent_id,status,pinned,external_url")
      .order("title", { ascending: true });

    if (error) {
      console.warn(error.message);
      setRows([]);
      return;
    }

    setRows((data ?? []) as any);
  }

  useEffect(() => {
    void loadPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Auto expand folder kalau page aktif berada di dalam folder tsb
  useEffect(() => {
    if (!activeSlug || rows.length === 0) return;

    const tree = buildTree(rows);

    const next = { ...expandedRef.current };

    const dfs = (n: PageNode) => {
      if (n.type === "folder") {
        const hasActive = isDescendant(n, activeSlug);
        if (hasActive) next[n.id] = true;
      }
      n.children.forEach(dfs);
    };
    tree.forEach(dfs);

    setExpanded(next);
  }, [activeSlug, rows]);

  const pinnedPages = useMemo(
    () => rows.filter((r) => !!r.pinned && (!query.trim() || r.title.toLowerCase().includes(query.toLowerCase()))),
    [rows, query]
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.title ?? "").toLowerCase().includes(q));
  }, [rows, query]);

  const tree = useMemo(() => buildTree(filteredRows), [filteredRows]);

  async function onLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function toggleFolder(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // ---- Render Tree Node
  function Node({ node, depth }: { node: PageNode; depth: number }) {
    const isActive = activeSlug === node.slug;
    const isFolder = node.type === "folder";
    const isOpen = !!expanded[node.id];

    return (
      <div>
        <button
          type="button"
          onClick={() => {
            // ✅ folder click: tetap buka page foldernya
            router.push(`/p/${node.slug}`);
            router.refresh();

            // ✅ kalau folder, auto expand
            if (isFolder) setExpanded((p) => ({ ...p, [node.id]: true }));
          }}
          className={[
            "w-full text-left rounded-lg px-2.5 py-2 text-sm transition border flex items-center gap-2",
            isActive ? "text-white border-white/10" : "text-white/85 border-transparent hover:bg-white/10",
          ].join(" ")}
          style={{
            marginLeft: depth * 12,
            backgroundColor: isActive ? "rgba(241,196,15,0.14)" : undefined,
          }}
          title={node.title}
        >
          {/* caret */}
          {isFolder ? (
            <span
              className="text-white/60 select-none"
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(node.id);
              }}
              title={isOpen ? "Collapse" : "Expand"}
              style={{ width: 18, display: "inline-flex", justifyContent: "center" }}
            >
              {isOpen ? "▾" : "▸"}
            </span>
          ) : (
            <span style={{ width: 18 }} />
          )}

          <span className="text-white/70">{typeEmoji(node.type)}</span>
          <span className="flex-1 truncate">{node.title}</span>

          {node.status === "draft" && <span className="text-[10px] text-white/45">draft</span>}
        </button>

        {isFolder && isOpen && node.children.length > 0 && (
          <div className="mt-1 space-y-1">
            {node.children.map((c) => (
              <Node key={c.id} node={c} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className="h-screen flex flex-col bg-slate-950 text-white border-r border-white/10">
      {/* Header (sticky) */}
      <div
        className="sticky top-0 z-30 p-4 border-b backdrop-blur"
        style={{ borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(2,6,23,0.70)" }}
      >
        {/* Top row: Logo + Halo */}
        <div className="flex items-center justify-between gap-2">
          <Link href="/" className="min-w-0 flex items-center gap-3">
            <Image src="/Logo-Deus.webp" alt="Deus Code" width={72} height={72} priority />
            <div className="min-w-0">
              <div className="text-sm text-white/70 leading-tight">Halo,</div>
              <div className="text-base font-semibold text-white truncate max-w-[160px]">
                {myName ?? "User"}
              </div>
            </div>
          </Link>

          <button
            type="button"
            onClick={onLogout}
            className="text-sm px-2.5 py-1.5 rounded-md border border-white/15 hover:bg-white/10 shrink-0"
            title="Logout"
          >
            Logout
          </button>
        </div>

        {/* Search */}
        <div className="mt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages..."
            className="w-full rounded-md px-3 py-2 text-sm outline-none bg-white/10 border border-white/15 placeholder:text-white/50 focus:ring-2 focus:ring-yellow-400/30"
          />
        </div>

        {/* ✅ Add button dipindah ke bawah search (biar tidak nutup Halo) */}
        {allowEdit && (
          <div className="mt-3 flex justify-end">
            <div className="relative">
              <AddMenu
                // ✅ menu muncul ke kanan (pakai prop align kalau komponenmu support)
                // Kalau AddMenu kamu belum support, lihat catatan di bawah.
                align="right"
                side="right"
                onCreate={(kind: PageType) => {
                  // openCreate(null, kind) -> karena kamu punya fungsi ini di file lain,
                  // di SidebarTree biasanya kamu trigger modal create via state global / context.
                  // Jika AddMenu kamu sudah handle create sendiri, hapus baris ini.
                  // @ts-ignore
                  window.dispatchEvent(new CustomEvent("deus:create", { detail: { parentId: null, kind } }));
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Body scroll */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {/* Pinned */}
        {!!pinnedPages.length && (
          <div className="mb-3">
            <div className="text-xs text-white/50 px-2 mb-2 flex items-center gap-2">
              <span>⭐ Pinned</span>
            </div>
            <div className="space-y-1">
              {pinnedPages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    router.push(`/p/${p.slug}`);
                    router.refresh();
                  }}
                  className={[
                    "w-full text-left rounded-lg px-2.5 py-2 text-sm transition border flex items-center gap-2",
                    activeSlug === p.slug
                      ? "text-white border-white/10"
                      : "text-white/85 border-transparent hover:bg-white/10",
                  ].join(" ")}
                  style={{
                    backgroundColor: activeSlug === p.slug ? "rgba(241,196,15,0.14)" : undefined,
                  }}
                  title={p.title}
                >
                  <span className="text-white/70">{typeEmoji(p.type as any)}</span>
                  <span className="flex-1 truncate">{p.title}</span>
                  <span className="text-xs text-white/40">📌</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pages title */}
        <div className="text-xs text-white/50 px-2 mb-2">Pages</div>

        {/* Tree */}
        <div className="space-y-1">
          {tree.map((n) => (
            <Node key={n.id} node={n} depth={0} />
          ))}
        </div>
      </div>
    </aside>
  );
}
