"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import MarkdownViewer from "@/components/MarkdownViewer";
import { AppRole, getMyRoleBrowser, canEdit } from "@/lib/role.client";

type PageRow = {
  id: string;
  title: string;
  slug: string;
  content_md: string | null;
  type: string; // "sop" | "report" | "calendar" | "doc" | "folder" ...
  status?: string | null;
  updated_at?: string | null;
};

function typeEmoji(type?: string) {
  switch ((type ?? "").toLowerCase()) {
    case "sop":
      return "📘";
    case "report":
      return "📊";
    case "calendar":
      return "📅";
    case "doc":
      return "📄";
    case "folder":
      return "📁";
    default:
      return "📄";
  }
}

export default function PageEditor({ initialPage }: { initialPage: PageRow }) {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [role, setRole] = useState<AppRole>("viewer");
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  const [title, setTitle] = useState(initialPage.title ?? "");
  const [content, setContent] = useState(initialPage.content_md ?? "");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const editable = canEdit(role);

  useEffect(() => {
    (async () => {
      const r = await getMyRoleBrowser();
      setRole(r);

      // Viewer: langsung ke preview (reading view)
      if (r === "viewer") setTab("preview");
    })();
  }, []);

  // autosave (hanya admin/editor)
  useEffect(() => {
    if (!editable) return;

    const t = setTimeout(() => {
      void handleSave(true);
    }, 900);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, editable]);

  async function handleSave(silent = false) {
    if (!editable) return;
    if (!initialPage?.id) return;

    setSaving(true);
    if (!silent) setSaveMsg(null);

    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id ?? null;

    const { error } = await supabase
      .from("pages")
      .update({
        title,
        content_md: content,
        updated_by: uid,
        updated_at: new Date().toISOString(),
      })
      .eq("id", initialPage.id);

    setSaving(false);

    if (error) {
      if (!silent) setSaveMsg(`Gagal save: ${error.message}`);
      return;
    }

    if (!silent) {
      setSaveMsg("Saved ✅");
      setTimeout(() => setSaveMsg(null), 1200);
    }
  }

  // ===== Viewer / Reading View (Coda-like) =====
  if (!editable) {
    return (
      <main className="flex-1 min-h-screen bg-neutral-50">
        {/* Header minimal (tanpa Role, tanpa tulisan Preview) */}
        <div className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
          <div className="max-w-[980px] mx-auto px-6 py-4">
            <div className="text-2xl font-semibold tracking-tight flex items-start gap-3">
              <span className="mt-1">{typeEmoji(initialPage.type)}</span>
              <span className="truncate">{title || "Untitled"}</span>
            </div>
          </div>
        </div>

        {/* Content full, fokus teks */}
        <div className="max-w-[980px] mx-auto px-6 py-8">
          <div className="md">
            <MarkdownViewer markdown={content} />
          </div>
        </div>
      </main>
    );
  }

  // ===== Admin/Editor View =====
  return (
    <main className="flex-1 min-h-screen bg-neutral-50">
      {/* Top bar (tanpa tulisan Role & tanpa label Preview besar) */}
      <div className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xl font-semibold truncate flex items-center gap-2">
              <span>{typeEmoji(initialPage.type)}</span>
              <span className="truncate">{title || "Untitled"}</span>
            </div>
            {/* status kecil saja (optional) */}
            <div className="text-xs text-neutral-500 mt-1">
              {saving ? "Autosaving..." : "Autosave aktif"}
              {saveMsg ? <span className="ml-2">{saveMsg}</span> : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="rounded-lg border bg-neutral-50 p-1 flex">
              <button
                type="button"
                onClick={() => setTab("edit")}
                className={`px-3 py-1.5 text-sm rounded-md ${
                  tab === "edit" ? "bg-white shadow-sm border" : "text-neutral-600"
                }`}
              >
                Edit
              </button>

              <button
                type="button"
                onClick={() => setTab("preview")}
                className={`px-3 py-1.5 text-sm rounded-md ${
                  tab === "preview" ? "bg-white shadow-sm border" : "text-neutral-600"
                }`}
              >
                Preview
              </button>
            </div>

            {/* Save button */}
            <button type="button" onClick={() => handleSave(false)} disabled={saving} className="dc-btn-dark">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        {/* Coda-like: kanan full area, tanpa Page Info */}
        <div className="dc-card overflow-hidden">
          <div className="p-4">
            {tab === "edit" ? (
              <>
                <div className="mb-3">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="dc-input text-base font-semibold"
                    placeholder="Judul..."
                  />
                </div>

                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full min-h-[70vh] rounded-lg border border-neutral-200 bg-white p-4 font-mono text-[13px] outline-none focus:ring-2 focus:ring-neutral-200"
                  placeholder="Tulis markdown di sini..."
                />
              </>
            ) : (
              <div className="md min-h-[70vh]">
                <MarkdownViewer markdown={content} />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
