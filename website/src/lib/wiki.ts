import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { marked } from "@/lib/markdown";

export interface WikiMeta {
  slug: string;
  title: string;
  order: number;
  excerpt: string;
}

const WIKI_DIR = path.join(process.cwd(), "content", "wiki");

export function getAllWikiPages(): WikiMeta[] {
  if (!fs.existsSync(WIKI_DIR)) return [];
  const files = fs.readdirSync(WIKI_DIR).filter((f) => f.endsWith(".md"));

  const pages = files.map((file) => {
    const slug = file.replace(/\.md$/, "");
    const raw = fs.readFileSync(path.join(WIKI_DIR, file), "utf-8");
    const { data } = matter(raw);
    return {
      slug,
      title: (data.title as string) ?? "",
      order: (data.order as number) ?? 99,
      excerpt: (data.excerpt as string) ?? "",
    } satisfies WikiMeta;
  });

  return pages.sort((a, b) => a.order - b.order);
}

export function getWikiPageBySlug(
  slug: string
): { meta: WikiMeta; html: string } | null {
  const mdPath = path.join(WIKI_DIR, `${slug}.md`);
  if (!fs.existsSync(mdPath)) return null;

  const raw = fs.readFileSync(mdPath, "utf-8");
  const { data, content } = matter(raw);

  const meta: WikiMeta = {
    slug,
    title: (data.title as string) ?? "",
    order: (data.order as number) ?? 99,
    excerpt: (data.excerpt as string) ?? "",
  };

  const html = marked.parse(content) as string;
  return { meta, html };
}

export function getAdjacentWikiPages(slug: string): {
  prev: WikiMeta | null;
  next: WikiMeta | null;
} {
  const all = getAllWikiPages();
  const idx = all.findIndex((p) => p.slug === slug);
  return {
    prev: idx > 0 ? all[idx - 1] : null,
    next: idx < all.length - 1 ? all[idx + 1] : null,
  };
}
