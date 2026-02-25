import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogHeader } from "@/components/BlogHeader";
import { GitHubIcon, DiscordIcon } from "@/components/Icons";
import { ShareButton } from "@/components/ShareButton";
import { getAllPosts, getPostBySlug, getAdjacentPosts, formatDate } from "@/lib/posts";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  const { meta } = post;
  return {
    title: `${meta.title} | Tabularis Blog`,
    description: meta.excerpt,
    openGraph: {
      type: "article",
      url: `https://tabularis.dev/blog/${slug}`,
      title: `${meta.title} | Tabularis Blog`,
      description: meta.excerpt,
      siteName: "Tabularis Blog",
    },
    twitter: {
      card: "summary_large_image",
      title: `${meta.title} | Tabularis Blog`,
      description: meta.excerpt,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const { meta, html } = post;
  const tags = meta.tags || [];

  // Inject meta bar after first h1 (same as original)
  const metaParts: string[] = [];
  if (meta.date) {
    metaParts.push(
      `<span>${formatDate(meta.date)}</span><span>&middot;</span><span>2 min read</span>`,
    );
  }
  if (meta.release) {
    metaParts.push(`<span class="post-release">${meta.release}</span>`);
  }
  tags.forEach((t) => {
    metaParts.push(`<span class="post-tag">${t}</span>`);
  });
  const metaBar = `<div class="post-meta" style="margin: 0.75rem 0 2.5rem">${metaParts.join("<span>&middot;</span>")}</div>`;
  const renderedHtml = html.replace(/<\/h1>/, `</h1>${metaBar}`);

  const { prev, next } = getAdjacentPosts(slug);

  const crumbTitle =
    meta.title.length > 40 ? meta.title.slice(0, 40) + "…" : meta.title;

  return (
    <div className="container">
      <BlogHeader
        crumbs={[{ label: "blog", href: "/blog" }, { label: crumbTitle }]}
      />

      <article
        className="post-content"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />

      <div className="post-footer-cta">
        <p>
          Enjoyed this post? Try Tabularis, star the repo, or join the
          community.
        </p>
        <div className="cta-links">
          <a className="btn-cta" href="https://github.com/debba/tabularis">
            <GitHubIcon size={15} />
            Star on GitHub
          </a>
          <a className="btn-cta discord" href="https://discord.gg/YrZPHAwMSG">
            <DiscordIcon size={15} />
            Join Discord
          </a>
          <ShareButton />
        </div>
      </div>

      <div className="post-author">
        <img
          src="https://github.com/debba.png"
          alt="Andrea Debernardi"
          className="post-author-avatar"
        />
        <div className="post-author-info">
          <span className="post-author-name">Andrea Debernardi</span>
          <span className="post-author-bio">
            Developer & creator of Tabularis. Building open-source tools for
            developers.{" "}
            <a
              href="https://github.com/debba"
              target="_blank"
              rel="noopener noreferrer"
            >
              @debba
            </a>
          </span>
        </div>
      </div>

      <nav className="post-nav">
        <div className="post-nav-item post-nav-prev">
          {prev ? (
            <Link href={`/blog/${prev.slug}`}>
              <span className="post-nav-label">← Newer</span>
              <span className="post-nav-title">{prev.title}</span>
            </Link>
          ) : (
            <span className="post-nav-empty" />
          )}
        </div>
        <div className="post-nav-item post-nav-next">
          {next ? (
            <Link href={`/blog/${next.slug}`}>
              <span className="post-nav-label">Older →</span>
              <span className="post-nav-title">{next.title}</span>
            </Link>
          ) : (
            <span className="post-nav-empty" />
          )}
        </div>
      </nav>

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
