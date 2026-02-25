import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogHeader } from "@/components/BlogHeader";
import { GitHubIcon, DiscordIcon } from "@/components/Icons";
import { ShareButton } from "@/components/ShareButton";
import { getAllPosts, getPostBySlug, formatDate } from "@/lib/posts";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  const { meta } = post;
  const ogImage = `https://tabularis.dev/blog/img/og-${slug}.png`;

  return {
    title: `${meta.title} | Tabularis Blog`,
    description: meta.excerpt,
    openGraph: {
      type: "article",
      url: `https://tabularis.dev/blog/${slug}`,
      title: `${meta.title} | Tabularis Blog`,
      description: meta.excerpt,
      siteName: "Tabularis Blog",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: `${meta.title} | Tabularis Blog`,
      description: meta.excerpt,
      images: [ogImage],
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
      `<span>${formatDate(meta.date)}</span><span>&middot;</span><span>2 min read</span>`
    );
  }
  if (meta.release) {
    metaParts.push(`<span class="post-release">${meta.release}</span>`);
  }
  tags.forEach((t) => {
    metaParts.push(`<span class="post-tag">${t}</span>`);
  });
  const metaBar = `<div class="post-meta" style="margin: 0.75rem 0 2.5rem">${metaParts.join('<span>&middot;</span>')}</div>`;
  const renderedHtml = html.replace(/<\/h1>/, `</h1>${metaBar}`);

  const crumbTitle =
    meta.title.length > 40 ? meta.title.slice(0, 40) + "…" : meta.title;

  return (
    <div className="container" style={{ maxWidth: "720px" }}>
      <BlogHeader
        crumbs={[
          { label: "blog", href: "/blog" },
          { label: crumbTitle },
        ]}
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
          <a
            className="btn-cta discord"
            href="https://discord.gg/YrZPHAwMSG"
          >
            <DiscordIcon size={15} />
            Join Discord
          </a>
          <ShareButton />
        </div>
      </div>

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
