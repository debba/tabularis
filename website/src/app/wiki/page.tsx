import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { getAllWikiPages } from "@/lib/wiki";

export const metadata: Metadata = {
  title: "Wiki | Tabularis",
  description: "Learn everything about Tabularis features and how to use them.",
};

export default function WikiPage() {
  const pages = getAllWikiPages();

  return (
    <div className="container">
      <SiteHeader crumbs={[{ label: "wiki" }]} />

      <section>
        <div className="blog-intro">
          <img
            src="/img/logo.png"
            alt="Tabularis Logo"
            className="blog-intro-logo"
          />
          <div className="blog-intro-body">
            <h3>Documentation & Guide</h3>
            <p>
              Welcome to the Tabularis Wiki. Here you will find detailed
              information about all the features of the application, from
              basic connection management to advanced AI integration and
              plugin development.
            </p>
          </div>
        </div>

        <div className="post-list">
          {pages.map((p) => (
            <div key={p.slug} className="post-card">
              <Link href={`/wiki/${p.slug}`} className="post-card-body">
                <div className="post-title">{p.title}</div>
                <div className="post-excerpt">{p.excerpt}</div>
              </Link>
            </div>
          ))}
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
