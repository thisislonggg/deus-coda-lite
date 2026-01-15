import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import ResizableImage from "./ResizableImage";

export const ResizableImageExtension = Image.extend({

      draggable: true, // ✅ bisa dipindah dengan drag


  addAttributes() {
    return {
      ...this.parent?.(),

      width: {
        default: null,
        parseHTML: (element) => {
          const wAttr = element.getAttribute("width");
          if (wAttr) return Number(wAttr);

          const style = element.getAttribute("style") ?? "";
          const match = style.match(/width:\s*(\d+)px/);
          return match ? Number(match[1]) : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.width) return {};

          // ✅ simpan ke HTML agar persist di DB
          return {
            width: attributes.width,
            style: `width: ${attributes.width}px; max-width: 100%; height: auto;`,
          };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImage);
  },
});
