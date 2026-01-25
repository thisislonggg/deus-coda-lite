"use client";

import { useEffect, useState } from "react";
import SidebarTree from "../../components/SidebarTree";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  // Sync tema dengan localStorage
  useEffect(() => {
    const handleThemeChange = () => {
      const theme = localStorage.getItem('theme') || 'dark';
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
    };

    // Listen for storage events (when theme changes in another tab)
    window.addEventListener('storage', handleThemeChange);
    
    // Initial sync
    handleThemeChange();
    
    return () => {
      window.removeEventListener('storage', handleThemeChange);
    };
  }, []);

  // ESC untuk tutup drawer
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Kalau resize ke desktop, auto tutup drawer
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) setOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* Topbar (mobile only) */}
      <div className="md:hidden sticky top-0 z-[60] border-b border-[var(--border-main)] bg-[var(--bg-main)]/80 backdrop-blur">
        <div className="h-14 px-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-white/15 hover:bg-white/10"
          >
            <span className="text-lg leading-none">☰</span>
            <span className="text-sm font-semibold">Menu</span>
          </button>

          <div className="text-sm text-[var(--text-muted)] truncate max-w-[60%]">
            Deus Coda Lite
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-0px)] overflow-hidden">
        {/* Sidebar (desktop only) */}
        <div className="hidden md:block w-[320px] shrink-0 sticky top-0 h-screen">
          <div className="h-screen overflow-hidden">
            <SidebarTree />
          </div>
        </div>

        {/* Sidebar Drawer (mobile) */}
        {open && (
          <>
            {/* overlay */}
            <div
              className="fixed inset-0 z-[70] bg-black/60"
              onClick={() => setOpen(false)}
            />

            {/* drawer */}
            <div className="fixed inset-y-0 left-0 z-[80] w-[320px] max-w-[85vw]">
              <div className="h-full bg-[var(--bg-main)] border-r border-[var(--border-main)]">
                <div className="flex items-center justify-between px-3 py-3 border-b border-[var(--border-main)]">
                  <div className="text-sm font-semibold text-[var(--text-muted)]">
                    Navigation
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="px-2 py-1 rounded-md border border-white/15 hover:bg-white/10 text-sm"
                  >
                    ✕
                  </button>
                </div>

                <div className="h-[calc(100vh-52px)] overflow-hidden">
                  <SidebarTree />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Konten kanan yang scroll */}
        <main className="flex-1 min-w-0 h-screen overflow-y-auto bg-[var(--bg-main)]">
          <div className="px-4 md:px-6 py-4 md:py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}