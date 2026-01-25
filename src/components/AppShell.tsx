"use client";

import { useEffect, useState } from "react";
import SidebarTree from "@/components/SidebarTree";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // mount guard (hindari hydration mismatch)
  useEffect(() => {
    setMounted(true);
  }, []);

  // ESC close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // resize close
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) setOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // theme toggle (GLOBAL)
  function toggleTheme() {
    const html = document.documentElement;
    const next = html.classList.contains("dark") ? "light" : "dark";
    html.classList.remove("light", "dark");
    html.classList.add(next);
    localStorage.setItem("theme", next);
  }

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] transition-colors">
      {/* TOP BAR (mobile only) */}
      <div className="md:hidden sticky top-0 z-[60] border-b border-black/10 dark:border-[var(--border-main)] bg-[var(--color-bg)]/80 backdrop-blur">
        <div className="h-14 px-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-black/10 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10 text-[var(--color-text)]"
          >
            <span className="text-lg leading-none">☰</span>
            <span className="text-sm font-semibold">Menu</span>
          </button>

          <div className="flex items-center gap-3">
            {/* THEME SWITCH (mobile) */}
            <button
              type="button"
              onClick={toggleTheme}
              className="px-2 py-1 rounded-md border border-black/10 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10 text-sm text-[var(--color-text)]"
              title="Toggle theme"
            >
              🌙 / ☀️
            </button>

            <div className="text-sm text-[var(--color-muted)] truncate max-w-[40vw]">
              Deus Code Lite
            </div>
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
            <div
              className="fixed inset-0 z-[70] bg-black/60"
              onClick={() => setOpen(false)}
            />

            <div className="fixed z-[80] inset-y-0 left-0 w-[320px] max-w-[85vw]">
              <div className="h-full bg-[var(--color-bg)]">
                <div className="md:hidden flex items-center justify-between px-3 py-3 border-b border-black/10 dark:border-[var(--border-main)]">
                  <div className="text-sm font-semibold text-[var(--color-muted)]">
                    Navigation
                  </div>

                  <div className="flex items-center gap-2">
                    {/* THEME SWITCH (drawer) */}
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="px-2 py-1 rounded-md border border-black/10 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10 text-sm text-[var(--color-text)]"
                    >
                      🌙 / ☀️
                    </button>

                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="px-2 py-1 rounded-md border border-black/10 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10 text-sm text-[var(--color-text)]"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <SidebarTree showDrafts />
              </div>
            </div>
          </>
        )}

        {/* MAIN CONTENT */}
        <main className="flex-1 min-w-0">
          <div className="px-4 md:px-6 py-4 md:py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}