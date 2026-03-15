"use client";

import { useEffect, useState } from "react";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function WikiTableOfContents() {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const article = document.querySelector(".post-content");
    if (!article) return;

    const headings = article.querySelectorAll<HTMLElement>("h2, h3");
    const tocItems: TocItem[] = Array.from(headings)
      .filter((h) => h.id)
      .map((h) => ({
        id: h.id,
        text: h.textContent ?? "",
        level: parseInt(h.tagName[1], 10),
      }));
    setItems(tocItems);
  }, []);

  useEffect(() => {
    if (items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav className="wiki-toc" aria-label="On this page">
      <div className="wiki-toc-title">On This Page</div>
      <ul className="wiki-toc-list">
        {items.map((item) => (
          <li
            key={item.id}
            className={`wiki-toc-item ${item.level === 3 ? "wiki-toc-sub" : ""}`}
          >
            <a
              href={`#${item.id}`}
              className={`wiki-toc-link ${activeId === item.id ? "active" : ""}`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
