"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Heading from "@tiptap/extension-heading";
import Placeholder from "@tiptap/extension-placeholder";
import Dropcursor from "@tiptap/extension-dropcursor";
import Gapcursor from "@tiptap/extension-gapcursor";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
import { ResizableImageExtension } from "@/components/tiptap/ResizableImageExtension";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

/* =========================
   TEXT COLOR PRESET (5 only)
========================= */
const TEXT_COLOR_PALETTE = ["#ABF4AB", "#DF9094", "#F0DC88", "#D5D5C9", "#FFFFFF"] as const;
type TextColor = (typeof TEXT_COLOR_PALETTE)[number];

type Props = {
  value?: string; // HTML content
  editable?: boolean;

  onChangeHtml?: (html: string) => void;
  onChangeMarkdown?: (md: string) => void;

  placeholder?: string;

  uploadFolder?: string;
  maxImageMB?: number;
};

function htmlToMarkdownSimple(html: string) {
  return html;
}

function isMac() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

export default function RichEditor({
  value = "",
  editable = true,
  onChangeHtml,
  onChangeMarkdown,
  placeholder = "Tulis sesuatu...",
  uploadFolder = "editor",
  maxImageMB = 4,
}: Props) {
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imgUploading, setImgUploading] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);

  // Link modal state (✅ back to your version)
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const linkInputRef = useRef<HTMLInputElement | null>(null);

  // Text color state (✅ preset only)
  const [textColor, setTextColor] = useState<TextColor>("#FFFFFF");

  // Highlight state (unchanged)
  const [hlColor, setHlColor] = useState("#fde047"); // yellow-ish

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Heading.configure({ levels: [1, 2, 3] }),
      Placeholder.configure({ placeholder }),

      BulletList,
      OrderedList,
      ListItem,

      // Cursor helpers
      Gapcursor,
      Dropcursor,

      // Image resize
      ResizableImageExtension,

      // Text color support
      TextStyle,
      Color,

      // Highlight (background color)
      Highlight.configure({ multicolor: true }),

      // Link support
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: "deus-link",
          rel: "noreferrer",
          target: "_blank",
        },
      }),
    ],
    content: value,
    editable,
    immediatelyRender: false,
    onUpdate({ editor }) {
      const html = editor.getHTML();
      if (typeof onChangeHtml === "function") onChangeHtml(html);
      if (typeof onChangeMarkdown === "function") onChangeMarkdown(htmlToMarkdownSimple(html));
    },
  });

  // sync editable changes
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  // sync external value changes
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value, { parseOptions: { preserveWhitespace: false } });
    }
  }, [editor, value]);

  // Ctrl/Cmd + K shortcut (✅ back to your version)
  useEffect(() => {
    if (!editor) return;

    function onKeyDown(e: KeyboardEvent) {
      const isCmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey;
      if (!isCmdOrCtrl) return;
      if (e.key.toLowerCase() !== "k") return;

      // only when editor focused
      if (!editor?.isFocused) return;
      e.preventDefault();
      e.stopPropagation();
      openLinkModalFromSelection();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // ✅ back to your version
  function openLinkModalFromSelection() {
    if (!editor) return;

    const prevHref = editor.getAttributes("link")?.href as string | undefined;

    setLinkUrl(prevHref ?? "");

    // selected text
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to, " ");
    setLinkText(selected ?? "");

    setLinkOpen(true);

    // focus input next tick
    setTimeout(() => linkInputRef.current?.focus(), 50);
  }

  // ✅ back to your version
  function closeLinkModal() {
    setLinkOpen(false);
    setLinkUrl("");
    setLinkText("");
  }

  // ✅ back to your version
  function applyLink() {
    if (!editor) return;

    const url = linkUrl.trim();

    // empty url -> remove link
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      closeLinkModal();
      return;
    }

    // Normalize URL (simple helper)
    const normalized =
      url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;

    const { from, to } = editor.state.selection;
    const hasSelection = to > from;

    // If no selection, insert text (use linkText if provided, else url)
    if (!hasSelection) {
      const textToInsert = (linkText || normalized).trim();
      if (!textToInsert) {
        closeLinkModal();
        return;
      }

      // Insert linked text as a text node with link mark
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: textToInsert,
          marks: [{ type: "link", attrs: { href: normalized } }],
        })
        .run();

      closeLinkModal();
      return;
    }

    // If selection exists, set link on selection
    editor.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run();
    closeLinkModal();
  }

  async function uploadAndInsertImage(file: File) {
    if (!editor) return;
    setImgError(null);

    if (!file.type.startsWith("image/")) {
      setImgError("File harus berupa gambar (jpg/png/webp).");
      return;
    }

    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxImageMB) {
      setImgError(`Ukuran gambar terlalu besar. Maksimal ${maxImageMB} MB.`);
      return;
    }

    setImgUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${Date.now()}.${ext}`;
      const path = `${uploadFolder}/${fileName}`;

      const { error: upErr } = await supabase.storage.from("deus-media").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

      if (upErr) throw upErr;

      const { data } = supabase.storage.from("deus-media").getPublicUrl(path);
      const url = data.publicUrl;

      // insert image into editor
      editor.chain().focus().setImage({ src: url, alt: file.name, width: 520 }).run();
    } catch (e: any) {
      setImgError(e?.message ?? "Upload gagal.");
    } finally {
      setImgUploading(false);
    }
  }

  function handlePickClick() {
    if (!editable) return;
    setImgError(null);
    fileInputRef.current?.click();
  }

  // ✅ preset only
  function setTextColorCmd(hex: TextColor) {
    if (!editor) return;
    setTextColor(hex);
    editor.chain().focus().setColor(hex).run();
  }

  // ✅ preset reset to white
  function unsetTextColorCmd() {
    if (!editor) return;
    setTextColor("#FFFFFF");
    editor.chain().focus().unsetColor().run();
  }

  function setHighlightCmd(hex: string) {
    if (!editor) return;
    setHlColor(hex);
    editor.chain().focus().setHighlight({ color: hex }).run();
  }

  function unsetHighlightCmd() {
    if (!editor) return;
    editor.chain().focus().unsetHighlight().run();
  }

  if (!editor) return null;

  const shortcutLabel = isMac() ? "⌘K" : "Ctrl+K";

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/40">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-white/10">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-2 py-1 rounded-md text-sm border border-white/10 hover:bg-white/10 ${
            editor.isActive("bold") ? "bg-white/10" : ""
          }`}
        >
          Bold
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-2 py-1 rounded-md text-sm border border-white/10 hover:bg-white/10 ${
            editor.isActive("heading", { level: 1 }) ? "bg-white/10" : ""
          }`}
        >
          H1
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2 py-1 rounded-md text-sm border border-white/10 hover:bg-white/10 ${
            editor.isActive("heading", { level: 2 }) ? "bg-white/10" : ""
          }`}
        >
          H2
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`px-2 py-1 rounded-md text-sm border border-white/10 hover:bg-white/10 ${
            editor.isActive("heading", { level: 3 }) ? "bg-white/10" : ""
          }`}
        >
          H3
        </button>

        <button
  type="button"
  onClick={() => editor.chain().focus().toggleBulletList().run()}
  className={`px-2 py-1 rounded-md text-sm border border-white/10 hover:bg-white/10 ${
    editor.isActive("bulletList") ? "bg-white/10" : ""
  }`}
>
  • List
</button>

<button
  type="button"
  onClick={() => editor.chain().focus().toggleOrderedList().run()}
  className={`px-2 py-1 rounded-md text-sm border border-white/10 hover:bg-white/10 ${
    editor.isActive("orderedList") ? "bg-white/10" : ""
  }`}
>
  1. List
</button>


        <div className="w-px h-6 bg-white/10 mx-1" />

        {/* ✅ Text Color (5 presets only) */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60">Text</span>

          <div className="flex items-center gap-1">
            {TEXT_COLOR_PALETTE.map((c) => {
              const active = textColor.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setTextColorCmd(c)}
                  className={`h-8 w-8 rounded-md border transition ${
                    active ? "border-white/60" : "border-white/10 hover:border-white/30"
                  }`}
                  title={c.replace("#", "")}
                  style={{
                    backgroundColor: c,
                    boxShadow: active ? "0 0 0 2px rgba(255,255,255,0.18)" : undefined,
                  }}
                />
              );
            })}
          </div>

          <button
            type="button"
            onClick={unsetTextColorCmd}
            className="px-2 py-1 rounded-md text-xs border border-white/10 hover:bg-white/10 text-white/80"
            title="Reset text color"
          >
            Reset
          </button>
        </div>

        {/* Highlight */}
        <div className="flex items-center gap-2 ml-1">
          <span className="text-xs text-white/60">HL</span>
          <input
            type="color"
            value={hlColor}
            onChange={(e) => setHighlightCmd(e.target.value)}
            className="h-8 w-8 p-0 border border-white/10 rounded-md bg-transparent cursor-pointer"
            title="Highlight color"
          />
          <button
            type="button"
            onClick={unsetHighlightCmd}
            className="px-2 py-1 rounded-md text-xs border border-white/10 hover:bg-white/10 text-white/80"
            title="Remove highlight"
          >
            Clear
          </button>
        </div>

        <div className="w-px h-6 bg-white/10 mx-1" />

        {/* Link (✅ back to your version) */}
        <button
          type="button"
          onClick={openLinkModalFromSelection}
          className={`px-2 py-1 rounded-md text-sm border border-white/10 hover:bg-white/10 ${
            editor.isActive("link") ? "bg-white/10" : ""
          }`}
          title={`Insert/edit link (${shortcutLabel})`}
        >
          🔗 Link <span className="text-xs text-white/50 ml-1">{shortcutLabel}</span>
        </button>

        <div className="w-px h-6 bg-white/10 mx-1" />

        {/* Upload image button */}
        <button
          type="button"
          onClick={handlePickClick}
          disabled={!editable || imgUploading}
          className="px-2 py-1 rounded-md text-sm border border-white/10 hover:bg-white/10 disabled:opacity-60"
          title="Upload gambar"
        >
          {imgUploading ? "Uploading..." : "Image"}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadAndInsertImage(f);
            e.currentTarget.value = "";
          }}
        />
      </div>

      {imgError && <div className="px-4 pt-3 text-xs text-red-300">{imgError}</div>}

      {/* Editor */}
      <div className="p-4">
        <EditorContent
        editor={editor}
        className="
          prose prose-invert max-w-none
          prose-h1:text-3xl prose-h1:font-bold
          prose-h2:text-2xl prose-h2:font-semibold
          prose-h3:text-xl prose-h3:font-semibold
          prose-p:text-base prose-p:text-white/85
          prose-li:text-white/85

          [&_ul]:list-disc
          [&_ul]:pl-6
          [&_ol]:list-decimal
          [&_ol]:pl-6
          [&_li]:list-item

          [&_.deus-img]:max-w-full
          [&_.deus-img]:h-auto
          [&_.deus-img]:rounded-xl
          [&_.deus-img]:border
          [&_.deus-img]:border-white/10

          [&_.deus-link]:underline
          [&_.deus-link]:underline-offset-4
          [&_.deus-link]:text-sky-300
          [&_.deus-link:hover]:text-sky-200
        "
      />
      </div>

      {/* Link Modal (✅ back to your version) */}
      {linkOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeLinkModal} />

          <div className="relative w-full max-w-md rounded-xl border border-white/10 bg-neutral-950 text-white shadow-xl">
            <div className="p-4 border-b border-white/10">
              <div className="text-sm font-semibold">Insert / Edit Link</div>
              <div className="text-xs text-white/60 mt-1">
                Shortcut: <span className="text-white/80">{shortcutLabel}</span>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <div className="text-xs text-white/60 mb-1">URL</div>
                <input
                  ref={linkInputRef}
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-md px-3 py-2 text-sm outline-none bg-white/5 border border-white/10 placeholder:text-white/40 focus:ring-2"
                  style={{ boxShadow: "0 0 0 2px rgba(241,196,15,0.10)" }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyLink();
                    if (e.key === "Escape") closeLinkModal();
                  }}
                />
              </div>

              {/* Optional text for empty selection */}
              <div>
                <div className="text-xs text-white/60 mb-1">Text (optional)</div>
                <input
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Text yang ditampilkan (kalau tidak pilih teks)"
                  className="w-full rounded-md px-3 py-2 text-sm outline-none bg-white/5 border border-white/10 placeholder:text-white/40 focus:ring-2"
                  style={{ boxShadow: "0 0 0 2px rgba(241,196,15,0.06)" }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyLink();
                    if (e.key === "Escape") closeLinkModal();
                  }}
                />
              </div>

              <div className="text-[11px] text-white/50">
                Tips: pilih teks dulu lalu tekan {shortcutLabel} untuk edit link pada teks itu.
              </div>
            </div>

            <div className="p-4 border-t border-white/10 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().extendMarkRange("link").unsetLink().run();
                  closeLinkModal();
                }}
                className="px-3 py-2 text-sm rounded-md border border-white/15 hover:bg-white/10 text-red-200"
                title="Remove link"
              >
                Remove
              </button>

              <button
                type="button"
                onClick={closeLinkModal}
                className="px-3 py-2 text-sm rounded-md border border-white/15 hover:bg-white/10"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={applyLink}
                className="px-3 py-2 text-sm rounded-md font-semibold"
                style={{ backgroundColor: "rgb(var(--dc-primary))", color: "rgb(var(--dc-dark))" }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
