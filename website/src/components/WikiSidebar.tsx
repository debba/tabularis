"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { WikiCategory, WikiMeta } from "@/lib/wiki";

interface WikiSidebarProps {
  categories: Array<{ name: WikiCategory; pages: WikiMeta[] }>;
}

export function WikiSidebar({ categories }: WikiSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (cat: string) =>
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));

  return (
    <nav className="wiki-sidebar" aria-label="Wiki navigation">
      {categories.map(({ name, pages }) => (
        <div key={name} className="wiki-sidebar-group">
          <button
            className="wiki-sidebar-category"
            onClick={() => toggle(name)}
            aria-expanded={!collapsed[name]}
          >
            <svg
              className={`wiki-sidebar-chevron ${collapsed[name] ? "collapsed" : ""}`}
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
            >
              <path
                d="M4 2l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {name}
          </button>
          {!collapsed[name] && (
            <ul className="wiki-sidebar-links">
              {pages.map((p) => {
                const href = `/wiki/${p.slug}`;
                const isActive = pathname === href;
                return (
                  <li key={p.slug}>
                    <Link
                      href={href}
                      className={`wiki-sidebar-link ${isActive ? "active" : ""}`}
                    >
                      {p.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </nav>
  );
}
