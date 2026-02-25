import fs from "fs";
import path from "path";
import { marked } from "marked";

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  release: string;
  tags: string[];
  excerpt: string;
}

const CONTENT_DIR = path.join(process.cwd(), "content");

export function getAllPosts(): PostMeta[] {
  const raw = fs.readFileSync(path.join(CONTENT_DIR, "posts.json"), "utf-8");
  return JSON.parse(raw) as PostMeta[];
}

export function getPostBySlug(slug: string): {
  meta: PostMeta;
  html: string;
} | null {
  const posts = getAllPosts();
  const meta = posts.find((p) => p.slug === slug);
  if (!meta) return null;

  const mdPath = path.join(CONTENT_DIR, "posts", `${slug}.md`);
  if (!fs.existsSync(mdPath)) return null;

  const md = fs.readFileSync(mdPath, "utf-8");
  const html = marked.parse(md) as string;

  return { meta, html };
}

export function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
