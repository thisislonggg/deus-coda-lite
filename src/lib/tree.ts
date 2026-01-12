export type PageRow = {
  id: string;
  parent_id: string | null;
  title: string;
  slug: string;
  icon: string | null;
  type: "doc" | "sop" | "report" | "calendar" | "folder";
  status: "draft" | "published" | "archived";
  updated_at?: string;
};

export type PageNode = PageRow & { children: PageNode[] };

export function buildTree(rows: PageRow[]) {
  const map = new Map<string, PageNode>();
  for (const r of rows) map.set(r.id, { ...r, children: [] });

  const roots: PageNode[] = [];
  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort biar rapi (folder dulu, lalu alfabet)
  const sortRec = (nodes: PageNode[]) => {
    nodes.sort((a, b) => {
      const aFolder = a.type === "folder" ? 0 : 1;
      const bFolder = b.type === "folder" ? 0 : 1;
      if (aFolder !== bFolder) return aFolder - bFolder;
      return a.title.localeCompare(b.title);
    });
    nodes.forEach((n) => sortRec(n.children));
  };

  sortRec(roots);
  return roots;
}

export function flattenIds(nodes: PageNode[]) {
  const ids: string[] = [];
  const walk = (n: PageNode[]) => {
    for (const x of n) {
      ids.push(x.id);
      walk(x.children);
    }
  };
  walk(nodes);
  return ids;
}
