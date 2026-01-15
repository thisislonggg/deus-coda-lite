"use client";

import React, { useMemo, useState } from "react";

const PRESET: Record<string, string[]> = {
  Folder: ["📁","📂","🗂️","🧩","🧠","🗃️"],
  SOP: ["📜","🧾","✅","📝","📌","🔒"],
  Calendar: ["🗓️","📅","⏰","🕒","🗓","🔔"],
  Report: ["📊","📈","📉","🧮","🗒️","📑"],
  Link: ["🔗","🌐","🧷","📎","🪝","🧭"],
  General: ["⭐","🔥","💡","🎯","🧱","🧰","🧪","🚀","🧷","📌"],
};

type Props = {
  value?: string | null;
  onPick: (icon: string | null) => void;
  kind?: keyof typeof PRESET;
};

export default function IconPicker({ value, onPick, kind = "General" }: Props) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  const list = useMemo(() => [...(PRESET[kind] ?? []), ...PRESET.General], [kind]);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 grid place-items-center text-xl"
        title="Ubah icon"
      >
        {value?.trim() ? value : "📄"}
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-72 rounded-2xl border border-white/10 bg-slate-950 shadow-xl p-3">
          <div className="text-xs text-white/60 mb-2">Pilih icon</div>

          <div className="grid grid-cols-8 gap-1">
            {list.map((ic) => (
              <button
                key={ic}
                type="button"
                className="h-9 w-9 rounded-lg hover:bg-white/10 grid place-items-center text-lg"
                onClick={() => {
                  onPick(ic);
                  setOpen(false);
                }}
              >
                {ic}
              </button>
            ))}
          </div>

          <div className="h-px bg-white/10 my-3" />

          <div className="text-xs text-white/60 mb-2">Custom (paste emoji sendiri)</div>
          <div className="flex gap-2">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="contoh: 🧾"
              className="flex-1 rounded-md bg-white/5 border border-white/10 px-2 py-2 text-sm text-white outline-none"
            />
            <button
              type="button"
              className="px-3 py-2 rounded-md text-sm border border-white/10 hover:bg-white/10"
              onClick={() => {
                const ic = custom.trim();
                if (ic) onPick(ic);
                setCustom("");
                setOpen(false);
              }}
            >
              Set
            </button>
          </div>

          <button
            type="button"
            className="mt-3 text-xs text-white/60 hover:text-white"
            onClick={() => {
              onPick(null);
              setOpen(false);
            }}
          >
            Hapus icon
          </button>
        </div>
      )}
    </div>
  );
}
