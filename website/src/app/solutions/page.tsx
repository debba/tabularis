import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { getSeoPagesBySection, getSeoPagePath } from "@/lib/seoPages";
import { buildBreadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Solutions | Tabularis",
  description:
    "Explore high-intent Tabularis pages for PostgreSQL, SQL notebooks, MCP workflows, and other database use cases.",
  alternates: { canonical: "/solutions" },
};

export default function SolutionsPage() {
  const pages = getSeoPagesBySection("solutions");

  return (
    <div className="container">
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Solutions", path: "/solutions" },
        ])}
      />
      <SiteHeader crumbs={[{ label: "solutions" }]} />

      <section>
        <div className="blog-intro">
          <img
            src="/img/logo.png"
            alt="Tabularis Logo"
            className="blog-intro-logo"
          />
          <div className="blog-intro-body">
            <h3>Solutions</h3>
            <p>
            Explore Tabularis by workflow and use case, from PostgreSQL, MySQL,
            and SQLite work to SQL notebooks, secure access, plugin-based
            extensibility, and AI agent database flows.
            </p>
          </div>
        </div>

        <div className="plugin-list">
          {pages.map((page) => (
            <div key={page.slug} className="plugin-entry seo-entry">
              <img
                src={page.image || "/img/logo.png"}
                alt={page.title}
                className="seo-entry-thumb"
              />
              <div className="plugin-entry-info">
                <div className="plugin-entry-header">
                  <Link
                    href={getSeoPagePath("solutions", page.slug)}
                    className="plugin-name"
                  >
                    {page.title}
                  </Link>
                  <span className="plugin-badge">{page.format || "Guide"}</span>
                </div>
                <p className="plugin-desc">{page.excerpt}</p>
                <div className="plugin-meta">
                  {page.audience && <span>{page.audience}</span>}
                  {page.audience && page.useCase && <span>&nbsp;&middot;&nbsp;</span>}
                  {page.useCase && <span>{page.useCase}</span>}
                </div>
              </div>
              <Link
                href={getSeoPagePath("solutions", page.slug)}
                className="btn-plugin"
              >
                Open &rarr;
              </Link>
            </div>
          ))}
        </div>

        <div className="plugin-cta">
          <h3>Need a different workflow?</h3>
          <p>
            These pages are organized by real use case. If you are evaluating
            tools instead of workflows, go to the comparison pages next.
          </p>
          <Link
            href="/compare"
            className="btn-download"
            style={{ display: "inline-flex", width: "auto" }}
          >
            Browse comparisons &rarr;
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
