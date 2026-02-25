import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { marked } from "@/lib/markdown";

export interface PostOg {
  title: string;
  accent: string;
  claim: string;
  image: string;
}

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  release: string;
  tags: string[];
  excerpt: string;
  og?: PostOg;
}

const POSTS_DIR = path.join(process.cwd(), "content", "posts");

export const POSTS_PER_PAGE = 5;

export function getAllPosts(): PostMeta[] {
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"));

  const posts = files.map((file) => {
    const slug = file.replace(/\.md$/, "");
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf-8");
    const { data } = matter(raw);
    return {
      slug,
      title: (data.title as string) ?? "",
      date: (data.date as string) ?? "",
      release: (data.release as string) ?? "",
      tags: (data.tags as string[]) ?? [],
      excerpt: (data.excerpt as string) ?? "",
      og: data.og as PostOg | undefined,
    } satisfies PostMeta;
  });

  // Sort by date descending; use slug as stable tiebreaker
  return posts.sort((a, b) => {
    const d = b.date.localeCompare(a.date);
    return d !== 0 ? d : a.slug.localeCompare(b.slug);
  });
}

export function getPaginatedPosts(page: number): {
  posts: PostMeta[];
  totalPages: number;
  currentPage: number;
} {
  const all = getAllPosts();
  const totalPages = Math.max(1, Math.ceil(all.length / POSTS_PER_PAGE));
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const start = (currentPage - 1) * POSTS_PER_PAGE;
  return {
    posts: all.slice(start, start + POSTS_PER_PAGE),
    totalPages,
    currentPage,
  };
}

export function getAllTags(): string[] {
  const tagSet = new Set<string>();
  getAllPosts().forEach((p) => p.tags.forEach((t) => tagSet.add(t)));
  return Array.from(tagSet).sort();
}

export function getPostsByTag(tag: string): PostMeta[] {
  return getAllPosts().filter((p) => p.tags.includes(tag));
}

export function getPostBySlug(
  slug: string
): { meta: PostMeta; html: string } | null {
  const mdPath = path.join(POSTS_DIR, `${slug}.md`);
  if (!fs.existsSync(mdPath)) return null;

  const raw = fs.readFileSync(mdPath, "utf-8");
  const { data, content } = matter(raw);

  const meta: PostMeta = {
    slug,
    title: (data.title as string) ?? "",
    date: (data.date as string) ?? "",
    release: (data.release as string) ?? "",
    tags: (data.tags as string[]) ?? [],
    excerpt: (data.excerpt as string) ?? "",
    og: data.og as PostOg | undefined,
  };

  const html = marked.parse(content) as string;
  return { meta, html };
}

export function getAdjacentPosts(slug: string): {
  prev: PostMeta | null;
  next: PostMeta | null;
} {
  const all = getAllPosts();
  const idx = all.findIndex((p) => p.slug === slug);
  return {
    prev: idx > 0 ? all[idx - 1] : null,
    next: idx < all.length - 1 ? all[idx + 1] : null,
  };
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
