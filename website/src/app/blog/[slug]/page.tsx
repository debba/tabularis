import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { GitHubIcon, DiscordIcon } from "@/components/Icons";
import { ShareButton } from "@/components/ShareButton";
import { getAllPosts, getPostBySlug, getAdjacentPosts } from "@/lib/posts";
import { PostMetaBar } from "@/components/PostMetaBar";

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

  const h1End = html.indexOf("</h1>");
  const htmlBefore = h1End >= 0 ? html.slice(0, h1End + 5) : html;
  const htmlAfter = h1End >= 0 ? html.slice(h1End + 5) : "";

  const { prev, next } = getAdjacentPosts(slug);

  const crumbTitle =
    meta.title.length > 40 ? meta.title.slice(0, 40) + "…" : meta.title;

  return (
    <div className="container">
      <SiteHeader
        crumbs={[{ label: "blog", href: "/blog" }, { label: crumbTitle }]}
      />

      <article className="post-content">
        {htmlBefore && <div dangerouslySetInnerHTML={{ __html: htmlBefore }} />}
        <PostMetaBar date={meta.date} release={meta.release} tags={meta.tags} />
        {htmlAfter && <div dangerouslySetInnerHTML={{ __html: htmlAfter }} />}
      </article>

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

      <Footer />
    </div>
  );
}
