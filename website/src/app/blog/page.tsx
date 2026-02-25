import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { GitHubIcon, DiscordIcon } from "@/components/Icons";
import { PostCard } from "@/components/PostCard";
import { Pagination } from "@/components/Pagination";
import { getPaginatedPosts, getAllTags } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Blog | Tabularis",
  description:
    "Release notes and updates from the Tabularis project — one post per release.",
  openGraph: {
    type: "website",
    url: "https://tabularis.dev/blog/",
    title: "Blog | Tabularis",
    description:
      "Release notes and updates from the Tabularis project — one post per release.",
    images: [
      "https://raw.githubusercontent.com/debba/tabularis/main/website/img/og.png",
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog | Tabularis",
    description:
      "Release notes and updates from the Tabularis project — one post per release.",
    images: [
      "https://raw.githubusercontent.com/debba/tabularis/main/website/img/og.png",
    ],
  },
};

export default function BlogPage() {
  const { posts, totalPages, currentPage } = getPaginatedPosts(1);
  const tags = getAllTags();

  return (
    <div className="container">
      <SiteHeader crumbs={[{ label: "blog" }]} />

      <section>
        <div className="blog-intro">
          <img
            src="/img/logo.png"
            alt="Tabularis Logo"
            className="blog-intro-logo"
          />
          <div className="blog-intro-body">
            <h3>What is Tabularis?</h3>
            <p>
              Tabularis is a lightweight, developer-focused database management
              tool built with <strong>Tauri</strong> and <strong>React</strong>.
              It supports PostgreSQL, MySQL, SQLite, and more via a plugin system
              — with a Monaco SQL editor, AI assistance, visual query builder,
              and a clean dark UI. Open source, Apache 2.0.{" "}
              <Link href="/">Learn more →</Link>
            </p>
          </div>
        </div>

        <div className="tag-cloud">
          {tags.map((t) => (
            <Link key={t} href={`/blog/tag/${t}`} className="post-tag">
              {t}
            </Link>
          ))}
        </div>

        <div className="post-list">
          {posts.map((p) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </div>

        <Pagination currentPage={currentPage} totalPages={totalPages} />

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

      <Footer />
    </div>
  );
}
