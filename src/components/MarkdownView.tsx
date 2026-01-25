"use client";

import React from "react";

export default function MarkdownView({ html }: { html: string }) {
  const safeHtml = (html ?? "").trim();

  if (!safeHtml) {
    return <div className="text-[var(--color-muted)]">Belum ada konten.</div>;
  }

  return (
    <div
      className="
        dc-content
        max-w-full min-w-0
        whitespace-pre-wrap break-words [overflow-wrap:anywhere]
        text-[var(--color-text)]

        /* Lists */
        [&_li]:text-[var(--color-text)]

        /* Highlight defaults (jika mark tanpa style) */
        [&_mark]:rounded-sm
        [&_mark]:px-1
        [&_mark]:bg-yellow-200 dark:bg-yellow-800

        /* Images */
        [&_img]:max-w-full
        [&_img]:h-auto
        [&_img]:rounded-xl
        [&_img]:border
        [&_img]:border-[var(--border-main)]
        [&_img]:my-4

        /* Links */
        [&_a]:break-all
        [&_a]:text-sky-600 dark:text-sky-300
        [&_a:hover]:underline

        /* Tables */
        [&_table]:block
        [&_table]:max-w-full
        [&_table]:overflow-x-auto
        [&_table]:border-[var(--border-main)]
        [&_td]:border-[var(--border-main)]
        [&_th]:border-[var(--border-main)]
        [&_th]:bg-[var(--bg-card)]
      "
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}