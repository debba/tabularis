"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { SearchIcon, GitHubIcon, DiscordIcon } from "@/components/Icons";

interface WikiHeaderProps {
  crumbs?: Array<{ label: string; href?: string }>;
}

export function WikiHeader({ crumbs = [] }: WikiHeaderProps) {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes("MAC"));
  }, []);

  function openSearch() {
    document.dispatchEvent(new CustomEvent("openSearch", { detail: { wikiOnly: true } }));
  }

  return (
    <header className="wiki-header">
      <div className="wiki-header-container">
        <Link href="/" className="brand-link">
          <img src="/img/logo.png" alt="Tabularis" className="header-logo" />
        </Link>

        {crumbs.length > 0 && (
          <div className="wiki-header-crumbs">
            {crumbs.map((crumb, i) => (
              <span key={i} className="crumb-item">
                <span className="crumb-sep">/</span>
                {crumb.href ? (
                  <Link href={crumb.href} className="crumb-link">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="crumb-text">{crumb.label}</span>
                )}
              </span>
            ))}
          </div>
        )}

        <button
          className="wiki-header-search"
          onClick={openSearch}
          type="button"
        >
          <SearchIcon size={14} />
          <span>Search docs...</span>
          <kbd>{isMac ? "\u2318K" : "Ctrl+K"}</kbd>
        </button>

        <div className="wiki-header-actions">
          <a
            href="https://github.com/debba/tabularis"
            target="_blank"
            rel="noopener noreferrer"
            className="wiki-header-icon"
            aria-label="GitHub"
          >
            <GitHubIcon size={18} />
          </a>
          <a
            href="https://discord.gg/YrZPHAwMSG"
            target="_blank"
            rel="noopener noreferrer"
            className="wiki-header-icon"
            aria-label="Discord"
          >
            <DiscordIcon size={18} />
          </a>
          <Link href="/download" className="wiki-header-download">
            Download
          </Link>
        </div>
      </div>
    </header>
  );
}
