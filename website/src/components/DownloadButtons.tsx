"use client";

import { APP_VERSION } from "@/lib/version";

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  window.history.pushState(null, "", `#${id}`);
}

export function DownloadButtons({ showInstallLink = false }: { showInstallLink?: boolean }) {
  return (
    <>
      <div className="download-grid">
        <a
          href={`https://github.com/debba/tabularis/releases/download/v${APP_VERSION}/tabularis_${APP_VERSION}_x64-setup.exe`}
          className="btn-download"
        >
          <span>
            Download for <strong>Windows</strong> (.exe)
          </span>
        </a>
        <a
          href={`https://github.com/debba/tabularis/releases/download/v${APP_VERSION}/tabularis_${APP_VERSION}_x64.dmg`}
          className="btn-download"
        >
          <span>
            Download for <strong>macOS</strong> (.dmg)
          </span>
        </a>
        <a
          href={`https://github.com/debba/tabularis/releases/download/v${APP_VERSION}/tabularis_${APP_VERSION}_amd64.AppImage`}
          className="btn-download"
        >
          <span>
            Download for <strong>Linux</strong> (.AppImage)
          </span>
        </a>
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
    </>
  );
}
