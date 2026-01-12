"use client";

import { useEffect, useState } from "react";
import SidebarTree from "@/components/SidebarTree";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  // ✅ ESC close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ✅ kalau pindah ke desktop, tutup drawer biar aman
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) setOpen(false); // md breakpoint
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* TOP BAR (mobile only) */}
      <div className="md:hidden sticky top-0 z-[60] border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="h-14 px-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-white/15 hover:bg-white/10"
          >
            <span className="text-lg leading-none">☰</span>
            <span className="text-sm font-semibold">Menu</span>
          </button>

          <div className="text-sm text-white/70 truncate max-w-[55%]">
            Deus Coda Lite
          </div>
        </div>
      </div>

      <div className="flex">
        {/* DESKTOP SIDEBAR */}
        <div className="hidden md:block">
          <SidebarTree showDrafts />
        </div>

        {/* MOBILE DRAWER SIDEBAR */}
        {open && (
          <>
            {/* overlay */}
            <div
              className="fixed inset-0 z-[70] bg-black/60"
              onClick={() => setOpen(false)}
            />

            {/* drawer */}
            <div className="fixed z-[80] inset-y-0 left-0 w-[320px] max-w-[85vw]">
              <div className="h-full">
                {/* header drawer */}
                <div className="md:hidden flex items-center justify-between px-3 py-3 border-b border-white/10 bg-slate-950">
                  <div className="text-sm font-semibold text-white/80">Navigation</div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="px-2 py-1 rounded-md border border-white/15 hover:bg-white/10 text-sm"
                  >
                    ✕
                  </button>
                </div>

                {/* sidebar */}
                <SidebarTree showDrafts />
              </div>
            </div>
          </>
        )}

        {/* MAIN CONTENT */}
        <main className="flex-1 min-w-0">
          {/* ✅ padding responsive biar enak di mobile */}
          <div className="px-4 md:px-6 py-4 md:py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
