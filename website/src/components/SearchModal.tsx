"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PostMeta } from "@/lib/posts";

interface SearchModalProps {
  posts: PostMeta[];
}

export function SearchModal({ posts }: SearchModalProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.release.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [query, posts]);

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

  function handleResultClick(slug: string) {
    setOpen(false);
    router.push(`/blog/${slug}`);
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
          placeholder="Search posts..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {results.length > 0 && (
          <ul className="search-results">
            {results.map((post) => (
              <li
                key={post.slug}
                className="search-result-item"
                onClick={() => handleResultClick(post.slug)}
              >
                <div className="search-result-title">{post.title}</div>
                {post.excerpt && (
                  <div className="search-result-excerpt">{post.excerpt}</div>
                )}
                <div className="search-result-meta">
                  {post.date && <span>{post.date}</span>}
                  {post.release && (
                    <span className="search-result-release">{post.release}</span>
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
