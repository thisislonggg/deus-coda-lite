"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import { AppRole, getMyRoleBrowser, canEdit } from "@/lib/role.client";

type PageType = "folder" | "doc" | "sop" | "report" | "calendar";

type PageRow = {
  id: string;
  title: string;
  slug: string;
  parent_id: string | null;
  type: PageType;
  status?: string | null;
};

type PageNode = PageRow & { children: PageNode[] };

type CreateKind = "sop" | "doc" | "report" | "calendar" | "folder";

type CtxTarget =
  | { kind: "page"; node: PageNode }
  | { kind: "folder"; node: PageNode };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function typeEmoji(type: PageType) {
  switch (type) {
    case "folder":
      return "📁";
    case "sop":
      return "📘";
    case "doc":
      return "📄";
    case "report":
      return "📊";
    case "calendar":
      return "📅";
  }
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

  // folder first, then alpha
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
    cur = cur.parent_id ? map.get(cur.parent_id) : undefined;
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

export default function SidebarTree({ showDrafts = true }: { showDrafts?: boolean }) {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const router = useRouter();
  const pathname = usePathname();

  const activeSlug = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    const pIndex = parts.indexOf("p");
    if (pIndex >= 0 && parts[pIndex + 1]) return parts[pIndex + 1];
    return null;
  }, [pathname]);

  const [role, setRole] = useState<AppRole>("viewer");

  const [rows, setRows] = useState<PageRow[]>([]);
  const [roots, setRoots] = useState<PageNode[]>([]);
  const [idMap, setIdMap] = useState<Map<string, PageNode>>(new Map());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");

  // pinned
  const [pinIds, setPinIds] = useState<Set<string>>(new Set());

  // create modal
  const [isOpen, setIsOpen] = useState(false);
  const [createType, setCreateType] = useState<CreateKind>("sop");
  const [createTitle, setCreateTitle] = useState("");
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  // delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTitle, setDeleteTitle] = useState<string>("");
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  // context menu
  const [ctxOpen, setCtxOpen] = useState(false);
  const [ctxPos, setCtxPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [ctxTarget, setCtxTarget] = useState<CtxTarget | null>(null);

  // rename modal
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameErr, setRenameErr] = useState<string | null>(null);

  async function loadRole() {
    const r = await getMyRoleBrowser();
    setRole(r);
  }

  async function loadPages() {
    const q = supabase.from("pages").select("id,title,slug,parent_id,type,status").order("title", { ascending: true });

    const { data, error } = await q;

    if (error) {
      console.error(error);
      return;
    }

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

    // table: page_pins(user_id uuid, page_id uuid, created_at timestamptz)
    const { data, error } = await supabase.from("page_pins").select("page_id").eq("user_id", uid);
    if (error) {
      console.warn("loadPins error:", error.message);
      return;
    }

    const ids = new Set<string>((data ?? []).map((x: any) => x.page_id as string));
    setPinIds(ids);
  }

  async function togglePin(pageId: string) {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) return;

    const next = new Set(pinIds);
    const already = next.has(pageId);

    if (already) {
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
    loadPages();
    loadPins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ids = findPathIds(idMap, activeSlug);
    if (!ids.length) return;

    setExpanded((prev) => {
      const next = { ...prev };
      ids.forEach((id) => (next[id] = true));
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
    return items
      .filter((x) => x.type !== "folder")
      .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
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
    setCreateErr(null);
    setIsOpen(true);
  }

  async function handleCreate() {
    if (!canEdit(role)) {
      setCreateErr("Anda tidak punya izin membuat page/folder.");
      return;
    }

    const t = createTitle.trim();
    if (!t) {
      setCreateErr("Judul tidak boleh kosong.");
      return;
    }

    setCreating(true);
    setCreateErr(null);

    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;

    if (!uid) {
      setCreating(false);
      setCreateErr("Session hilang. Login ulang.");
      return;
    }

    const baseSlug = t
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

    const exists = rows.some((r) => r.slug === baseSlug);
    const finalSlug = exists ? `${baseSlug}-${Math.random().toString(16).slice(2, 6)}` : baseSlug;

    const isFolder = createType === "folder";

    // ✅ type sesuai pilihan (bukan selalu sop)
    const finalType: PageType = isFolder ? "folder" : (createType as PageType);

    // ✅ FIX: kalau DB content_md NOT NULL, folder pakai "" (bukan null)
    const defaultContent =
      createType === "sop"
        ? `# ${t}\n\n## Tujuan\n...\n\n## Tools\n...\n\n## Langkah-langkah\n- ...`
        : createType === "report"
        ? `# ${t}\n\n## Ringkasan\n...\n\n## Data\n- ...\n\n## Insight\n- ...`
        : createType === "calendar"
        ? `# ${t}\n\n## Agenda\n- ...\n\n## Timeline\n- ...`
        : `# ${t}\n\nTulis catatan di sini...`;

    const insertPayload: any = {
      title: t,
      slug: finalSlug,
      parent_id: createParentId,
      type: finalType,
      status: showDrafts ? "draft" : "published",
      created_by: uid,
      updated_by: uid,
      // folder harus string kosong jika column NOT NULL
      content_md: isFolder ? "" : defaultContent,
    };

    const { data, error } = await supabase.from("pages").insert(insertPayload).select("id,slug,type").maybeSingle();

    setCreating(false);

    if (error) {
      setCreateErr(error.message);
      return;
    }

    setIsOpen(false);
    await loadPages();

    if (data?.type !== "folder" && data?.slug) {
      router.push(`/p/${data.slug}`);
      router.refresh();
    } else if (data?.id) {
      setExpanded((p) => ({ ...p, [data.id]: true }));
    }
  }

  function openDelete(node: PageNode) {
    setDeleteId(node.id);
    setDeleteTitle(node.title);
    setDeleteErr(null);
  }

  async function handleDeleteConfirm() {
    if (!deleteId) return;

    if (!canEdit(role)) {
      setDeleteErr("Anda tidak punya izin delete.");
      return;
    }

    setDeleting(true);
    setDeleteErr(null);

    const node = idMap.get(deleteId);

    // larang delete folder yg masih punya children
    if (node?.type === "folder" && node.children?.length) {
      setDeleting(false);
      setDeleteErr("Folder masih punya isi. Hapus isinya dulu.");
      return;
    }

    const { error } = await supabase.from("pages").delete().eq("id", deleteId);

    setDeleting(false);

    if (error) {
      setDeleteErr(error.message);
      return;
    }

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

    const MENU_W = 260;
    const MENU_H = 360;
    const pad = 8;

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
    if (!ctxTarget) return;
    if (!canEdit(role)) return;

    const newTitle = renameValue.trim();
    if (!newTitle) {
      setRenameErr("Nama tidak boleh kosong.");
      return;
    }

    setRenameBusy(true);
    setRenameErr(null);

    const { error } = await supabase.from("pages").update({ title: newTitle }).eq("id", ctxTarget.node.id);

    setRenameBusy(false);

    if (error) {
      setRenameErr(error.message);
      return;
    }

    setRenameOpen(false);
    await loadPages();
  }

  async function copyLink(slug: string) {
    await safeCopy(pageUrl(slug));
  }

  function openNewTab(slug: string) {
    window.open(pageUrl(slug), "_blank", "noopener,noreferrer");
  }

  return (
    <aside
      className="shrink-0 w-[320px] overflow-hidden border-r"
      style={{
        borderColor: "rgba(255,255,255,0.08)",
        background: "linear-gradient(180deg, rgb(var(--dc-dark)) 0%, rgb(17 24 39) 55%, rgb(2 6 23) 100%)",
        color: "white",
        position: "sticky",
        top: 0,
        height: "100vh",
      }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-20 p-4 border-b backdrop-blur"
        style={{ borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(2,6,23,0.70)" }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            <div className="flex items-center gap-3">
              <Image src="/Logo-Deus.webp" alt="Deus Code" width={88} height={88} priority />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEdit(role) && (
              <AddMenu
                onCreate={(kind) => {
                  openCreate(null, kind);
                }}
              />
            )}

            <button
              type="button"
              onClick={onLogout}
              className="text-sm px-2.5 py-1.5 rounded-md border border-white/15 hover:bg-white/10"
              title="Logout"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="mt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages..."
            className="w-full rounded-md px-3 py-2 text-sm outline-none bg-white/10 border border-white/15 placeholder:text-white/50 focus:ring-2"
            style={{ boxShadow: "0 0 0 2px rgba(241,196,15,0.12)" }}
          />
        </div>
      </div>

      {/* Body */}
      <div className="h-[calc(100vh-132px)] overflow-y-auto px-3 py-3">
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
                  onContextMenu={(e) => {
                    const n: PageNode = { ...(p as any), children: [] };
                    openContextMenu(e, n);
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
                  <span className="text-white/70">{typeEmoji(p.type)}</span>
                  <span className="flex-1 truncate">{p.title}</span>
                  <span className="text-xs text-white/40">📌</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-white/50 px-2 mb-2">Pages</div>

        <TreeList
          nodes={filteredRoots}
          expanded={expanded}
          onToggle={toggle}
          activeSlug={activeSlug}
          level={0}
          canEdit={canEdit(role)}
          onAdd={(parentId) => openCreate(parentId)}
          onDelete={(node) => openDelete(node)}
          onNavigate={(slug) => {
            router.push(`/p/${slug}`);
            router.refresh();
          }}
          onContextMenuNode={openContextMenu}
        />
      </div>

      {/* Create Modal */}
      {isOpen && canEdit(role) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !creating && setIsOpen(false)} />
          <div className="relative w-full max-w-md rounded-xl border border-white/10 bg-neutral-950 text-white shadow-xl">
            <div className="p-4 border-b border-white/10">
              <div className="text-sm font-semibold">Add New</div>
              <div className="text-xs text-white/60 mt-1">{createParentId ? "Create inside folder" : "Create at root"}</div>
            </div>

            <div className="p-4 space-y-3">
              {/* type grid */}
              <div className="grid grid-cols-2 gap-2">
                {(["sop", "doc", "report", "calendar", "folder"] as CreateKind[]).map((k) => {
                  const m = kindMeta(k);
                  const active = createType === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setCreateType(k)}
                      className={`rounded-lg px-3 py-3 text-sm border text-left flex items-center gap-3 ${
                        active ? "border-yellow-400/60" : "border-white/10"
                      }`}
                      style={{
                        backgroundColor: active ? "rgba(241,196,15,0.12)" : "rgba(255,255,255,0.04)",
                      }}
                    >
                      <span className="text-lg">{m.emoji}</span>
                      <span className="min-w-0">
                        <div className="font-semibold leading-tight">{m.label}</div>
                        <div className="text-xs text-white/60 truncate">{m.desc}</div>
                      </span>
                    </button>
                  );
                })}
              </div>

              <input
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder={createType === "folder" ? "Nama folder..." : "Judul page..."}
                className="w-full rounded-md px-3 py-2 text-sm outline-none bg-white/5 border border-white/10 placeholder:text-white/40 focus:ring-2"
                style={{ boxShadow: "0 0 0 2px rgba(241,196,15,0.10)" }}
              />

              {createErr && <div className="text-xs text-red-300">{createErr}</div>}
            </div>

            <div className="p-4 border-t border-white/10 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={creating}
                className="px-3 py-2 text-sm rounded-md border border-white/15 hover:bg-white/10 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="px-3 py-2 text-sm rounded-md font-semibold disabled:opacity-60"
                style={{ backgroundColor: "rgb(var(--dc-primary))", color: "rgb(var(--dc-dark))" }}
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {!!deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !deleting && setDeleteId(null)} />
          <div className="relative w-full max-w-md rounded-xl border border-white/10 bg-neutral-950 text-white shadow-xl">
            <div className="p-4 border-b border-white/10">
              <div className="text-sm font-semibold">Delete</div>
              <div className="text-xs text-white/60 mt-1">Hapus: “{deleteTitle}”</div>
            </div>

            <div className="p-4 space-y-2">
              <div className="text-sm text-white/75">Ini akan menghapus item permanen. Kalau folder, pastikan kosong dulu.</div>
              {deleteErr && <div className="text-xs text-red-300">{deleteErr}</div>}
            </div>

            <div className="p-4 border-t border-white/10 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="px-3 py-2 text-sm rounded-md border border-white/15 hover:bg-white/10 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-3 py-2 text-sm rounded-md font-semibold disabled:opacity-60"
                style={{ backgroundColor: "rgb(239 68 68)", color: "white" }}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {ctxOpen && ctxTarget && (
        <>
          <div
            className="fixed inset-0 z-[80]"
            onClick={() => {
              setCtxOpen(false);
              setCtxTarget(null);
            }}
          />

          <div
            className="fixed z-[90] w-[260px] rounded-xl border border-white/10 shadow-2xl overflow-hidden"
            style={{
              left: ctxPos.x,
              top: ctxPos.y,
              background: "linear-gradient(180deg, rgba(20,20,20,0.98), rgba(2,6,23,0.98))",
              color: "white",
            }}
          >
            <div className="px-3 py-2 border-b border-white/10">
              <div className="text-xs text-white/60 truncate">
                {typeEmoji(ctxTarget.node.type)} {ctxTarget.node.title}
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

              {ctxTarget.kind === "page" && (
                <CtxItem
                  label="Open in new tab"
                  subLabel="Buka tab baru"
                  icon="🗂️"
                  onClick={() => {
                    setCtxOpen(false);
                    openNewTab(ctxTarget.node.slug);
                  }}
                />
              )}

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
        </>
      )}

      {/* Rename Modal */}
      {renameOpen && ctxTarget && canEdit(role) && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !renameBusy && setRenameOpen(false)} />
          <div className="relative w-full max-w-sm rounded-xl border border-white/10 bg-neutral-950 text-white shadow-xl">
            <div className="p-4 border-b border-white/10">
              <div className="text-sm font-semibold">Rename</div>
              <div className="text-xs text-white/60 mt-1">Ubah nama: {ctxTarget.node.title}</div>
            </div>

            <div className="p-4 space-y-2">
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="w-full rounded-md px-3 py-2 text-sm outline-none bg-white/5 border border-white/10 placeholder:text-white/40 focus:ring-2"
                style={{ boxShadow: "0 0 0 2px rgba(241,196,15,0.10)" }}
                autoFocus
              />
              {renameErr && <div className="text-xs text-red-300">{renameErr}</div>}
            </div>

            <div className="p-4 border-t border-white/10 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameOpen(false)}
                disabled={renameBusy}
                className="px-3 py-2 text-sm rounded-md border border-white/15 hover:bg-white/10 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRename}
                disabled={renameBusy}
                className="px-3 py-2 text-sm rounded-md font-semibold disabled:opacity-60"
                style={{ backgroundColor: "rgb(var(--dc-primary))", color: "rgb(var(--dc-dark))" }}
              >
                {renameBusy ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

/* ---------------- AddMenu (FIX: tidak kepotong) ---------------- */

function AddMenu({ onCreate }: { onCreate: (kind: CreateKind) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const items: CreateKind[] = ["sop", "doc", "report", "calendar", "folder"];
  const filtered = items.filter((k) => {
    const m = kindMeta(k);
    const s = `${m.label} ${m.desc}`.toLowerCase();
    return s.includes(q.trim().toLowerCase());
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function openAtButton() {
    const r = btnRef.current?.getBoundingClientRect();
    const PANEL_W = 360;
    const PANEL_H = 420;
    const pad = 8;

    const x = clamp((r?.left ?? 0), pad, window.innerWidth - PANEL_W - pad);
    const y = clamp((r?.bottom ?? 0) + 8, pad, window.innerHeight - PANEL_H - pad);

    setPos({ x, y });
    setOpen(true);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openAtButton())}
        className="text-sm px-3 py-2 rounded-md font-semibold shadow-sm inline-flex items-center gap-2"
        style={{ backgroundColor: "rgb(var(--dc-primary))", color: "rgb(var(--dc-dark))" }}
        title="Add"
      >
        <span className="text-base leading-none">＋</span>
        <span>Add</span>
        <span className="text-xs opacity-80">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div
            className="fixed z-50 w-[360px] rounded-xl border border-white/10 shadow-xl overflow-hidden"
            style={{
              left: pos.x,
              top: pos.y,
              background: "linear-gradient(180deg, rgba(10,10,10,0.98), rgba(2,6,23,0.98))",
              color: "white",
            }}
          >
            <div className="p-3 border-b border-white/10">
              <div className="text-xs text-white/60 mb-2">Create new</div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search type… (SOP, report, folder)"
                className="w-full rounded-md px-3 py-2 text-sm outline-none bg-white/10 border border-white/15 placeholder:text-white/45 focus:ring-2"
                style={{ boxShadow: "0 0 0 2px rgba(241,196,15,0.12)" }}
                autoFocus
              />
            </div>

            <div className="p-2">
              {filtered.map((k) => {
                const m = kindMeta(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      onCreate(k);
                      setOpen(false);
                      setQ("");
                    }}
                    className="w-full text-left rounded-lg px-3 py-3 hover:bg-white/10 transition flex items-start gap-3 border border-transparent hover:border-white/10"
                  >
                    <div className="h-10 w-10 rounded-lg grid place-items-center text-lg" style={{ background: m.accent }}>
                      {m.emoji}
                    </div>

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
      )}
    </>
  );
}

/* ---------------- TreeList ---------------- */

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
  if (!nodes.length) return <div className="text-xs text-white/40 px-2 py-2">No pages.</div>;

  return (
    <div className="space-y-1">
      {nodes.map((n) => {
        const isOpen = expanded[n.id] ?? false;
        const hasChildren = n.children?.length > 0;
        const isActive = activeSlug === n.slug;

        const isFolder = n.type === "folder";
        const icon = typeEmoji(n.type);

        return (
          <div key={n.id}>
            <div
              onContextMenu={(e) => onContextMenuNode(e, n)}
              onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest("button[data-action]")) return;

                    if (isFolder) onToggle(n.id);
                    else onNavigate(n.slug);
                  }}
              className={[
                "group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition border select-none",
                isActive ? "text-white border-white/10" : "text-white/85 border-transparent hover:bg-white/10",
              ].join(" ")}
              style={{
                paddingLeft: 10 + level * 14,
                backgroundColor: isActive ? "rgba(241,196,15,0.14)" : undefined,
              }}
            >
              {isFolder ? (
                <button
                  type="button"
                  onClick={() => onToggle(n.id)}
                  className="h-5 w-5 rounded-md hover:bg-white/10 grid place-items-center"
                  title={isOpen ? "Collapse" : "Expand"}
                >
                  <span className="text-white/80 text-xs">{isOpen ? "▾" : "▸"}</span>
                </button>
              ) : (
                <span className="h-5 w-5 grid place-items-center text-white/40 text-xs">•</span>
              )}

              <span className="text-white/70">{icon}</span>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  if (isFolder) {
                    onToggle(n.id); // ✅ folder hanya expand/collapse
                    return;
                  }

                  onNavigate(n.slug); // ✅ page baru navigate
                }}
                className="flex-1 text-left truncate"
                title={n.title}
              >
                {n.title}
              </button>


              <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
                {canEdit && isFolder && (
                  <button data-action="1"
                    type="button"
                    onClick={() => onAdd(n.id)}
                    className="text-xs px-2 py-1 rounded-md hover:bg-white/10"
                    style={{ color: "rgb(var(--dc-primary))" }}
                    title="Add inside"
                  >
                    + Add
                  </button>
                )}
                {canEdit && (
                  <button data-action="1"
                    type="button"
                    onClick={() => onDelete(n)}
                    className="text-xs px-2 py-1 rounded-md hover:bg-white/10 text-red-300"
                    title="Delete"
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

/* ---------------- Context Menu UI ---------------- */

function CtxSep() {
  return <div className="my-1 border-t border-white/10" />;
}

function CtxItem({
  label,
  subLabel,
  icon,
  danger,
  onClick,
}: {
  label: string;
  subLabel?: string;
  icon?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition flex items-start gap-2 ${
        danger ? "text-red-300" : "text-white"
      }`}
    >
      <div className="w-6 shrink-0 text-center">{icon ?? ""}</div>
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {subLabel && <div className="text-[11px] text-white/55 -mt-0.5">{subLabel}</div>}
      </div>
    </button>
  );
}
