"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { PostMeta } from "@/lib/posts";
import type { WikiMeta } from "@/lib/wiki";
import type { Plugin } from "@/lib/plugins";

interface SearchModalProps {
  posts: PostMeta[];
  wikiPages: WikiMeta[];
  plugins: Plugin[];
}

type SearchResult =
  | { type: "post"; slug: string; title: string; excerpt: string; meta: string; badge?: string }
  | { type: "wiki"; slug: string; title: string; excerpt: string; meta: string }
  | { type: "plugin"; slug: string; title: string; excerpt: string; meta: string; badge?: string; url: string };

const TYPE_CONFIG = {
  post: { label: "Blog", color: "var(--warning)", icon: "✦" },
  wiki: { label: "Wiki", color: "var(--accent)", icon: "◈" },
  plugin: { label: "Plugin", color: "var(--success)", icon: "⬡" },
} as const;

const SUGGESTIONS = [
  { label: "Installation guide", query: "install" },
  { label: "Plugin registry", query: "plugin" },
  { label: "Configuration", query: "config" },
  { label: "Getting started", query: "getting started" },
];

export function SearchModal({ posts, wikiPages, plugins }: SearchModalProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
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
      .map((p) => ({
        type: "post" as const,
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        meta: p.date,
        badge: p.release,
      }));

    const wikiResults: SearchResult[] = wikiPages
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.excerpt.toLowerCase().includes(q)
      )
      .map((p) => ({
        type: "wiki" as const,
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        meta: "Wiki",
      }));

    const pluginResults: SearchResult[] = plugins
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      )
      .map((p) => ({
        type: "plugin" as const,
        slug: p.id,
        title: p.name,
        excerpt: p.description,
        meta: "Plugin",
        badge: `v${p.latest_version}`,
        url: p.homepage,
      }));

    return [...postResults, ...wikiResults, ...pluginResults];
  }, [query, posts, wikiPages, plugins]);

  const closeModal = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const navigateResult = useCallback(
    (result: SearchResult) => {
      closeModal();
      if (result.type === "plugin") {
        window.open(result.url, "_blank");
        return;
      }
      const path = result.type === "post" ? `/blog/${result.slug}` : `/wiki/${result.slug}`;
      router.push(path);
    },
    [closeModal, router]
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setOpen(true);
        setQuery("");
        setActiveIndex(-1);
      }
      if (e.key === "Escape") closeModal();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeModal]);

  useEffect(() => {
    function handleOpen() {
      setOpen(true);
      setQuery("");
      setActiveIndex(-1);
    }
    document.addEventListener("openSearch", handleOpen);
    return () => document.removeEventListener("openSearch", handleOpen);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  function handleKeyboardNav(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      navigateResult(results[activeIndex]);
    }
  }

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) closeModal();
  }

  const isEmpty = query.trim() && results.length === 0;
  const showSuggestions = !query.trim();

  return (
    <div
      className={`search-overlay${open ? " open" : ""}`}
      onClick={handleOverlayClick}
    >
      <div className="search-modal">
        {/* Header */}
        <div className="search-header">
          <span className="search-icon-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </span>
          <input
            ref={inputRef}
            className="search-input"
            type="text"
            placeholder="Search wiki, blog, plugins..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyboardNav}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button className="search-clear-btn" onClick={() => setQuery("")} type="button" aria-label="Clear">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Suggestions (empty state) */}
        {showSuggestions && (
          <div className="search-suggestions">
            <p className="search-section-label">Quick searches</p>
            <div className="search-suggestion-chips">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.query}
                  className="search-chip"
                  onClick={() => setQuery(s.query)}
                  type="button"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <>
            <p className="search-section-label search-section-label--results">
              {results.length} result{results.length !== 1 ? "s" : ""}
            </p>
            <ul className="search-results" ref={listRef}>
              {results.map((result, i) => {
                const cfg = TYPE_CONFIG[result.type];
                return (
                  <li
                    key={`${result.type}-${result.slug}`}
                    className={`search-result-item${i === activeIndex ? " active" : ""}`}
                    onClick={() => navigateResult(result)}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    <span className="search-result-type-icon" style={{ color: cfg.color }}>
                      {cfg.icon}
                    </span>
                    <div className="search-result-body">
                      <div className="search-result-title">
                        {result.title}
                      </div>
                      {result.excerpt && (
                        <div className="search-result-excerpt">{result.excerpt}</div>
                      )}
                    </div>
                    <div className="search-result-aside">
                      <span className="search-result-type-badge" style={{ color: cfg.color, borderColor: cfg.color }}>
                        {cfg.label}
                      </span>
                      {(result.type === "post" || result.type === "plugin") && result.badge && (
                        <span className="search-result-release">{result.badge}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {/* No results */}
        {isEmpty && (
          <div className="search-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, margin: "0 auto 0.75rem", display: "block" }}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <span>No results for <strong>&ldquo;{query}&rdquo;</strong></span>
          </div>
        )}

        {/* Footer */}
        <div className="search-footer">
          <span className="search-hint"><kbd>↑↓</kbd> navigate</span>
          <span className="search-hint"><kbd>↵</kbd> open</span>
          <span className="search-hint"><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
