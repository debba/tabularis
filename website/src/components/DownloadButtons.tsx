import { APP_VERSION } from "@/lib/version";

export function DownloadButtons() {
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

      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.75rem" }}>
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
