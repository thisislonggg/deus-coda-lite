import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Deus Code",
  description: "SOP & Admin Docs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  const saved = localStorage.getItem("theme");
                  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                  const theme = saved || (prefersDark ? "dark" : "light");
                  document.documentElement.classList.add(theme);
                  localStorage.setItem("theme", theme);
                } catch {}
              })();
            `,
          }}
        />
      </head>
      <body className="bg-[var(--color-bg)] text-[var(--color-text)] transition-colors">
        {children}
      </body>
    </html>
  );
}
