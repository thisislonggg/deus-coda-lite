"use client";

import React from "react";

export default function MarkdownView({ html }: { html: string }) {
  const safeHtml = (html ?? "").trim();

  if (!safeHtml) {
    return <div className="text-white/60">Belum ada konten.</div>;
  }

  return (
    <div
      className="
        dc-content
        max-w-full min-w-0
        whitespace-pre-wrap break-words [overflow-wrap:anywhere]

        [&_p]:text-white/85
        [&_li]:text-white/85

        /* Image handling */
        [&_img]:max-w-full
        [&_img]:h-auto
        [&_img]:rounded-xl
        [&_img]:border
        [&_img]:border-white/10
        [&_img]:my-4

        /* Links */
        [&_a]:break-all
        [&_a]:text-sky-300
        [&_a:hover]:underline

        /* Tables (kalau suatu saat ada) */
        [&_table]:block
        [&_table]:max-w-full
        [&_table]:overflow-x-auto
      "
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
