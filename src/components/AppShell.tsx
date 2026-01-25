"use client";

import { useEffect, useState } from "react";
import SidebarTree from "@/components/SidebarTree";
import { useSidebar } from "@/context/SidebarContext";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { isDesktopOpen, toggleDesktopSidebar } = useSidebar();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) setMobileOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function toggleTheme() {
    const html = document.documentElement;
    const next = html.classList.contains("dark") ? "light" : "dark";
    html.classList.remove("light", "dark");
    html.classList.add(next);
    localStorage.setItem("theme", next);
  }

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* ================= MOBILE TOP BAR ================= */}
      <div className="md:hidden sticky top-0 z-50 border-b border-[var(--border-main)] bg-[var(--color-bg)]">
        <div className="h-14 px-4 flex items-center justify-between">
          {/* Left */}
          <button
            onClick={() => setMobileOpen(true)}
            className="h-9 w-9 flex items-center justify-center rounded-md border border-[var(--border-main)]"
            aria-label="Open menu"
          >
            ☰
          </button>

          {/* Right */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="h-9 px-2 rounded-md border border-[var(--border-main)] text-sm"
              aria-label="Toggle theme"
            >
              🌙 / ☀️
            </button>
            <span className="text-sm font-medium text-[var(--color-muted)]">
              Deus Code
            </span>
          </div>
        </div>
      </div>

      {/* ================= MAIN LAYOUT ================= */}
      <div className="flex">
        {/* DESKTOP SIDEBAR */}
        {isDesktopOpen && (
          <aside className="hidden md:block w-[320px] h-screen border-r border-[var(--border-main)]">
            <SidebarTree />
          </aside>
        )}

        {/* MAIN CONTENT */}
        <main className="flex-1 min-w-0 relative">
          {/* DESKTOP CONTENT HEADER */}
          <div className="hidden md:flex items-center gap-3 sticky top-0 z-30 border-b border-[var(--border-main)] bg-[var(--color-bg)] px-4 py-3">
            <button
              type="button"
              onClick={toggleDesktopSidebar}
              className="h-10 w-10 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] flex items-center justify-center text-xl shrink-0"
              title={isDesktopOpen ? "Tutup Menu" : "Buka Menu"}
            >
              {isDesktopOpen ? "←" : "☰"}
            </button>
            <div className="flex-1 min-w-0" />
          </div>

          {/* CONTENT WRAPPER */}
          <div className="px-4 md:px-6 py-4 md:py-6">
            {children}
          </div>
        </main>
      </div>

      {/* ================= MOBILE DRAWER ================= */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-60 w-[320px] bg-[var(--color-bg)] border-r border-[var(--border-main)]">
            <SidebarTree />
          </div>
        </>
      )}
    </div>
  );
}
