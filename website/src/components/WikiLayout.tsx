"use client";

import { useState } from "react";
import { WikiSidebar } from "@/components/WikiSidebar";
import type { WikiCategory, WikiMeta } from "@/lib/wiki";

interface WikiLayoutProps {
  categories: Array<{ name: WikiCategory; pages: WikiMeta[] }>;
  children: React.ReactNode;
  rightSidebar?: React.ReactNode;
}

export function WikiLayout({ categories, children, rightSidebar }: WikiLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <button
        className="wiki-mobile-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle navigation"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M3 5h12M3 9h12M3 13h12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        Menu
      </button>

      {sidebarOpen && (
        <div
          className="wiki-mobile-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="wiki-layout">
        <aside className={`wiki-layout-left ${sidebarOpen ? "open" : ""}`}>
          <WikiSidebar categories={categories} />
        </aside>
        <main className="wiki-layout-main">{children}</main>
        {rightSidebar && (
          <aside className="wiki-layout-right">{rightSidebar}</aside>
        )}
      </div>
    </>
  );
}
