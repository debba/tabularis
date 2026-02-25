"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DiscordIcon } from "@/components/Icons";

interface BlogHeaderProps {
  crumbs?: Array<{ label: string; href?: string }>;
}

export function BlogHeader({ crumbs = [] }: BlogHeaderProps) {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes("MAC"));
  }, []);

  function openSearch() {
    document.dispatchEvent(new CustomEvent("openSearch"));
  }

  return (
    <header className="site-header">
      <div className="site-header-row">
        <Link href="/" className="back-link">
          <img src="/img/logo.png" alt="Tabularis" className="header-logo" />
          tabularis
        </Link>
        <div className="header-links">
          <button className="search-btn" onClick={openSearch} type="button">
            Search <kbd>{isMac ? "⌘K" : "Ctrl+K"}</kbd>
          </button>
          <a
            href="https://discord.gg/YrZPHAwMSG"
            className="badge"
            style={{
              textDecoration: "none",
              background: "rgba(88, 101, 242, 0.1)",
              borderColor: "rgba(88, 101, 242, 0.4)",
              color: "#5865f2",
            }}
          >
            <DiscordIcon size={14} />
            Discord
          </a>
        </div>
      </div>
      {crumbs.length > 0 && (
        <div className="site-header-crumbs">
          {crumbs.map((crumb, i) => (
            <span key={i}>
              <span className="sep">/</span>{" "}
              {crumb.href ? (
                <Link href={crumb.href} className="crumb">
                  {crumb.label}
                </Link>
              ) : (
                <span className="crumb">{crumb.label}</span>
              )}
            </span>
          ))}
        </div>
      )}
    </header>
  );
}
