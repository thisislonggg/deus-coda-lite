"use client";

import React, { useEffect, useRef } from "react";
import { NodeViewWrapper } from "@tiptap/react";

type Props = {
  node: any;
  selected: boolean;
  updateAttributes: (attrs: Record<string, any>) => void;
};

export default function ResizableImage({ node, selected, updateAttributes }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const start = useRef<{ x: number; w: number } | null>(null);

  const src = node.attrs.src as string;
  const alt = node.attrs.alt as string | undefined;
  const width = node.attrs.width as number | null;

  function onMouseDownHandle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    start.current = { x: e.clientX, w: rect.width };

    const onMove = (ev: MouseEvent) => {
      if (!start.current) return;
      const dx = ev.clientX - start.current.x;
      const nextW = Math.max(120, Math.min(start.current.w + dx, 1200));
      updateAttributes({ width: Math.round(nextW) });
    };

    const onUp = () => {
      start.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  useEffect(() => {
    return () => {
      // safety cleanup (kalau komponen unmount pas drag)
      start.current = null;
    };
  }, []);

  return (
    <NodeViewWrapper className="inline-block">
      <div data-drag-handle
        ref={containerRef}
        className={[
          "relative inline-block max-w-full","cursor-move select-none",
          selected ? "outline outline-2 outline-white/20 rounded-xl" : "",
        ].join(" ")}
        style={{
          width: typeof width === "number" && width > 0 ? `${width}px` : "auto",
          maxWidth: "100%",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt ?? ""}
          draggable={false}
          className="block w-full h-auto rounded-xl border border-white/10"
        />

        <div
          onMouseDown={onMouseDownHandle}
          className={[
            "absolute -right-2 -bottom-2 h-4 w-4 rounded-sm",
            "bg-white/80 border border-black/40 cursor-se-resize",
            selected ? "block" : "hidden",
          ].join(" ")}
          title="Drag untuk resize"
        />
      </div>
    </NodeViewWrapper>
  );
}
