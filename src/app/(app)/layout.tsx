"use client";

import { SidebarProvider } from "@/context/SidebarContext";
import AppShell from "@/components/AppShell";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppShell>{children}</AppShell>
    </SidebarProvider>
  );
}
