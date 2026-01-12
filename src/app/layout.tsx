import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Deus Code",
  description: "SOP & Admin Docs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="bg-neutral-50 text-neutral-900">{children}</body>
    </html>
  );
}
