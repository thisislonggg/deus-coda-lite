"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import { AppRole, getMyRoleBrowser, canEdit } from "@/lib/role.client";

type PageRow = {
  id: string;
  title: string;
  slug: string;
  parent_id: string | null;
  type: "folder" | "doc" | "sop" | "report" | "calendar"; // sesuai constraint
  status?: string | null;
};

type PageNode = PageRow & { children: PageNode[] };

type CreateKind = "sop" | "doc" | "report" | "calendar" | "folder";

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

  // folder first
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

function iconForType(t: PageRow["type"]) {
  switch (t) {
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

function slugify(t: string) {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
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

  // modal create
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

  async function loadRole() {
    const r = await getMyRoleBrowser();
    setRole(r);
  }

  async function loadPages() {
    const { data, error } = await supabase
      .from("pages")
      .select("id,title,slug,parent_id,type,status")
      .order("title", { ascending: true });

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

  useEffect(() => {
    loadRole();
    loadPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // auto expand active path
  useEffect(() => {
    const ids = findPathIds(idMap, activeSlug);
    if (!ids.length) return;
    setExpanded((prev) => {
      const next = { ...prev };
      ids.forEach((id) => (next[id] = true));
      return next;
    });
  }, [activeSlug, idMap]);

  // filter tree by query
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

    const baseSlug = slugify(t);
    const exists = rows.some((r) => r.slug === baseSlug);
    const finalSlug = exists ? `${baseSlug}-${Math.random().toString(16).slice(2, 6)}` : baseSlug;

    const insertPayload: any = {
      title: t,
      slug: finalSlug,
      parent_id: createParentId,
      type: createType, // ✅ langsung sesuai constraint
      status: showDrafts ? "draft" : "published",
      created_by: uid,
      updated_by: uid,
      content_md:
        createType !== "folder"
          ? `# ${t}\n\n## Tujuan\n...\n\n## Tools\n...\n\n## Langkah-langkah\n- ...`
          : null,
    };

    const { data, error } = await supabase.from("pages").insert(insertPayload).select("id,slug,type").maybeSingle();

    setCreating(false);

    if (error) {
      setCreateErr(error.message);
      return;
    }

    setIsOpen(false);
    await loadPages();

    // ✅ ini lokasi if (createType === "page" && data?.slug) yang kamu tanya
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

    // aman: folder harus kosong dulu
    const node = idMap.get(deleteId);
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

  return (
    <aside
      className="h-screen w-[320px] shrink-0 border-r"
      style={{
        borderColor: "rgba(255,255,255,0.08)",
        background: "linear-gradient(180deg, rgb(var(--dc-dark)) 0%, rgb(17 24 39) 55%, rgb(2 6 23) 100%)",
        color: "white",
      }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-20 p-4 border-b backdrop-blur"
        style={{
          borderColor: "rgba(255,255,255,0.10)",
          backgroundColor: "rgba(2,6,23,0.70)",
        }}
      >
        <div className="flex items-center justify-between gap-2">
          {/* left brand */}
          <div className="min-w-0 flex items-center gap-3">
            <Image
              src="/logo-deus.webp"
              alt="Deus Code"
              width={80}
              height={80}
              priority
              className="rounded-md"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* viewer: hide Add */}
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
              className="text-sm px-2.5 py-2 rounded-md border border-white/15 hover:bg-white/10"
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

      {/* Body (scrollable) */}
      <div className="h-[calc(100vh-132px)] overflow-y-auto px-3 py-3">
        <div className="text-xs text-white/50 px-2 mb-2">Pages</div>

        <TreeList
          nodes={filteredRoots}
          expanded={expanded}
          onToggle={toggle}
          activeSlug={activeSlug}
          level={0}
          canEdit={canEdit(role)}
          onAdd={(parentId) => openCreate(parentId, "sop")}
          onDelete={(node) => openDelete(node)}
          onNavigate={(slug) => {
            router.push(`/p/${slug}`);
            router.refresh();
          }}
        />
      </div>

      {/* Create Modal */}
      {isOpen && canEdit(role) && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !creating && setIsOpen(false)} />
          <div className="relative w-full max-w-md rounded-xl border border-white/10 bg-neutral-950 text-white shadow-xl">
            <div className="p-4 border-b border-white/10">
              <div className="text-sm font-semibold">Add New</div>
              <div className="text-xs text-white/60 mt-1">
                {createParentId ? "Create inside folder" : "Create at root"}
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {(["sop", "doc", "report", "calendar", "folder"] as CreateKind[]).map((k) => {
                  const m = kindMeta(k);
                  const active = createType === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setCreateType(k)}
                      className={`rounded-lg px-3 py-2 text-sm border transition ${
                        active ? "border-yellow-400/50" : "border-white/10 hover:border-white/20"
                      }`}
                      style={{ backgroundColor: active ? "rgba(241,196,15,0.12)" : "rgba(255,255,255,0.04)" }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{m.emoji}</span>
                        <div className="text-left">
                          <div className="font-semibold">{m.label}</div>
                          <div className="text-[11px] text-white/55">{m.desc}</div>
                        </div>
                      </div>
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
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !deleting && setDeleteId(null)} />
          <div className="relative w-full max-w-md rounded-xl border border-white/10 bg-neutral-950 text-white shadow-xl">
            <div className="p-4 border-b border-white/10">
              <div className="text-sm font-semibold">Delete</div>
              <div className="text-xs text-white/60 mt-1">Hapus: “{deleteTitle}”</div>
            </div>

            <div className="p-4 space-y-2">
              <div className="text-sm text-white/75">Ini akan menghapus item permanen.</div>
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
    </aside>
  );
}

/**
 * AddMenu pakai Portal (render ke document.body)
 * -> jadi gak kepotong oleh parent yang overflow-hidden
 */
function AddMenu({ onCreate }: { onCreate: (kind: CreateKind) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [mounted, setMounted] = useState(false);

  // simpan tombol yang jadi anchor dropdown
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const items: CreateKind[] = ["sop", "doc", "report", "calendar", "folder"];

  useEffect(() => setMounted(true), []);

  const filtered = items.filter((k) => {
    const m = kindMeta(k);
    const s = `${m.label} ${m.desc}`.toLowerCase();
    return s.includes(q.trim().toLowerCase());
  });

  function computePos(btn: HTMLButtonElement) {
    const r = btn.getBoundingClientRect();

    const width = 360;
    const left = Math.min(window.innerWidth - width - 12, Math.max(12, r.right - width));

    // posisi bawah tombol + gap
    let top = r.bottom + 8;

    // kalau mepet bawah viewport, taruh di atas tombol
    const dropdownMaxH = Math.min(520, Math.floor(window.innerHeight * 0.6));
    const willOverflowBottom = top + dropdownMaxH > window.innerHeight - 12;
    if (willOverflowBottom) top = Math.max(12, r.top - 8 - dropdownMaxH);

    setPos({ top, left, width });
  }

  function openAt(btn: HTMLButtonElement) {
    setAnchorEl(btn);
    computePos(btn);
    setOpen(true);
  }

  // ✅ update posisi saat scroll/resize (nempel tombol)
  useEffect(() => {
    if (!open || !anchorEl) return;

    const onReposition = () => computePos(anchorEl);

    // capture = true biar scroll dalam container juga ke-detect
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);

    // juga update sekali setelah render
    onReposition();

    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open, anchorEl]);

  // close on ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          const btn = e.currentTarget as HTMLButtonElement;
          if (open) {
            setOpen(false);
          } else {
            openAt(btn);
          }
        }}
        className="text-sm px-3 py-2 rounded-md font-semibold shadow-sm inline-flex items-center gap-2"
        style={{ backgroundColor: "rgb(var(--dc-primary))", color: "rgb(var(--dc-dark))" }}
        title="Add"
      >
        <span className="text-base leading-none">＋</span>
        <span>Add</span>
        <span className="text-xs opacity-80">▾</span>
      </button>

      {mounted && open && pos
        ? createPortal(
            <>
              {/* backdrop */}
              <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />

              <div
                className="fixed z-[100] rounded-xl border border-white/10 shadow-2xl overflow-hidden"
                style={{
                  top: pos.top,
                  left: pos.left,
                  width: pos.width,
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

                <div className="p-2 max-h-[60vh] overflow-auto">
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
                        <div
                          className="h-10 w-10 rounded-lg grid place-items-center text-lg"
                          style={{ background: m.accent }}
                        >
                          {m.emoji}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold">{m.label}</div>
                            <div className="text-xs text-white/45">
                              {k === "folder" ? "Ctrl+Shift+F" : "Ctrl+Shift+N"}
                            </div>
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
            </>,
            document.body
          )
        : null}
    </>
  );
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
}) {
  if (!nodes.length) return <div className="text-xs text-white/40 px-2 py-2">No pages.</div>;

  return (
    <div className="space-y-1">
      {nodes.map((n) => {
        const isOpen = expanded[n.id] ?? false;
        const hasChildren = n.children?.length > 0;
        const isActive = activeSlug === n.slug;

        const isFolder = n.type === "folder";
        const icon = iconForType(n.type);

        return (
          <div key={n.id}>
            <div
              className={[
                "group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition border",
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
                onClick={() => (isFolder ? onToggle(n.id) : onNavigate(n.slug))}
                className="flex-1 text-left truncate"
                title={n.title}
              >
                {n.title}
              </button>

              <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
                {canEdit && isFolder && (
                  <button
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
                  <button
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
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
