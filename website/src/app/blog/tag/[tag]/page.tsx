import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogHeader } from "@/components/BlogHeader";
import { GitHubIcon, DiscordIcon } from "@/components/Icons";
import { PostCard } from "@/components/PostCard";
import { getAllTags, getPostsByTag } from "@/lib/posts";

export function generateStaticParams() {
  return getAllTags().map((tag) => ({ tag }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  return {
    title: `#${tag} | Tabularis Blog`,
    description: `All Tabularis blog posts tagged with "${tag}".`,
  };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  const posts = getPostsByTag(tag);

  if (!posts.length) notFound();

  return (
    <div className="container">
      <BlogHeader
        crumbs={[
          { label: "blog", href: "/blog" },
          { label: `#${tag}` },
        ]}
      />

      <section>
        <h2>_blog</h2>

        <div className="tag-page-header">
          <span className="tag-page-label">
            {posts.length} {posts.length === 1 ? "post" : "posts"} tagged
          </span>
          <span className="post-tag tag-page-tag">{tag}</span>
        </div>

        <div className="post-list">
          {posts.map((p) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </div>

        <div className="cta-strip">
          <a className="btn-cta" href="https://github.com/debba/tabularis">
            <GitHubIcon size={16} />
            Star on GitHub
          </a>
          <a
            className="btn-cta discord"
            href="https://discord.gg/YrZPHAwMSG"
          >
            <DiscordIcon size={16} />
            Join Discord
          </a>
        </div>
      </section>

      <footer>
        <p>
          &copy; 2026 Tabularis Project &mdash;{" "}
          <Link href="/">tabularis.dev</Link> &middot;{" "}
          <a href="https://github.com/debba/tabularis">GitHub</a> &middot;{" "}
          <a href="https://discord.gg/YrZPHAwMSG">Discord</a>
        </p>
      </footer>
    </div>
  );
}
