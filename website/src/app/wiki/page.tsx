import type { Metadata } from "next";
import Link from "next/link";
import { WikiHeader } from "@/components/WikiHeader";
import { WikiLayout } from "@/components/WikiLayout";
import { Footer } from "@/components/Footer";
import { getAllWikiPages, getWikiPagesByCategory, WIKI_CATEGORIES } from "@/lib/wiki";
import type { WikiCategory } from "@/lib/wiki";

export const metadata: Metadata = {
  title: "Wiki | Tabularis",
  description: "Learn everything about Tabularis features and how to use them.",
};

function buildCategories() {
  const map = getWikiPagesByCategory();
  return WIKI_CATEGORIES.filter((c) => map.has(c)).map((c) => ({
    name: c,
    pages: map.get(c)!,
  }));
}

const CATEGORY_ICONS: Record<WikiCategory, string> = {
  "Getting Started": "M13 2L3 14h7l-1 8 10-12h-7l1-8z",
  "Core Features": "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  "Database Objects": "M4 7v10c0 2 3.6 3 8 3s8-1 8-3V7M4 7c0 2 3.6 3 8 3s8-1 8-3M4 7c0-2 3.6-3 8-3s8 1 8 3M4 12c0 2 3.6 3 8 3s8-1 8-3",
  "Security & Networking": "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  "AI & Integration": "M12 2a7 7 0 017 7c0 2.4-1.2 4.5-3 5.7V17H8v-2.3A7 7 0 0112 2zM9 21h6M10 17v4M14 17v4",
  "Customization": "M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z",
  Reference: "M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z",
};

export default function WikiPage() {
  const categories = buildCategories();

  return (
    <div className="container wiki-container">
      <WikiHeader crumbs={[{ label: "wiki" }]} />

      <WikiLayout categories={categories}>
        <div className="wiki-index">
          <div className="wiki-index-hero">
            <h1>Documentation</h1>
            <p>
              Everything you need to know about Tabularis — from your first
              connection to advanced plugin development.
            </p>
          </div>

          {categories.map(({ name, pages }) => (
            <section key={name} className="wiki-index-section">
              <h2 className="wiki-index-section-title">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={CATEGORY_ICONS[name]} />
                </svg>
                {name}
              </h2>
              <div className="wiki-index-grid">
                {pages.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/wiki/${p.slug}`}
                    className="wiki-index-card"
                  >
                    <span className="wiki-index-card-title">{p.title}</span>
                    <span className="wiki-index-card-excerpt">{p.excerpt}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        <Footer />
      </WikiLayout>
    </div>
  );
}
