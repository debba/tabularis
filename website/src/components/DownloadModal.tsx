"use client";

import { useEffect } from "react";
import { APP_VERSION } from "@/lib/version";

export type Platform = "windows" | "macos" | "linux";

const BASE = `https://github.com/debba/tabularis/releases/download/v${APP_VERSION}`;

type FileOption = { kind: "file"; label: string; desc: string; ext: string; url: string };
type CommandOption = { kind: "command"; label: string; desc: string; command: string };
type Option = FileOption | CommandOption;
type Note = { text: string; command?: string };

const PLATFORM_CONFIG: Record<
  Platform,
  {
    label: string;
    options: Option[];
    note?: Note;
  }
> = {
  windows: {
    label: "Windows",
    options: [
      {
        kind: "command",
        label: "WinGet",
        desc: "Recommended — installs and auto-updates",
        command: "winget install Debba.Tabularis",
      },
      {
        kind: "file",
        label: "Installer",
        desc: "Direct download",
        ext: ".exe",
        url: `${BASE}/tabularis_${APP_VERSION}_x64-setup.exe`,
      },
      {
        kind: "file",
        label: "MSI Package",
        desc: "Enterprise / group policy deployment",
        ext: ".msi",
        url: `${BASE}/tabularis_${APP_VERSION}_x64_en-US.msi`,
      },
    ],
  },
  macos: {
    label: "macOS",
    options: [
      {
        kind: "command",
        label: "Homebrew",
        desc: "Recommended — installs and auto-updates",
        command: "brew install --cask tabularis",
      },
      {
        kind: "file",
        label: "Apple Silicon",
        desc: "M1 / M2 / M3 / M4 (aarch64)",
        ext: ".dmg",
        url: `${BASE}/tabularis_${APP_VERSION}_aarch64.dmg`,
      },
      {
        kind: "file",
        label: "Intel",
        desc: "x86_64",
        ext: ".dmg",
        url: `${BASE}/tabularis_${APP_VERSION}_x64.dmg`,
      },
    ],
    note: {
      text: "If macOS blocks the app after a direct download, run:",
      command: "xattr -c /Applications/tabularis.app",
    },
  },
  linux: {
    label: "Linux",
    options: [
      {
        kind: "command",
        label: "Snap",
        desc: "Ubuntu, Debian and Snap-enabled distros",
        command: "snap install tabularis",
      },
      {
        kind: "command",
        label: "AUR",
        desc: "Arch Linux / Manjaro",
        command: "yay -S tabularis-bin",
      },
      {
        kind: "file",
        label: "AppImage",
        desc: "Universal — no installation needed",
        ext: ".AppImage",
        url: `${BASE}/tabularis_${APP_VERSION}_amd64.AppImage`,
      },
      {
        kind: "file",
        label: "Debian / Ubuntu",
        desc: "apt-based distros",
        ext: ".deb",
        url: `${BASE}/tabularis_${APP_VERSION}_amd64.deb`,
      },
      {
        kind: "file",
        label: "Fedora / RHEL",
        desc: "rpm-based distros",
        ext: ".rpm",
        url: `${BASE}/tabularis-${APP_VERSION}-1.x86_64.rpm`,
      },
    ],
  },
};

interface DownloadModalProps {
  platform: Platform | null;
  onClose: () => void;
}

export function DownloadModal({ platform, onClose }: DownloadModalProps) {
  const open = platform !== null;
  const config = platform ? PLATFORM_CONFIG[platform] : null;

  useEffect(() => {
    if (!open || !platform) return;
    const _paq: unknown[][] | undefined = (window as unknown as { _paq?: unknown[][] })._paq;
    if (_paq) {
      _paq.push(["trackEvent", "Download", "Lead", platform]);
    }
  }, [open, platform]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className={`dl-overlay${open ? " open" : ""}`}
      onClick={handleOverlayClick}
      aria-hidden={!open}
    >
      {config && (
        <div
          className="dl-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Download for ${config.label}`}
        >
          <div className="dl-modal-header">
            <span className="dl-modal-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download for <strong>{config.label}</strong>
            </span>
            <button className="dl-modal-close" onClick={onClose} aria-label="Close">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="dl-modal-body">
            {config.options.map((opt) =>
              opt.kind === "command" ? (
                <div key={opt.command} className="dl-option dl-option--command">
                  <div className="dl-option-info">
                    <span className="dl-option-label">{opt.label}</span>
                    <span className="dl-option-desc">{opt.desc}</span>
                  </div>
                  <code className="dl-option-cmd">{opt.command}</code>
                </div>
              ) : (
                <a key={opt.url} href={opt.url} className="dl-option" download>
                  <div className="dl-option-info">
                    <span className="dl-option-label">{opt.label}</span>
                    <span className="dl-option-desc">{opt.desc}</span>
                  </div>
                  <span className="dl-option-ext">{opt.ext}</span>
                </a>
              )
            )}

            {config.note && (
              <div className="dl-modal-note">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: "1px" }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>
                  {config.note.text}
                  {config.note.command && <> <code>{config.note.command}</code></>}
                </span>
              </div>
            )}
          </div>

          <div className="dl-modal-footer">
            <a
              href="https://github.com/debba/tabularis/releases"
              target="_blank"
              rel="noopener noreferrer"
            >
              View all releases on GitHub →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
