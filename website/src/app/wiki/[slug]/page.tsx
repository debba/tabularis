import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WikiHeader } from "@/components/WikiHeader";
import { GitHubIcon, DiscordIcon } from "@/components/Icons";
import { ShareButton } from "@/components/ShareButton";
import { WikiLayout } from "@/components/WikiLayout";
import { WikiTableOfContents } from "@/components/WikiTableOfContents";
import { WikiContent } from "@/components/WikiContent";
import { Footer } from "@/components/Footer";
import {
  getAllWikiPages,
  getWikiPageBySlug,
  getAdjacentWikiPages,
  getWikiPagesByCategory,
  WIKI_CATEGORIES,
} from "@/lib/wiki";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllWikiPages().map((p) => ({ slug: p.slug }));
}

const OG_IMAGE =
  "https://raw.githubusercontent.com/debba/tabularis/main/website/img/og.png";

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getWikiPageBySlug(slug);
  if (!page) return {};

  const { meta } = page;
  const title = `${meta.title} | Tabularis Wiki`;
  const description = meta.excerpt;

  return {
    title,
    description,
    alternates: {
      canonical: `/wiki/${slug}`,
    },
    openGraph: {
      type: "article",
      url: `/wiki/${slug}`,
      title,
      description,
      siteName: "Tabularis",
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Tabularis" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE],
    },
  };
}

function buildCategories() {
  const map = getWikiPagesByCategory();
  return WIKI_CATEGORIES.filter((c) => map.has(c)).map((c) => ({
    name: c,
    pages: map.get(c)!,
  }));
}

export default async function WikiPageDetail({ params }: PageProps) {
  const { slug } = await params;
  const page = getWikiPageBySlug(slug);
  if (!page) notFound();

  const { meta, html } = page;
  const { prev, next } = getAdjacentWikiPages(slug);
  const categories = buildCategories();

  const crumbTitle =
    meta.title.length > 40 ? meta.title.slice(0, 40) + "\u2026" : meta.title;

  return (
    <div className="container wiki-container">
      <WikiHeader
        crumbs={[{ label: "wiki", href: "/wiki" }, { label: crumbTitle }]}
      />

      <WikiLayout
        categories={categories}
        rightSidebar={<WikiTableOfContents />}
      >
        <WikiContent html={html} />

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
          <p>Need more help? Join our community or check the source code.</p>
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

        <nav className="post-nav">
          <div className="post-nav-item post-nav-prev">
            {prev ? (
              <Link href={`/wiki/${prev.slug}`}>
                <span className="post-nav-label">&larr; Previous</span>
                <span className="post-nav-title">{prev.title}</span>
              </Link>
            ) : (
              <span className="post-nav-empty" />
            )}
          </div>
          <div className="post-nav-item post-nav-next">
            {next ? (
              <Link href={`/wiki/${next.slug}`}>
                <span className="post-nav-label">Next &rarr;</span>
                <span className="post-nav-title">{next.title}</span>
              </Link>
            ) : (
              <span className="post-nav-empty" />
            )}
          </div>
        </nav>

        <Footer />
      </WikiLayout>
    </div>
  );
}
