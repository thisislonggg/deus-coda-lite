"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type SidebarCtx = {
  isDesktopOpen: boolean;
  toggleDesktopSidebar: () => void;
};

const SidebarContext = createContext<SidebarCtx | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isDesktopOpen, setIsDesktopOpen] = useState(true);

  function toggleDesktopSidebar() {
    setIsDesktopOpen((v) => !v);
  }

  return (
    <SidebarContext.Provider value={{ isDesktopOpen, toggleDesktopSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside SidebarProvider");
  return ctx;
}
