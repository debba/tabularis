import type { Metadata } from "next";
import Link from "next/link";
import { BlogHeader } from "@/components/BlogHeader";
import { GitHubIcon, DiscordIcon } from "@/components/Icons";
import { getAllPosts, formatDate } from "@/lib/posts";

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
  const posts = getAllPosts();

  return (
    <div className="container">
      <BlogHeader crumbs={[{ label: "blog" }]} />

      <section>
        <h2>_blog</h2>

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

        <div className="post-list">
          {posts.map((p) => {
            const tags = p.tags || [];
            return (
              <Link
                key={p.slug}
                className="post-card"
                href={`/blog/${p.slug}`}
              >
                <div className="post-meta">
                  <span>{formatDate(p.date)}</span>
                  <span>&middot;</span>
                  <span>2 min read</span>
                  {p.release && (
                    <>
                      <span>&middot;</span>
                      <span className="post-release">{p.release}</span>
                    </>
                  )}
                  {tags.length > 0 && (
                    <>
                      <span>&middot;</span>
                      {tags.map((t) => (
                        <span key={t} className="post-tag">
                          {t}
                        </span>
                      ))}
                    </>
                  )}
                </div>
                <div className="post-title">{p.title}</div>
                <div className="post-excerpt">{p.excerpt}</div>
              </Link>
            );
          })}
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
