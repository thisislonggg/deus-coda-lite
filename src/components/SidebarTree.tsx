"use client";

import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import { AppRole, getMyRoleBrowser, canEdit } from "@/lib/role.client";
import { getMyNameBrowser } from "@/lib/profile.client";

type PageType = "folder" | "doc" | "sop" | "report" | "calendar" | "link";

type PageRow = {
  id: string;
  title: string;
  slug: string;
  type: PageType;
  parent_id: string | null;
  icon?: string | null; // custom emoji/icon
  status?: string | null;
  pinned?: boolean | null;
  external_url?: string | null;
};

type PageNode = PageRow & { children: PageNode[] };

type CreateKind = "sop" | "doc" | "report" | "calendar" | "folder" | "link";

type CtxTarget = { kind: "page" | "folder"; node: PageNode };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function defaultIconByType(t: PageType) {
  if (t === "folder") return "📁";
  if (t === "sop") return "📘";
  if (t === "calendar") return "📅";
  if (t === "report") return "📊";
  if (t === "link") return "🔗";
  return "📄";
}

function getNodeIcon(icon: string | null | undefined, type: PageType) {
  const trimmed = (icon ?? "").trim();
  return trimmed ? trimmed : defaultIconByType(type);
}

function kindMeta(kind: CreateKind) {
  switch (kind) {
    case "sop":
      return { label: "SOP", emoji: "📘", desc: "Standar prosedur kerja", accent: "rgba(241,196,15,0.18)" };
    case "doc":
      return { label: "Doc", emoji: "📄", desc: "Dokumen umum / catatan", accent: "rgba(255,255,255,0.10)" };
    case "report":
      return { label: "Report", emoji: "📊", desc: "Laporan & insight", accent: "rgba(59,130,246,0.18)" };
    case "calendar":
      return { label: "Calendar", emoji: "📅", desc: "Jadwal / timeline", accent: "rgba(16,185,129,0.18)" };
    case "folder":
      return { label: "Folder", emoji: "📁", desc: "Kelompokkan halaman", accent: "rgba(255,255,255,0.08)" };
    case "link":
      return { label: "Link", emoji: "🔗", desc: "Google Docs/Sheets/URL", accent: "rgba(255,255,255,0.08)" };
  }
}

function buildTree(rows: PageRow[]) {
  const map = new Map<string, PageNode>();
  rows.forEach((r) => map.set(r.id, { ...r, children: [] }));

  const roots: PageNode[] = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortRec = (arr: PageNode[]) => {
    arr.sort((a, b) => {
      const aIsFolder = a.type === "folder";
      const bIsFolder = b.type === "folder";
      if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
      return (a.title ?? "").localeCompare(b.title ?? "");
    });
    arr.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);

  return { roots, map };
}

function findPathIds(map: Map<string, PageNode>, activeSlug: string | null) {
  if (!activeSlug) return [];
  const target = [...map.values()].find((n) => n.slug === activeSlug);
  if (!target) return [];
  const path: string[] = [];
  let cur: PageNode | undefined = target;
  while (cur) {
    path.push(cur.id);
    if (!cur.parent_id) break;
    cur = map.get(cur.parent_id);
  }
  return path;
}

function pageUrl(slug: string) {
  if (typeof window === "undefined") return `/p/${slug}`;
  return `${window.location.origin}/p/${slug}`;
}

async function safeCopy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

function TreeList({
  nodes,
  expanded,
  onToggle,
  activeSlug,
  level,
  canEdit,
  onAdd,
  onDelete,
  onNavigate,
  onContextMenuNode,
}: {
  nodes: PageNode[];
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
  activeSlug: string | null;
  level: number;
  canEdit: boolean;
  onAdd: (parentId: string | null) => void;
  onDelete: (node: PageNode) => void;
  onNavigate: (slug: string) => void;
  onContextMenuNode: (e: React.MouseEvent, node: PageNode) => void;
}) {
  if (!nodes.length) return <div className="text-xs text-[var(--sidebar-text-muted)] px-2 py-2">No pages.</div>;

  return (
    <div className="space-y-1">
      {nodes.map((n) => {
        const isOpen = expanded[n.id] ?? false;
        const hasChildren = (n.children?.length ?? 0) > 0;
        const isActive = activeSlug === n.slug;
        const isFolder = n.type === "folder";
        const icon = getNodeIcon(n.icon, n.type);

        return (
          <div key={n.id}>
            <div
              onContextMenu={(e) => onContextMenuNode(e, n)}
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest("[data-action]") || target.closest("[data-toggle]")) return;
                onNavigate(n.slug);
              }}
              className={[
                "group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition border select-none cursor-pointer",
                isActive 
                  ? "text-[var(--sidebar-text)] border-[var(--sidebar-border)]" 
                  : "text-[var(--sidebar-text)] opacity-85 border-transparent hover:bg-[var(--sidebar-hover)]",
              ].join(" ")}
              style={{ 
                paddingLeft: 10 + level * 14, 
                backgroundColor: isActive ? "var(--sidebar-active)" : undefined 
              }}
            >
              {/* CARET: only if expandable; otherwise empty spacer */}
              {isFolder && hasChildren ? (
                <button
                  type="button"
                  data-toggle="1"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(n.id); }}
                  className="h-5 w-5 rounded-md hover:bg-[var(--sidebar-hover)] grid place-items-center"
                  title={isOpen ? "Collapse" : "Expand"}
                >
                  <span className="text-[var(--sidebar-text)] opacity-80 text-xs">{isOpen ? "▾" : "▸"}</span>
                </button>
              ) : (
                <span className="h-5 w-5 inline-block" />
              )}

              {/* ICON only (no dot) */}
              <span className="text-[var(--sidebar-text)] opacity-70">{icon}</span>

              <button
                type="button"
                data-action="title"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onNavigate(n.slug); }}
                className="flex-1 text-left truncate"
                title={n.title}
              >
                {n.title}
              </button>

              <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
                {canEdit && isFolder && (
                  <button
                    data-action="add"
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(n.id); if (!isOpen) onToggle(n.id); }}
                    className="text-xs px-2 py-1 rounded-md hover:bg-[var(--sidebar-hover)]"
                    style={{ color: "rgb(var(--dc-primary))" }}
                  >
                    + Add
                  </button>
                )}
                {canEdit && (
                  <button
                    data-action="delete"
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(n); }}
                    className="text-xs px-2 py-1 rounded-md hover:bg-[var(--sidebar-hover)] text-red-500 dark:text-red-300"
                  >
                    Del
                  </button>
                )}
              </div>
            </div>

            {isFolder && hasChildren && isOpen && (
              <div className="mt-1">
                <TreeList
                  nodes={n.children}
                  expanded={expanded}
                  onToggle={onToggle}
                  activeSlug={activeSlug}
                  level={level + 1}
                  canEdit={canEdit}
                  onAdd={onAdd}
                  onDelete={onDelete}
                  onNavigate={onNavigate}
                  onContextMenuNode={onContextMenuNode}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CtxSep() { return <div className="my-1 border-t border-white/10" />; }

function CtxItem({ label, subLabel, icon, danger, onClick }: { label: string; subLabel?: string; icon?: string; danger?: boolean; onClick: () => void; }) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition flex items-start gap-2 ${danger ? "text-red-500 dark:text-red-300" : "text-[var(--color-text)]"}`}>
      <div className="w-6 shrink-0 text-center">{icon ?? ""}</div>
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {subLabel && <div className="text-[11px] text-[var(--color-muted)] -mt-0.5">{subLabel}</div>}
      </div>
    </button>
  );
}

function AddNewModal({ open, onClose, children }: any) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[99999]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-[100000] flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export default function SidebarTree({ showDrafts = true }: { showDrafts?: boolean }) {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const router = useRouter();
  const pathname = usePathname();
  
  // Tambahkan di dalam komponen SidebarTree, setelah state lainnya
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Fungsi untuk mengecek apakah tema dark
    const checkDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    };

    // Jalankan sekali di mount
    checkDarkMode();

    // Observasi perubahan class di elemen html
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const activeSlug = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    const pIndex = parts.indexOf("p");
    if (pIndex >= 0 && parts[pIndex + 1]) return parts[pIndex + 1];
    return null;
  }, [pathname]);

  const [role, setRole] = useState<AppRole>("viewer");
  const [myName, setMyName] = useState<string | null>(null);

  const [rows, setRows] = useState<PageRow[]>([]);
  const [roots, setRoots] = useState<PageNode[]>([]);
  const [idMap, setIdMap] = useState<Map<string, PageNode>>(new Map());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");

  const [pinIds, setPinIds] = useState<Set<string>>(new Set());

  const [isOpen, setIsOpen] = useState(false);
  const [createType, setCreateType] = useState<CreateKind>("sop");
  const [createTitle, setCreateTitle] = useState("");
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [createUrl, setCreateUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTitle, setDeleteTitle] = useState<string>("");
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const [ctxOpen, setCtxOpen] = useState(false);
  const [ctxPos, setCtxPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [ctxTarget, setCtxTarget] = useState<CtxTarget | null>(null);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameErr, setRenameErr] = useState<string | null>(null);

  async function loadRole() {
    const r = await getMyRoleBrowser();
    setRole(r);
  }

  async function loadMyName() {
    const n = await getMyNameBrowser();
    setMyName(n);
  }

  async function loadPages() {
    const q = supabase
      .from("pages")
      .select("id,title,slug,parent_id,type,icon,status,external_url")
      .order("title", { ascending: true });

    const { data, error } = await q;
    if (error) return console.error(error);

    const list = (data ?? []) as PageRow[];
    setRows(list);
    const { roots, map } = buildTree(list);
    setRoots(roots);
    setIdMap(map);
  }

  async function loadPins() {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) return;
    const { data, error } = await supabase.from("page_pins").select("page_id").eq("user_id", uid);
    if (error) return;
    setPinIds(new Set<string>((data ?? []).map((x: any) => x.page_id as string)));
  }

  async function togglePin(pageId: string) {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) return;

    const next = new Set(pinIds);
    if (next.has(pageId)) {
      const { error } = await supabase.from("page_pins").delete().eq("user_id", uid).eq("page_id", pageId);
      if (!error) next.delete(pageId);
    } else {
      const { error } = await supabase.from("page_pins").insert({ user_id: uid, page_id: pageId });
      if (!error) next.add(pageId);
    }
    setPinIds(next);
  }

  useEffect(() => {
    loadRole();
    loadMyName();
    loadPages();
    loadPins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeSlug || idMap.size === 0) return;
    const pathIds = findPathIds(idMap, activeSlug);
    if (!pathIds.length) return;
    setExpanded((prev) => {
      const next = { ...prev };
      pathIds.forEach((id) => (next[id] = true));
      return next;
    });
  }, [activeSlug, idMap]);

  const filteredRoots = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roots;
    const filterNode = (n: PageNode): PageNode | null => {
      const selfMatch = (n.title ?? "").toLowerCase().includes(q);
      const kids = n.children.map(filterNode).filter(Boolean) as PageNode[];
      if (selfMatch || kids.length) return { ...n, children: kids };
      return null;
    };
    return roots.map(filterNode).filter(Boolean) as PageNode[];
  }, [roots, query]);

  const pinnedPages = useMemo(() => {
    const mapById = new Map<string, PageRow>();
    rows.forEach((r) => mapById.set(r.id, r));
    const items = [...pinIds].map((id) => mapById.get(id)).filter(Boolean) as PageRow[];
    return items.filter((x) => x.type !== "folder").sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
  }, [pinIds, rows]);

  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !(p[id] ?? false) }));

  async function onLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function openCreate(parentId: string | null, kind: CreateKind = "sop") {
    setCreateParentId(parentId);
    setCreateTitle("");
    setCreateType(kind);
    setCreateUrl("");
    setCreateErr(null);
    setIsOpen(true);
  }

  async function handleCreate() {
    if (!canEdit(role)) return setCreateErr("Anda tidak punya izin membuat page/folder.");
    const t = createTitle.trim();
    if (!t) return setCreateErr("Judul tidak boleh kosong.");
    if (createType === "link") {
      const u = createUrl.trim();
      if (!u) return setCreateErr("URL tidak boleh kosong untuk Link.");
      try { new URL(u); } catch { return setCreateErr("URL tidak valid."); }
    }

    setCreating(true);
    setCreateErr(null);

    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) {
      setCreating(false);
      return setCreateErr("Session hilang. Login ulang.");
    }

    const baseSlug = t.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");
    const exists = rows.some((r) => r.slug === baseSlug);
    const finalSlug = exists ? `${baseSlug}-${Math.random().toString(16).slice(2, 6)}` : baseSlug;

    const finalType: PageType = createType === "folder" ? "folder" : (createType as PageType);

    const insertPayload: any = {
      title: t,
      slug: finalSlug,
      parent_id: createParentId,
      type: finalType,
      status: showDrafts ? "draft" : "published",
      created_by: uid,
      updated_by: uid,
      external_url: createType === "link" ? createUrl.trim() : null,
    };

    const { data, error } = await supabase.from("pages").insert(insertPayload).select("id,slug,type").maybeSingle();
    setCreating(false);
    if (error) return setCreateErr(error.message);

    setIsOpen(false);
    await loadPages();
    if (data?.slug) { router.push(`/p/${data.slug}`); router.refresh(); }
    if (data?.id) setExpanded((p) => ({ ...p, [data.id]: true }));
  }

  function openDelete(node: PageNode) {
    setDeleteId(node.id);
    setDeleteTitle(node.title);
    setDeleteErr(null);
  }

  async function handleDeleteConfirm() {
    if (!deleteId) return;
    if (!canEdit(role)) return setDeleteErr("Anda tidak punya izin delete.");
    setDeleting(true);
    setDeleteErr(null);

    const node = idMap.get(deleteId);
    if (node?.type === "folder" && node.children?.length) {
      setDeleting(false);
      return setDeleteErr("Folder masih punya isi.");
    }

    const { error } = await supabase.from("pages").delete().eq("id", deleteId);
    setDeleting(false);
    if (error) return setDeleteErr(error.message);

    setDeleteId(null);
    setDeleteTitle("");
    await loadPages();
    if (activeSlug && node?.slug === activeSlug) {
      router.push("/p/deus-code");
      router.refresh();
    }
  }

  function openContextMenu(e: React.MouseEvent, node: PageNode) {
    e.preventDefault();
    e.stopPropagation();
    const target: CtxTarget = node.type === "folder" ? { kind: "folder", node } : { kind: "page", node };
    const MENU_W = 260, MENU_H = 360, pad = 8;
    const x = clamp(e.clientX, pad, window.innerWidth - MENU_W - pad);
    const y = clamp(e.clientY, pad, window.innerHeight - MENU_H - pad);
    setCtxPos({ x, y });
    setCtxTarget(target);
    setCtxOpen(true);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setCtxOpen(false);
        setCtxTarget(null);
        setRenameOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function startRename(title: string) {
    setRenameValue(title ?? "");
    setRenameErr(null);
    setRenameOpen(true);
    setCtxOpen(false);
  }

  async function confirmRename() {
    if (!ctxTarget || !canEdit(role)) return;
    const newTitle = renameValue.trim();
    if (!newTitle) return setRenameErr("Nama tidak boleh kosong.");
    setRenameBusy(true);
    setRenameErr(null);
    const { error } = await supabase.from("pages").update({ title: newTitle }).eq("id", ctxTarget.node.id);
    setRenameBusy(false);
    if (error) return setRenameErr(error.message);
    setRenameOpen(false);
    await loadPages();
  }

  async function copyLink(slug: string) {
    await safeCopy(pageUrl(slug));
  }

  function openNewTab(slug: string) {
    window.open(pageUrl(slug), "_blank", "noopener,noreferrer");
  }
const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <aside className="shrink-0 w-[320px] overflow-hidden border-r h-screen"
      style={{
        borderColor: 'var(--sidebar-border)',
        background: 'var(--sidebar-bg)',
        zIndex: 10,
        top: 0,
      }}>
        <div className="sticky top-0 z-20 p-4  bg-[var(--sidebar-bg)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-3">
              <Link href="/p/deus-code" className="shrink-0">
                {isDarkMode ? (
                  <Image 
                    src="/logo-deus.webp" 
                    alt="Deus Code" 
                    width={72} 
                    height={72} 
                    priority 
                  />
                ) : (
                  <Image 
                    src="/logo-deus-dark.webp" 
                    alt="Deus Code" 
                    width={72} 
                    height={72} 
                    priority 
                  />
                )}
              </Link>
          <div className="min-w-0 leading-tight ml-2.5">
            <div className="text-xs text-[var(--sidebar-text-muted)]">
              Halo,
            </div>
            <div
              className="text-sm font-semibold text-[var(--sidebar-text)] break-words"
              style={{ maxWidth: 200 }}
              title={myName ?? "User"}
            >
              {myName ?? "User"}
            </div>
          </div>


    <div className="relative shrink-0 relative shrink-0 ml-16.5">
  <button
    type="button"
    onClick={() => setUserMenuOpen(v => !v)}
    className="h-9 w-9 rounded-full border border-[var(--sidebar-border)] bg-[var(--sidebar-hover)] flex items-center justify-center text-sm font-semibold text-[var(--sidebar-text)]"
      style={{
    backgroundColor: "var(--bg-initial)",
    color: "var(--popup-initial)",
  }}
    title="User menu"
  >
    {(myName ?? "U").charAt(0).toUpperCase()}
  </button>

  {userMenuOpen && (
    <>
      {/* click outside */}
      <div
        className="fixed inset-0 z-40"
        onClick={() => setUserMenuOpen(false)}
      />

      {/* dropdown */}
      <div
  className="absolute right-0 mt-2 w-40 rounded-xl border border-[var(--sidebar-border)] shadow-xl"
  style={{
    backgroundColor: "var(--bg-popup)",
    color: "var(--popup-text)",
  }}
>
        <Link
          href="/profile"
          className="block px-4 py-2 text-sm hover:bg-[var(--sidebar-hover)] text-[var(--sidebar-text)]"
          onClick={() => setUserMenuOpen(false)}
        >
          Profile
        </Link>

        <button
          type="button"
          onClick={() => {
            setUserMenuOpen(false);
            onLogout();
          }}
          className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-[var(--sidebar-hover)]"
        >
          Logout
        </button>
      </div>
    </>
  )}
</div>

            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex-1">
              <input 
                value={query} 
                onChange={(e) => setQuery(e.target.value)} 
                placeholder="Search pages..." 
                className="w-full rounded-md px-3 py-2 text-sm outline-none bg-[var(--sidebar-hover)] border border-[var(--sidebar-border)] placeholder:text-[var(--sidebar-text-muted)] focus:ring-2 text-[var(--sidebar-text)]" 
                style={{ boxShadow: "0 0 0 2px rgba(241,196,15,0.12)" }} 
              />
            </div>
            {canEdit(role) && (<div className="shrink-0"><AddMenu onCreate={(kind) => openCreate(null, kind)} /></div>)}
          </div>
        </div>

        <div className="h-[calc(100vh-132px)] overflow-y-auto px-3 py-3" style={{ color: 'var(--sidebar-text)' }}>
          {!!pinnedPages.length && (
            <div className="mb-3">
              <div className="text-xs text-[var(--sidebar-text)] px-2 mb-2 flex items-center gap-2"><span>⭐ Pinned</span></div>
              <div className="space-y-1">
                {pinnedPages.map((p) => (
                  <button key={p.id} type="button"
                    onClick={() => { router.push(`/p/${p.slug}`); router.refresh(); }}
                    onContextMenu={(e) => { const n: PageNode = { ...(p as any), children: [] }; openContextMenu(e, n); }}
                    className={[
                      "w-full text-left rounded-lg px-2.5 py-2 text-sm transition border flex items-center gap-2", 
                      activeSlug === p.slug 
                        ? "text-[var(--sidebar-text)] border-[var(--sidebar-border)]" 
                        : "text-[var(--sidebar-text)] opacity-85 border-transparent hover:bg-[var(--sidebar-hover)]"
                    ].join(" ")}
                    style={{ backgroundColor: activeSlug === p.slug ? 'var(--sidebar-active)' : undefined }}
                    title={p.title}>
                    <span className="text-[var(--sidebar-text)] opacity-70">{getNodeIcon(p.icon, p.type)}</span>
                    <span className="flex-1 truncate">{p.title}</span>
                    <span className="text-xs text-[var(--sidebar-text)]">📌</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-[var(--sidebar-text)] px-2 mb-2">Pages</div>

          <TreeList
            nodes={filteredRoots}
            expanded={expanded}
            onToggle={toggle}
            activeSlug={activeSlug}
            level={0}
            canEdit={canEdit(role)}
            onAdd={(parentId) => openCreate(parentId)}
            onDelete={(node) => openDelete(node)}
            onNavigate={(slug) => { router.push(`/p/${slug}`); router.refresh(); }}
            onContextMenuNode={openContextMenu}
          />
        </div>

        <AddNewModal open={isOpen && canEdit(role)} onClose={() => !creating && setIsOpen(false)}>
          <div className="p-4 border-b border-white/10">
            <div className="text-sm font-semibold">Add New</div>
            <div className="text-xs text-white/60 mt-1">{createParentId ? "Create inside folder" : "Create at root"}</div>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(["sop", "doc", "report", "calendar", "folder", "link"] as CreateKind[]).map((k) => {
                const m = kindMeta(k);
                const active = createType === k;
                return (
                  <button key={k} type="button" onClick={() => setCreateType(k)}
                    className={`rounded-lg px-3 py-3 text-sm border text-left flex items-center gap-3 ${active ? "border-yellow-400/60" : "border-white/10"}`}
                    style={{ backgroundColor: active ? "rgba(241,196,15,0.12)" : "rgba(255,255,255,0.04)" }}>
                    <span className="text-lg">{m.emoji}</span>
                    <span className="min-w-0">
                      <div className="font-semibold leading-tight">{m.label}</div>
                      <div className="text-xs text-white/60 truncate">{m.desc}</div>
                    </span>
                  </button>
                );
              })}
            </div>
            <input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)}
              placeholder={createType === "folder" ? "Nama folder..." : "Judul page..."}
              className="w-full rounded-md px-3 py-2 text-sm outline-none bg-white/5 border border-white/10 placeholder:text-white/40 focus:ring-2"
              style={{ boxShadow: "0 0 0 2px rgba(241,196,15,0.10)" }} />
            {createType === "link" && (
              <input value={createUrl} onChange={(e) => setCreateUrl(e.target.value)}
                placeholder="https://docs.google.com/... atau https://..."
                className="w-full rounded-md px-3 py-2 text-sm outline-none bg-white/5 border border-white/10 placeholder:text-white/40 focus:ring-2"
                style={{ boxShadow: "0 0 0 2px rgba(241,196,15,0.10)" }} />
            )}
            {createErr && <div className="text-xs text-red-300">{createErr}</div>}
          </div>
          <div className="p-4 border-t border-white/10 flex justify-end gap-2">
            <button type="button" onClick={() => setIsOpen(false)} disabled={creating}
              className="px-3 py-2 text-sm rounded-md border border-white/15 hover:bg-white/10 disabled:opacity-60">Cancel</button>
            <button type="button" onClick={handleCreate} disabled={creating}
              className="px-3 py-2 text-sm rounded-md font-semibold disabled:opacity-60"
              style={{ backgroundColor: "rgb(var(--dc-primary))", color: "rgb(var(--dc-dark))" }}>
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </AddNewModal>

        {!!deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => !deleting && setDeleteId(null)} />
            <div className="relative w-full max-w-md rounded-xl border border-white/10 bg-neutral-950 text-white shadow-xl">
              <div className="p-4 border-b border-white/10">
                <div className="text-sm font-semibold">Delete</div>
                <div className="text-xs text-white/60 mt-1">Hapus: "{deleteTitle}"</div>
              </div>
              <div className="p-4 space-y-2">
                <div className="text-sm text-white/75">Ini akan menghapus item permanen. Kalau folder, pastikan kosong dulu.</div>
                {deleteErr && <div className="text-xs text-red-300">{deleteErr}</div>}
              </div>
              <div className="p-4 border-t border-white/10 flex justify-end gap-2">
                <button type="button" onClick={() => setDeleteId(null)} disabled={deleting}
                  className="px-3 py-2 text-sm rounded-md border border-white/15 hover:bg-white/10 disabled:opacity-60">Cancel</button>
                <button type="button" onClick={handleDeleteConfirm} disabled={deleting}
                  className="px-3 py-2 text-sm rounded-md font-semibold disabled:opacity-60"
                  style={{ backgroundColor: "rgb(239 68 68)", color: "var(--text-main)" }}>{deleting ? "Deleting..." : "Delete"}</button>
              </div>
            </div>
          </div>
        )}

        {ctxOpen && ctxTarget &&
          createPortal(
            <>
              {/* backdrop */}
              <div
                className="fixed inset-0 z-[9998]"
                onClick={() => {
                  setCtxOpen(false);
                  setCtxTarget(null);
                }}
              />

              {/* context menu */}
              <div
                className="popup-surface fixed z-[9999] w-[260px] rounded-xl border border-white/10 shadow-xl overflow-hidden"
                style={{
                  left: ctxPos.x,
                  top: ctxPos.y,
                  background: "linear-gradient(180deg, rgba(20,20,20,0.98), rgba(2,6,23,0.98))",
                  color: "var(--text-main)",
                }}
              >
                <div className="px-3 py-2 border-b border-white/10">
                  <div className="flex items-center gap-1.5 text-xs text-white/60 min-w-0">
                    <span className="shrink-0">
                      {getNodeIcon(ctxTarget.node.icon, ctxTarget.node.type)}
                    </span>
                    <span className="truncate">{ctxTarget.node.title}</span>
                  </div>
                </div>

                <div className="p-1">
                  {ctxTarget.kind === "folder" && canEdit(role) && (
                    <>
                      <CtxItem
                        label="Add subpage"
                        subLabel="Buat page di dalam folder"
                        icon="➕"
                        onClick={() => {
                          setCtxOpen(false);
                          openCreate(ctxTarget.node.id, "sop");
                        }}
                      />
                      <CtxItem
                        label="Add folder"
                        subLabel="Buat folder di dalam folder"
                        icon="📁"
                        onClick={() => {
                          setCtxOpen(false);
                          openCreate(ctxTarget.node.id, "folder");
                        }}
                      />
                      <CtxSep />
                    </>
                  )}

                  {ctxTarget.kind === "page" && (
                    <>
                      <CtxItem
                        label={pinIds.has(ctxTarget.node.id) ? "Unpin" : "Pin"}
                        subLabel="Simpan di Pinned"
                        icon="📌"
                        onClick={() => {
                          setCtxOpen(false);
                          void togglePin(ctxTarget.node.id);
                        }}
                      />
                      <CtxSep />
                    </>
                  )}

                  {canEdit(role) && (
                    <CtxItem
                      label="Rename"
                      subLabel="Ubah nama"
                      icon="✏️"
                      onClick={() => startRename(ctxTarget.node.title)}
                    />
                  )}

                  <CtxItem
                    label="Copy link"
                    subLabel="Salin URL"
                    icon="🔗"
                    onClick={() => {
                      setCtxOpen(false);
                      void copyLink(ctxTarget.node.slug);
                    }}
                  />

                  <CtxItem
                    label="Open in new tab"
                    subLabel="Buka tab baru"
                    icon="🗂️"
                    onClick={() => {
                      setCtxOpen(false);
                      openNewTab(ctxTarget.node.slug);
                    }}
                  />

                  <CtxSep />

                  {canEdit(role) && (
                    <CtxItem
                      label="Delete"
                      subLabel="Hapus permanen"
                      icon="🗑️"
                      danger
                      onClick={() => {
                        setCtxOpen(false);
                        openDelete(ctxTarget.node);
                      }}
                    />
                  )}
                </div>
              </div>
            </>,
            document.body
          )
        }

        {renameOpen && ctxTarget && canEdit(role) && (
          <div className="fixed inset-0 z-[95] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => !renameBusy && setRenameOpen(false)} />
            <div className="relative w-full max-w-sm rounded-xl border border-white/10 bg-neutral-950 text-white shadow-xl">
              <div className="p-4 border-b border-white/10">
                <div className="text-sm font-semibold">Rename</div>
                <div className="text-xs text-white/60 mt-1">Ubah nama: {ctxTarget.node.title}</div>
              </div>
              <div className="p-4 space-y-2">
                <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                  className="w-full rounded-md px-3 py-2 text-sm outline-none bg-white/5 border border-white/10 placeholder:text-white/40 focus:ring-2"
                  style={{ boxShadow: "0 0 0 2px rgba(241,196,15,0.10)" }} autoFocus />
                {renameErr && <div className="text-xs text-red-300">{renameErr}</div>}
              </div>
              <div className="p-4 border-t border-white/10 flex justify-end gap-2">
                <button type="button" onClick={() => setRenameOpen(false)} disabled={renameBusy}
                  className="px-3 py-2 text-sm rounded-md border border-white/15 hover:bg-white/10 disabled:opacity-60">Cancel</button>
                <button type="button" onClick={confirmRename} disabled={renameBusy}
                  className="px-3 py-2 text-sm rounded-md font-semibold disabled:opacity-60"
                  style={{ backgroundColor: "rgb(var(--dc-primary))", color: "rgb(var(--dc-dark))" }}>{renameBusy ? "Saving..." : "Save"}</button>
              </div>
            </div>
          </div>
        )}
    </aside>
  );
}

function AddMenu({ onCreate }: { onCreate: (kind: CreateKind) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [mounted, setMounted] = useState(false);

  const items: CreateKind[] = ["sop", "doc", "report", "calendar", "folder", "link"];

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter((k) => {
      const m = kindMeta(k);
      const s = `${m.label} ${m.desc}`.toLowerCase();
      return s.includes(qq);
    });
  }, [q]);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function recompute() {
      const btn = btnRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const PANEL_W = 360, PANEL_H = 420, gap = 10, pad = 8;
      let left = r.right + gap;
      let top = r.top;
      top = Math.max(pad, Math.min(top, window.innerHeight - PANEL_H - pad));
      if (left + PANEL_W + pad > window.innerWidth) left = r.left - PANEL_W - gap;
      if (left < pad) left = pad;
      setPos({ left, top });
    }
    recompute();
    window.addEventListener("resize", recompute);
    window.addEventListener("scroll", recompute, true);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("scroll", recompute, true);
    };
  }, [open]);

  function toggleOpen() { setOpen((v) => !v); if (!open) setQ(""); }

  const panel = open && mounted ? (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
      <div className="popup-surface fixed z-[2147483647] w-[360px] rounded-xl border border-white/10 shadow-xl overflow-hidden"
        style={{ left: pos.left, top: pos.top, background: "linear-gradient(180deg, rgba(10,10,10,0.98), rgba(2,6,23,0.98))", color: "var(--text-main)" }}>
        <div className="p-3 border-b border-white/10">
          <div className="text-xs text-white/60 mb-2">Create new</div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search type… (SOP, report, folder)"
            className="w-full rounded-md px-3 py-2 text-sm outline-none bg-white/10 border border-white/15 placeholder:text-white/45 focus:ring-2"
            style={{ boxShadow: "0 0 0 2px rgba(241,196,15,0.12)" }} autoFocus />
        </div>
        <div className="p-2">
          {filtered.map((k) => {
            const m = kindMeta(k);
            return (
              <button key={k} type="button" onClick={() => { onCreate(k); setOpen(false); setQ(""); }}
                className="w-full text-left rounded-lg px-3 py-3 hover:bg-white/10 transition flex items-start gap-3 border border-transparent hover:border-white/10">
                <div className="h-10 w-10 rounded-lg grid place-items-center text-lg" style={{ background: m.accent }}>{m.emoji}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">{m.label}</div>
                    <div className="text-xs text-white/45">{k === "folder" ? "Ctrl+Shift+F" : "Ctrl+Shift+N"}</div>
                  </div>
                  <div className="text-xs text-white/60 mt-1 line-clamp-2">{m.desc}</div>
                </div>
              </button>
            );
          })}
          {!filtered.length && <div className="text-xs text-white/50 px-3 py-4">No matches.</div>}
        </div>
        <div className="px-3 py-2 border-t border-white/10 text-xs text-white/50">
          Tip: tekan <span className="text-white/70">ESC</span> untuk menutup.
        </div>
      </div>
    </>
  ) : null;

  return (
    <>
      <button ref={btnRef} type="button" onClick={toggleOpen}
        className="text-sm px-3 py-2 rounded-md font-semibold shadow-sm inline-flex items-center gap-2"
        style={{ backgroundColor: "rgb(var(--dc-primary))", color: "rgb(var(--dc-dark))" }}>
        <span className="text-base leading-none">＋</span><span>Add</span><span className="text-xs opacity-80">▾</span>
      </button>
      {mounted ? createPortal(panel, document.body) : null}
    </>
  );
}