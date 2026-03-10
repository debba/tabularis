"use client";

import { useState } from "react";
import { DownloadModal } from "./DownloadModal";
import type { Platform } from "./DownloadModal";

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  window.history.pushState(null, "", `#${id}`);
}

export function DownloadButtons({ showInstallLink = false }: { showInstallLink?: boolean }) {
  const [platform, setPlatform] = useState<Platform | null>(null);

  return (
    <>
      <div className="download-grid">
        <button className="btn-download" onClick={() => setPlatform("windows")}>
          <span>
            Download for <strong>Windows</strong>
          </span>
        </button>
        <button className="btn-download" onClick={() => setPlatform("macos")}>
          <span>
            Download for <strong>macOS</strong>
          </span>
        </button>
        <button className="btn-download" onClick={() => setPlatform("linux")}>
          <span>
            Download for <strong>Linux</strong>
          </span>
        </button>
      </div>

      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.75rem", display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
        {showInstallLink && (
          <a
            href="#download"
            onClick={(e) => { e.preventDefault(); scrollTo("download"); }}
            style={{ color: "var(--text-muted)", textDecoration: "none" }}
          >
            Homebrew, Snap, AUR and more ↓
          </a>
        )}
        <a
          href="https://github.com/debba/tabularis/releases"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--accent)", textDecoration: "none" }}
        >
          View all releases on GitHub →
        </a>
      </p>

      <DownloadModal platform={platform} onClose={() => setPlatform(null)} />
    </>
  );
}
