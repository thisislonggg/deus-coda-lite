"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Heading from "@tiptap/extension-heading";
import Placeholder from "@tiptap/extension-placeholder";
import Dropcursor from "@tiptap/extension-dropcursor";
import Gapcursor from "@tiptap/extension-gapcursor";

import { ResizableImageExtension } from "@/components/tiptap/ResizableImageExtension";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

type Props = {
  value?: string; // HTML content
  editable?: boolean;

  onChangeHtml?: (html: string) => void;
  onChangeMarkdown?: (md: string) => void;

  placeholder?: string;

  // folder upload supaya rapi, contoh: pages/<pageId>
  uploadFolder?: string;
  maxImageMB?: number;
};

function htmlToMarkdownSimple(html: string) {
  return html;
}

// ---------- Helpers: extract images from paste/drop ----------
function getImageFilesFromClipboard(e: ClipboardEvent): File[] {
  const dt = e.clipboardData;
  if (!dt) return [];

  // sometimes dt.files is empty but dt.items has image
  const fromFiles = Array.from(dt.files ?? []).filter((f) => f.type.startsWith("image/"));
  if (fromFiles.length) return fromFiles;

  const items = Array.from(dt.items ?? []);
  const imgs: File[] = [];
  for (const it of items) {
    if (it.kind === "file") {
      const f = it.getAsFile();
      if (f && f.type.startsWith("image/")) imgs.push(f);
    }
  }
  return imgs;
}

function getImageFilesFromDrop(e: DragEvent): File[] {
  const dt = e.dataTransfer;
  if (!dt) return [];
  return Array.from(dt.files ?? []).filter((f) => f.type.startsWith("image/"));
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

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Heading.configure({ levels: [1, 2, 3] }),
      Placeholder.configure({ placeholder }),

      // drag-drop feel
      Gapcursor,
      Dropcursor,

      // resizable + draggable image (your custom extension)
      ResizableImageExtension,
    ],
    content: value,
    editable,
    immediatelyRender: false,

    editorProps: {
      handlePaste: (view, event) => {
        if (!editable) return false;

        const e = event as ClipboardEvent;
        const files = getImageFilesFromClipboard(e);

        if (files.length === 0) return false; // allow normal paste text/html

        e.preventDefault();
        void uploadAndInsertImage(files[0]); // paste -> insert at cursor
        return true;
      },

      handleDrop: (view, event) => {
        if (!editable) return false;

        const e = event as DragEvent;
        const files = getImageFilesFromDrop(e);

        if (files.length === 0) return false;

        e.preventDefault();

        // insert at drop position
        const coords = { left: e.clientX, top: e.clientY };
        const pos = view.posAtCoords(coords)?.pos;

        void uploadAndInsertImage(files[0], typeof pos === "number" ? pos : undefined);
        return true;
      },
    },

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

  async function uploadAndInsertImage(file: File, insertPos?: number) {
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

      const { error: upErr } = await supabase.storage
        .from("deus-media")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (upErr) throw upErr;

      const { data } = supabase.storage.from("deus-media").getPublicUrl(path);
      const url = data.publicUrl;

      const chain = editor.chain().focus();

      if (typeof insertPos === "number") {
        chain.insertContentAt(insertPos, {
          type: "image",
          attrs: { src: url, alt: file.name, width: 520 },
        });
      } else {
        chain.setImage({ src: url, alt: file.name, width: 520 });
      }

      chain.run();
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

  if (!editor) return null;

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

        {/* Upload image button */}
        <div className="w-px h-6 bg-white/10 mx-1" />

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

      {imgUploading && <div className="px-4 pt-2 text-xs text-white/60">Uploading image…</div>}
      {imgError && <div className="px-4 pt-2 text-xs text-red-300">{imgError}</div>}

      {/* Editor */}
      <div className="p-4">
        <EditorContent
          editor={editor}
          className="prose prose-invert max-w-none
            prose-h1:text-3xl prose-h1:font-bold
            prose-h2:text-2xl prose-h2:font-semibold
            prose-h3:text-xl prose-h3:font-semibold
            prose-p:text-base prose-p:text-white/85
            prose-li:text-white/85
          "
        />
      </div>

      {/* Hint */}
      <div className="px-4 pb-4 text-[11px] text-white/50">
        Tips: Anda bisa <span className="text-white/70">Ctrl+V</span> untuk paste gambar atau drag file gambar ke editor.
      </div>
    </div>
  );
}
