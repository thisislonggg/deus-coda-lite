import SidebarTree from "../../components/SidebarTree";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar nempel */}
      <div className="w-[320px] shrink-0 sticky top-0 h-screen">
        {/* SidebarTree kamu sudah h-screen */}
        {/* (opsional) kasih overflow hidden biar dropdown ga kepotong) */}
        <div className="h-screen overflow-hidden">
          {/* @ts-ignore */}
          <SidebarTree />
        </div>
      </div>

      {/* Konten kanan yang scroll */}
      <main className="flex-1 h-screen overflow-y-auto bg-neutral-50">
        {children}
      </main>
    </div>
  );
}

