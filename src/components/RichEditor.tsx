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
   TEXT COLOR PRESETS (BERDASARKAN TEMA)
========================= */
const TEXT_COLOR_PALETTE_DARK = ["#ABF4AB", "#DF9094", "#F0DC88", "#D5D5C9", "#FFFFFF"] as const;
const TEXT_COLOR_PALETTE_LIGHT = ["#30A230", "#B43A40", "#E9BC00", "#787878", "#191919"] as const;

type TextColorDark = (typeof TEXT_COLOR_PALETTE_DARK)[number];
type TextColorLight = (typeof TEXT_COLOR_PALETTE_LIGHT)[number];

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

// Fungsi untuk mengganti warna dalam HTML berdasarkan tema
function convertColorsForTheme(html: string, toLightMode: boolean): string {
  if (toLightMode) {
    // Dark → Light
    return html
      .replace(/color:\s*#ABF4AB/gi, 'color: #30A230')
      .replace(/color:\s*#DF9094/gi, 'color: #B43A40')
      .replace(/color:\s*#F0DC88/gi, 'color: #E9BC00')
      .replace(/color:\s*#D5D5C9/gi, 'color: #787878')
      .replace(/color:\s*#FFFFFF/gi, 'color: #191919')
      // Handle lowercase variants
      .replace(/color:\s*#abf4ab/gi, 'color: #30A230')
      .replace(/color:\s*#df9094/gi, 'color: #B43A40')
      .replace(/color:\s*#f0dc88/gi, 'color: #E9BC00')
      .replace(/color:\s*#d5d5c9/gi, 'color: #787878')
      .replace(/color:\s*#ffffff/gi, 'color: #191919');
  } else {
    // Light → Dark
    return html
      .replace(/color:\s*#30A230/gi, 'color: #ABF4AB')
      .replace(/color:\s*#B43A40/gi, 'color: #DF9094')
      .replace(/color:\s*#E9BC00/gi, 'color: #F0DC88')
      .replace(/color:\s*#787878/gi, 'color: #D5D5C9')
      .replace(/color:\s*#191919/gi, 'color: #FFFFFF')
      // Handle lowercase variants
      .replace(/color:\s*#30a230/gi, 'color: #ABF4AB')
      .replace(/color:\s*#b43a40/gi, 'color: #DF9094')
      .replace(/color:\s*#e9bc00/gi, 'color: #F0DC88')
      .replace(/color:\s*#787878/gi, 'color: #D5D5C9')
      .replace(/color:\s*#191919/gi, 'color: #FFFFFF');
  }
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

  // Link modal state
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const linkInputRef = useRef<HTMLInputElement | null>(null);

  // Theme detection
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [initialThemeChecked, setInitialThemeChecked] = useState(false);

  // Text color state
  const [textColor, setTextColor] = useState<string>("#ABF4AB");

  // Highlight state
  const [hlColor, setHlColor] = useState("#fde047");

  // Get active color palette based on theme
  const activeColorPalette = useMemo(() => {
    return isDarkMode ? TEXT_COLOR_PALETTE_DARK : TEXT_COLOR_PALETTE_LIGHT;
  }, [isDarkMode]);

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
      if (typeof onChangeHtml === "function") {
        // Konversi warna sebelum dikirim ke parent
        const convertedHtml = convertColorsForTheme(html, !isDarkMode);
        onChangeHtml(convertedHtml);
      }
      if (typeof onChangeMarkdown === "function") {
        onChangeMarkdown(htmlToMarkdownSimple(html));
      }
    },
  });

  // Detect theme changes
  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
      
      // Set initial text color based on theme
      if (!initialThemeChecked && activeColorPalette.length > 0) {
        setTextColor(activeColorPalette[0]);
        setInitialThemeChecked(true);
      }
    };

    // Check initial theme
    checkTheme();

    // Observe theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          checkTheme();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, [initialThemeChecked, activeColorPalette]);

  // Update text color when theme changes
  useEffect(() => {
    if (!editor || !initialThemeChecked) return;
    
    const newPalette = isDarkMode ? TEXT_COLOR_PALETTE_DARK : TEXT_COLOR_PALETTE_LIGHT;
    
    // Jika warna saat ini tidak ada di palette baru, reset ke warna pertama palette
if (textColor) {
  const palette = new Set<string>(newPalette as readonly string[]);
  if (!palette.has(textColor)) {
    setTextColor(newPalette[0]);
  }
}

  }, [isDarkMode, editor, textColor, initialThemeChecked]);

  // Convert content colors when theme changes
  useEffect(() => {
    if (!editor || !initialThemeChecked) return;
    
    const currentHtml = editor.getHTML();
    const convertedHtml = convertColorsForTheme(currentHtml, !isDarkMode);
    
    // Only update if content actually changed
    if (currentHtml !== convertedHtml) {
      // Save current selection
      const { from, to } = editor.state.selection;
      
      // Update content
editor.commands.setContent(convertedHtml, {
  emitUpdate: false,
});
      // Try to restore selection (if still valid)
      try {
        if (from <= editor.state.doc.content.size && to <= editor.state.doc.content.size) {
          editor.commands.setTextSelection({ from, to });
        }
      } catch (e) {
        // If selection is invalid, just focus the editor
        editor.commands.focus();
      }
    }
  }, [isDarkMode, editor, initialThemeChecked]);

  // sync editable changes
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  // sync external value changes
  useEffect(() => {
    if (!editor || !initialThemeChecked) return;
    const current = editor.getHTML();
    
    // Konversi value yang masuk agar sesuai dengan tema saat ini
    const convertedValue = convertColorsForTheme(value, !isDarkMode);
    
    if (convertedValue !== current) {
      editor.commands.setContent(convertedValue, { parseOptions: { preserveWhitespace: false } });
    }
  }, [editor, value, isDarkMode, initialThemeChecked]);

  // Ctrl/Cmd + K shortcut
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

  function closeLinkModal() {
    setLinkOpen(false);
    setLinkUrl("");
    setLinkText("");
  }

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

  // Set text color dengan warna dari palette aktif
  function setTextColorCmd(hex: string) {
    if (!editor) return;
    setTextColor(hex);
    editor.chain().focus().setColor(hex).run();
  }

  // Reset to default color berdasarkan tema
  function unsetTextColorCmd() {
    if (!editor) return;
    const defaultColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim() || (isDarkMode ? '#ffffff' : '#000000');
    setTextColor(defaultColor);
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
    <div className="rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[var(--border-main)]">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-2 py-1 rounded-md text-sm border border-[var(--border-main)] hover:bg-[var(--sidebar-hover)] ${
            editor.isActive("bold") ? "bg-[var(--sidebar-hover)]" : ""
          } text-[var(--color-text)]`}
        >
          Bold
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-2 py-1 rounded-md text-sm border border-[var(--border-main)] hover:bg-[var(--sidebar-hover)] ${
            editor.isActive("heading", { level: 1 }) ? "bg-[var(--sidebar-hover)]" : ""
          } text-[var(--color-text)]`}
        >
          H1
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2 py-1 rounded-md text-sm border border-[var(--border-main)] hover:bg-[var(--sidebar-hover)] ${
            editor.isActive("heading", { level: 2 }) ? "bg-[var(--sidebar-hover)]" : ""
          } text-[var(--color-text)]`}
        >
          H2
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`px-2 py-1 rounded-md text-sm border border-[var(--border-main)] hover:bg-[var(--sidebar-hover)] ${
            editor.isActive("heading", { level: 3 }) ? "bg-[var(--sidebar-hover)]" : ""
          } text-[var(--color-text)]`}
        >
          H3
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-2 py-1 rounded-md text-sm border border-[var(--border-main)] hover:bg-[var(--sidebar-hover)] ${
            editor.isActive("bulletList") ? "bg-[var(--sidebar-hover)]" : ""
          } text-[var(--color-text)]`}
        >
          • List
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`px-2 py-1 rounded-md text-sm border border-[var(--border-main)] hover:bg-[var(--sidebar-hover)] ${
            editor.isActive("orderedList") ? "bg-[var(--sidebar-hover)]" : ""
          } text-[var(--color-text)]`}
        >
          1. List
        </button>

        <div className="w-px h-6 bg-[var(--border-main)] mx-1" />

        {/* ✅ Text Color (5 presets based on theme) */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-muted)]">Text</span>

          <div className="flex items-center gap-1">
            {activeColorPalette.map((c) => {
              const active = textColor.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setTextColorCmd(c)}
                  className={`h-8 w-8 rounded-md border transition ${
                    active ? "border-[var(--color-text)]/60" : "border-[var(--border-main)] hover:border-[var(--color-text)]/30"
                  }`}
                  title={c.replace("#", "")}
                  style={{
                    backgroundColor: c,
                    boxShadow: active ? "0 0 0 2px rgba(241,196,15,0.18)" : undefined,
                  }}
                />
              );
            })}
          </div>

          <button
            type="button"
            onClick={unsetTextColorCmd}
            className="px-2 py-1 rounded-md text-xs border border-[var(--border-main)] hover:bg-[var(--sidebar-hover)] text-[var(--color-text)]"
            title="Reset text color"
          >
            Reset
          </button>
        </div>

        {/* Highlight */}
        <div className="flex items-center gap-2 ml-1">
          <span className="text-xs text-[var(--color-muted)]">HL</span>
          <input
            type="color"
            value={hlColor}
            onChange={(e) => setHighlightCmd(e.target.value)}
            className="h-8 w-8 p-0 border border-[var(--border-main)] rounded-md bg-transparent cursor-pointer"
            title="Highlight color"
          />
          <button
            type="button"
            onClick={unsetHighlightCmd}
            className="px-2 py-1 rounded-md text-xs border border-[var(--border-main)] hover:bg-[var(--sidebar-hover)] text-[var(--color-text)]"
            title="Remove highlight"
          >
            Clear
          </button>
        </div>

        <div className="w-px h-6 bg-[var(--border-main)] mx-1" />

        {/* Link */}
        <button
          type="button"
          onClick={openLinkModalFromSelection}
          className={`px-2 py-1 rounded-md text-sm border border-[var(--border-main)] hover:bg-[var(--sidebar-hover)] ${
            editor.isActive("link") ? "bg-[var(--sidebar-hover)]" : ""
          } text-[var(--color-text)]`}
          title={`Insert/edit link (${shortcutLabel})`}
        >
          🔗 Link <span className="text-xs text-[var(--color-muted)] ml-1">{shortcutLabel}</span>
        </button>

        <div className="w-px h-6 bg-[var(--border-main)] mx-1" />

        {/* Upload image button */}
        <button
          type="button"
          onClick={handlePickClick}
          disabled={!editable || imgUploading}
          className="px-2 py-1 rounded-md text-sm border border-[var(--border-main)] hover:bg-[var(--sidebar-hover)] disabled:opacity-60 text-[var(--color-text)]"
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

      {imgError && <div className="px-4 pt-3 text-xs text-red-500">{imgError}</div>}

      {/* Editor */}
      <div className="p-4">
        <EditorContent
          editor={editor}
          className="
            prose prose-invert max-w-none
            prose-h1:text-3xl prose-h1:font-bold
            prose-h2:text-2xl prose-h2:font-semibold
            prose-h3:text-xl prose-h3:font-semibold
            prose-p:text-base prose-p:text-[var(--color-text)]
            prose-li:text-[var(--color-text)]

            [&_ul]:list-disc
            [&_ul]:pl-6
            [&_ol]:list-decimal
            [&_ol]:pl-6
            [&_li]:list-item

            [&_.deus-img]:max-w-full
            [&_.deus-img]:h-auto
            [&_.deus-img]:rounded-xl
            [&_.deus-img]:border
            [&_.deus-img]:border-[var(--border-main)]

            [&_.deus-link]:underline
            [&_.deus-link]:underline-offset-4
            [&_.deus-link]:text-sky-600 dark:text-sky-300
            [&_.deus-link:hover]:text-sky-700 dark:text-sky-200
          "
        />
      </div>

      {/* Link Modal */}
      {linkOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeLinkModal} />

          <div className="relative w-full max-w-md rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] text-[var(--color-text)] shadow-xl">
            <div className="p-4 border-b border-[var(--border-main)]">
              <div className="text-sm font-semibold">Insert / Edit Link</div>
              <div className="text-xs text-[var(--color-muted)] mt-1">
                Shortcut: <span className="text-[var(--color-text)]/80">{shortcutLabel}</span>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <div className="text-xs text-[var(--color-muted)] mb-1">URL</div>
                <input
                  ref={linkInputRef}
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-md px-3 py-2 text-sm outline-none bg-[var(--bg-surface)] border border-[var(--border-main)] placeholder:text-[var(--color-muted)] focus:ring-2"
                  style={{ boxShadow: "0 0 0 2px rgba(241,196,15,0.10)" }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyLink();
                    if (e.key === "Escape") closeLinkModal();
                  }}
                />
              </div>

              {/* Optional text for empty selection */}
              <div>
                <div className="text-xs text-[var(--color-muted)] mb-1">Text (optional)</div>
                <input
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Text yang ditampilkan (kalau tidak pilih teks)"
                  className="w-full rounded-md px-3 py-2 text-sm outline-none bg-[var(--bg-surface)] border border-[var(--border-main)] placeholder:text-[var(--color-muted)] focus:ring-2"
                  style={{ boxShadow: "0 0 0 2px rgba(241,196,15,0.06)" }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyLink();
                    if (e.key === "Escape") closeLinkModal();
                  }}
                />
              </div>

              <div className="text-[11px] text-[var(--color-muted)]">
                Tips: pilih teks dulu lalu tekan {shortcutLabel} untuk edit link pada teks itu.
              </div>
            </div>

            <div className="p-4 border-t border-[var(--border-main)] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().extendMarkRange("link").unsetLink().run();
                  closeLinkModal();
                }}
                className="px-3 py-2 text-sm rounded-md border border-[var(--border-main)] hover:bg-[var(--sidebar-hover)] text-red-500"
                title="Remove link"
              >
                Remove
              </button>

              <button
                type="button"
                onClick={closeLinkModal}
                className="px-3 py-2 text-sm rounded-md border border-[var(--border-main)] hover:bg-[var(--sidebar-hover)]"
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