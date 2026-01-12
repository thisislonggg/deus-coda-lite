"use client";

import React from "react";

export default function MarkdownView({ html }: { html: string }) {
  const safeHtml = (html ?? "").trim();

  if (!safeHtml) {
    return <div className="text-white/60">Belum ada konten.</div>;
  }

  return (
    <div className="dc-content" dangerouslySetInnerHTML={{ __html: safeHtml }} />
  );
}
