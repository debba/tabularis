import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogHeader } from "@/components/BlogHeader";
import { GitHubIcon, DiscordIcon } from "@/components/Icons";
import { ShareButton } from "@/components/ShareButton";
import { getAllWikiPages, getWikiPageBySlug, getAdjacentWikiPages } from "@/lib/wiki";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllWikiPages().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getWikiPageBySlug(slug);
  if (!page) return {};

  const { meta } = page;
  return {
    title: `${meta.title} | Tabularis Wiki`,
    description: meta.excerpt,
  };
}

export default async function WikiPageDetail({ params }: PageProps) {
  const { slug } = await params;
  const page = getWikiPageBySlug(slug);
  if (!page) notFound();

  const { meta, html } = page;
  const { prev, next } = getAdjacentWikiPages(slug);

  const crumbTitle =
    meta.title.length > 40 ? meta.title.slice(0, 40) + "…" : meta.title;

  return (
    <div className="container">
      <BlogHeader
        crumbs={[{ label: "wiki", href: "/wiki" }, { label: crumbTitle }]}
      />

      <article
        className="post-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <div className="wiki-edit-link-container">
        <a 
          href={`https://github.com/debba/tabularis/edit/main/website/content/wiki/${slug}.md`}
          target="_blank"
          rel="noopener noreferrer"
          className="wiki-edit-link"
        >
          <GitHubIcon size={14} />
          Edit this page on GitHub
        </a>
      </div>

      <div className="post-footer-cta">
        <p>
          Need more help? Join our community or check the source code.
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

      <nav className="post-nav">
        <div className="post-nav-item post-nav-prev">
          {prev ? (
            <Link href={`/wiki/${prev.slug}`}>
              <span className="post-nav-label">← Previous</span>
              <span className="post-nav-title">{prev.title}</span>
            </Link>
          ) : (
            <span className="post-nav-empty" />
          )}
        </div>
        <div className="post-nav-item post-nav-next">
          {next ? (
            <Link href={`/wiki/${next.slug}`}>
              <span className="post-nav-label">Next →</span>
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
