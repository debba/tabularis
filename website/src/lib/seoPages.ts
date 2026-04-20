import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { marked } from "@/lib/markdown";
import { wrapVideosInHtml } from "@/lib/markdownVideos";

export type SeoSection = "solutions" | "compare";

export interface SeoMeta {
  slug: string;
  title: string;
  metaTitle?: string;
  order: number;
  excerpt: string;
  description: string;
  section: SeoSection;
  image?: string;
  audience?: string;
  useCase?: string;
  format?: string;
}

const SEO_DIR = path.join(process.cwd(), "content", "seo");

function parseSeoMeta(slug: string, data: Record<string, unknown>): SeoMeta {
  return {
    slug,
    title: (data.title as string) ?? "",
    metaTitle: data.metaTitle as string | undefined,
    order: (data.order as number) ?? 99,
    excerpt: (data.excerpt as string) ?? "",
    description: (data.description as string) ?? "",
    section: (data.section as SeoSection) ?? "solutions",
    image: data.image as string | undefined,
    audience: data.audience as string | undefined,
    useCase: data.useCase as string | undefined,
    format: data.format as string | undefined,
  };
}

export function getAllSeoPages(): SeoMeta[] {
  if (!fs.existsSync(SEO_DIR)) return [];
  const files = fs.readdirSync(SEO_DIR).filter((f) => f.endsWith(".md"));

  const pages = files.map((file) => {
    const slug = file.replace(/\.md$/, "");
    const raw = fs.readFileSync(path.join(SEO_DIR, file), "utf-8");
    const { data } = matter(raw);
    return parseSeoMeta(slug, data);
  });

  return pages.sort((a, b) => {
    const sectionDiff = a.section.localeCompare(b.section);
    if (sectionDiff !== 0) return sectionDiff;
    return a.order - b.order;
  });
}

export function getSeoPagesBySection(section: SeoSection): SeoMeta[] {
  return getAllSeoPages().filter((page) => page.section === section);
}

export function getSeoPageBySlug(
  section: SeoSection,
  slug: string,
): { meta: SeoMeta; html: string } | null {
  const mdPath = path.join(SEO_DIR, `${slug}.md`);
  if (!fs.existsSync(mdPath)) return null;

  const raw = fs.readFileSync(mdPath, "utf-8");
  const { data, content } = matter(raw);
  const meta = parseSeoMeta(slug, data);

  if (meta.section !== section) return null;

  return { meta, html: wrapVideosInHtml(marked.parse(content) as string) };
}

export function getAdjacentSeoPages(section: SeoSection, slug: string): {
  prev: SeoMeta | null;
  next: SeoMeta | null;
} {
  const all = getSeoPagesBySection(section);
  const idx = all.findIndex((page) => page.slug === slug);

  return {
    prev: idx > 0 ? all[idx - 1] : null,
    next: idx < all.length - 1 ? all[idx + 1] : null,
  };
}

export function getSeoSectionLabel(section: SeoSection): string {
  return section === "compare" ? "Compare" : "Solutions";
}

export function getSeoPagePath(section: SeoSection, slug: string): string {
  return `/${section}/${slug}`;
}
