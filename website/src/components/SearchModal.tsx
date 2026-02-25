"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PostMeta } from "@/lib/posts";
import type { WikiMeta } from "@/lib/wiki";

interface SearchModalProps {
  posts: PostMeta[];
  wikiPages: WikiMeta[];
}

type SearchResult = 
  | { type: "post"; slug: string; title: string; excerpt: string; meta: string; badge?: string }
  | { type: "wiki"; slug: string; title: string; excerpt: string; meta: string };

export function SearchModal({ posts, wikiPages }: SearchModalProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    
    const postResults: SearchResult[] = posts
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.excerpt.toLowerCase().includes(q) ||
          p.release.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      )
      .map(p => ({
        type: "post",
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        meta: p.date,
        badge: p.release
      }));

    const wikiResults: SearchResult[] = wikiPages
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.excerpt.toLowerCase().includes(q)
      )
      .map(p => ({
        type: "wiki",
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        meta: "Wiki"
      }));

    return [...postResults, ...wikiResults];
  }, [query, posts, wikiPages]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setOpen(true);
        setQuery("");
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function handleOpen() {
      setOpen(true);
      setQuery("");
    }
    document.addEventListener("openSearch", handleOpen);
    return () => document.removeEventListener("openSearch", handleOpen);
  }, []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  function handleResultClick(result: SearchResult) {
    setOpen(false);
    const path = result.type === "post" ? `/blog/${result.slug}` : `/wiki/${result.slug}`;
    router.push(path);
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) {
      setOpen(false);
    }
  }

  return (
    <div
      className={`search-overlay${open ? " open" : ""}`}
      onClick={handleOverlayClick}
    >
      <div className="search-modal">
        <input
          ref={inputRef}
          className="search-input"
          type="text"
          placeholder="Search wiki or blog..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {results.length > 0 && (
          <ul className="search-results">
            {results.map((result) => (
              <li
                key={`${result.type}-${result.slug}`}
                className="search-result-item"
                onClick={() => handleResultClick(result)}
              >
                <div className="search-result-title">
                  {result.type === 'wiki' && <span style={{ color: 'var(--accent)', marginRight: '0.5rem' }}>[Wiki]</span>}
                  {result.title}
                </div>
                {result.excerpt && (
                  <div className="search-result-excerpt">{result.excerpt}</div>
                )}
                <div className="search-result-meta">
                  {result.meta && <span>{result.meta}</span>}
                  {result.type === 'post' && result.badge && (
                    <span className="search-result-release">{result.badge}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {query.trim() && results.length === 0 && (
          <div className="search-empty">
            No results for &ldquo;{query}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
}
