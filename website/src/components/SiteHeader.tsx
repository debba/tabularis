"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DiscordIcon, MenuIcon, XIcon, SearchIcon, GitHubIcon } from "@/components/Icons";
import { usePathname } from "next/navigation";

interface SiteHeaderProps {
  crumbs?: Array<{ label: string; href?: string }>;
}

export function SiteHeader({ crumbs = [] }: SiteHeaderProps) {
  const [isMac, setIsMac] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes("MAC"));
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  function openSearch() {
    document.dispatchEvent(new CustomEvent("openSearch"));
  }

  const navLinks = [
    { label: "Wiki", href: "/wiki" },
    { label: "Plugins", href: "/plugins" },
    { label: "Blog", href: "/blog" },
    { label: "Download", href: "/#download" },
  ];

  return (
    <header className={`site-header-unified ${isMobileMenuOpen ? "mobile-open" : ""}`}>
      <div className="header-container">
        <div className="header-main-row">
          <Link href="/" className="brand-link">
            <img src="/img/logo.png" alt="Tabularis" className="header-logo" />
            <span className="brand-name">tabularis</span>
          </Link>

          {/* DESKTOP NAV */}
          <nav className="desktop-nav">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link ${pathname.startsWith(link.href) ? "active" : ""}`}
              >
                {link.label}
              </Link>
            ))}
            <button className="search-trigger" onClick={openSearch} type="button">
              <SearchIcon size={14} />
              <span>Search</span>
              <kbd>{isMac ? "⌘K" : "Ctrl+K"}</kbd>
            </button>
            <a
              href="https://github.com/debba/tabularis"
              target="_blank"
              rel="noopener noreferrer"
              className="github-link"
              aria-label="GitHub"
            >
              <GitHubIcon size={20} />
            </a>
            <a
              href="https://discord.gg/YrZPHAwMSG"
              className="discord-btn"
              target="_blank"
              rel="noopener noreferrer"
            >
              <DiscordIcon size={14} />
              Join Discord
            </a>
          </nav>

          {/* MOBILE TOGGLE */}
          <button
            className="mobile-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle Menu"
          >
            {isMobileMenuOpen ? <XIcon /> : <MenuIcon />}
          </button>
        </div>

        {/* BREADCRUMBS (If provided) */}
        {crumbs.length > 0 && (
          <div className="header-crumbs">
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
      </div>

      {/* MOBILE MENU OVERLAY */}
      <div className={`mobile-menu ${isMobileMenuOpen ? "active" : ""}`}>
        <nav className="mobile-nav">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`mobile-nav-link ${pathname.startsWith(link.href) ? "active" : ""}`}
            >
              {link.label}
            </Link>
          ))}
          <button className="mobile-search-btn" onClick={openSearch} type="button">
            <SearchIcon size={18} />
            Search Documentation
          </button>
          <div className="mobile-social-links">
            <a
              href="https://github.com/debba/tabularis"
              target="_blank"
              rel="noopener noreferrer"
              className="mobile-social-link"
            >
              <GitHubIcon size={24} />
              GitHub
            </a>
            <a
              href="https://discord.gg/YrZPHAwMSG"
              target="_blank"
              rel="noopener noreferrer"
              className="mobile-social-link discord"
            >
              <DiscordIcon size={24} />
              Discord
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}
