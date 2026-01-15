"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

type Props = {
  folder: string; // contoh: "pages/<pageId>" atau "avatars/<userId>"
  onUploaded: (payload: { url: string; path: string }) => void;
  maxMB?: number;
};

export default function ImageUploader({ folder, onUploaded, maxMB = 3 }: Props) {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function handlePick(file: File | null) {
    setError(null);
    setPreview(null);

    if (!file) return;

    // basic validation
    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar (jpg/png/webp).");
      return;
    }
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxMB) {
      setError(`Ukuran file terlalu besar. Maksimal ${maxMB} MB.`);
      return;
    }

    // local preview
    setPreview(URL.createObjectURL(file));

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${Date.now()}.${ext}`;
      const path = `${folder}/${fileName}`;

      const { error: upErr } = await supabase.storage
        .from("deus-media")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (upErr) throw upErr;

      // get public url
      const { data } = supabase.storage.from("deus-media").getPublicUrl(path);
      const url = data.publicUrl;

      onUploaded({ url, path });
    } catch (e: any) {
      setError(e?.message ?? "Upload gagal.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
      <div className="text-sm font-semibold text-white/85 mb-2">Upload Foto</div>

      <input
        type="file"
        accept="image/*"
        disabled={uploading}
        onChange={(e) => handlePick(e.target.files?.[0] ?? null)}
        className="block w-full text-sm text-white/70 file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-2 file:bg-white/10 file:text-white hover:file:bg-white/15"
      />

      {uploading && <div className="text-xs text-white/60 mt-2">Uploading...</div>}
      {error && <div className="text-xs text-red-300 mt-2">{error}</div>}

      {preview && (
        <div className="mt-3 rounded-lg overflow-hidden border border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="preview" className="w-full max-h-64 object-cover" />
        </div>
      )}
    </div>
  );
}
