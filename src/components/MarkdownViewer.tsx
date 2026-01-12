"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownView({ markdown }: { markdown: string }) {
  return (
    <article className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-3xl font-bold mt-6 mb-3">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl font-semibold mt-5 mb-3">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xl font-semibold mt-4 mb-2">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-base leading-relaxed text-white/85 mb-2">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-6 mb-3">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 mb-3">{children}</ol>
          ),
          li: ({ children }) => <li className="mb-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-yellow-400/60 pl-4 italic text-white/70 my-4">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="px-1.5 py-0.5 rounded bg-black/40 text-yellow-300 text-sm">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="p-4 rounded-lg bg-black/50 overflow-x-auto text-sm mb-4">
              {children}
            </pre>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  );
}