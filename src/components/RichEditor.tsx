"use client";

import React, { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Heading from "@tiptap/extension-heading";
import Placeholder from "@tiptap/extension-placeholder";

type Props = {
  value?: string; // HTML content (opsional)
  editable?: boolean;

  // ✅ optional callbacks (tidak bikin crash kalau tidak dikirim)
  onChangeHtml?: (html: string) => void;
  onChangeMarkdown?: (md: string) => void;

  placeholder?: string;
};

function htmlToMarkdownSimple(html: string) {
  // Simple fallback: kalau kamu masih simpan markdown, sebaiknya pakai md editor beneran.
  // Tapi untuk sekarang: kita simpan HTML ke content_md kalau kamu mau cepat stabil.
  // (Nanti bisa upgrade pakai turndown)
  return html;
}

export default function RichEditor({
  value = "",
  editable = true,
  onChangeHtml,
  onChangeMarkdown,
  placeholder = "Tulis sesuatu...",
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, // kita pakai Heading extension sendiri
      }),
      Heading.configure({ levels: [1, 2, 3] }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editable,
    immediatelyRender: false, // ✅ FIX SSR hydration tiptap
    onUpdate({ editor }) {
      const html = editor.getHTML();

      // ✅ aman: hanya panggil kalau function ada
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
    // jangan reset kalau sama
    const current = editor.getHTML();
    if (value !== current) editor.commands.setContent(value, { parseOptions: { preserveWhitespace: false } });
  }, [editor, value]);

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
      </div>

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
    </div>
  );
}