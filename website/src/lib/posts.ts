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
  readingTime: number;
}

const WORDS_PER_MINUTE = 200;

function estimateReadingTime(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

const POSTS_DIR = path.join(process.cwd(), "content", "posts");

export const POSTS_PER_PAGE = 5;

export function getAllPosts(): PostMeta[] {
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"));

  const posts = files.map((file) => {
    const slug = file.replace(/\.md$/, "");
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf-8");
    const { data, content } = matter(raw);
    return {
      slug,
      title: (data.title as string) ?? "",
      date: (data.date as string) ?? "",
      release: (data.release as string) ?? "",
      tags: (data.tags as string[]) ?? [],
      excerpt: (data.excerpt as string) ?? "",
      og: data.og as PostOg | undefined,
      readingTime: estimateReadingTime(content),
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

export async function getPostBySlug(
  slug: string,
): Promise<{ meta: PostMeta; html: string } | null> {
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
    readingTime: estimateReadingTime(content),
  };

  let processedContent = content;
  if (processedContent.includes(":::contributors:::")) {
    if (meta.release) {
      const usernames = await fetchReleaseContributors(meta.release);
      processedContent = processedContent.replace(
        ":::contributors:::",
        renderContributorsHtml(usernames, meta.release),
      );
    } else {
      processedContent = processedContent.replace(":::contributors:::", "");
    }
  }

  const html = marked.parse(processedContent) as string;
  return { meta, html };
}

async function fetchReleaseContributors(tag: string): Promise<string[]> {
  try {
    const headers = { Accept: "application/vnd.github+json" };
    const relRes = await fetch(
      "https://api.github.com/repos/debba/tabularis/releases?per_page=100",
      { headers },
    );
    const releases: { tag_name: string; published_at: string }[] =
      await relRes.json();
    const idx = releases.findIndex((r) => r.tag_name === tag);
    const prevTag =
      idx >= 0 && idx + 1 < releases.length
        ? releases[idx + 1].tag_name
        : null;
    if (!prevTag) return [];

    const users = new Set<string>();

    const cmpRes = await fetch(
      `https://api.github.com/repos/debba/tabularis/compare/${prevTag}...${tag}`,
      { headers },
    );
    const data: {
      commits: { author: { login: string; type: string } | null }[];
    } = await cmpRes.json();
    for (const commit of data.commits ?? []) {
      const author = commit.author;
      if (
        author?.login &&
        author.type !== "Bot" &&
        !author.login.endsWith("[bot]")
      ) {
        users.add(author.login);
      }
    }

    const prevDate = releases[idx + 1].published_at;
    const curDate = releases[idx].published_at;
    if (prevDate && curDate) {
      const prsRes = await fetch(
        `https://api.github.com/search/issues?q=repo:debba/tabularis+is:pr+is:merged+merged:${prevDate}..${curDate}&per_page=100`,
        { headers },
      );
      const prsData: {
        items: { user: { login: string; type: string } | null }[];
      } = await prsRes.json();
      for (const pr of prsData.items ?? []) {
        const user = pr.user;
        if (
          user?.login &&
          user.type !== "Bot" &&
          !user.login.endsWith("[bot]")
        ) {
          users.add(user.login);
        }
      }
    }

    return Array.from(users);
  } catch {
    return [];
  }
}

function renderContributorsHtml(usernames: string[], release?: string): string {
  if (!usernames.length) return "";
  const label = release ? `Contributors in ${release}` : "Contributors";
  const items = usernames
    .map(
      (u) =>
        `<a class="contributor-item" href="https://github.com/${u}" target="_blank" rel="noopener noreferrer">` +
        `<img src="https://github.com/${u}.png?size=64" alt="${u}" class="contributor-avatar" width="52" height="52" />` +
        `<span class="contributor-name">@${u}</span>` +
        `</a>`,
    )
    .join("");
  return `<div class="contributors-block"><span class="contributors-label">${label}</span><div class="contributors-list">${items}</div></div>`;
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
  const hasTime = iso.includes("T");
  const d = new Date(hasTime ? iso : iso + "T12:00:00Z");
  const dateStr = d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  if (hasTime) {
    return `${dateStr}, ${iso.slice(11, 16)}`;
  }
  return dateStr;
}
