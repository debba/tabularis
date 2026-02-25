import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <div className="container">
      <SiteHeader />

      <div className="not-found-page">
        <div className="not-found-code">
          <span className="not-found-prompt">~</span>
          <span className="not-found-number">404</span>
        </div>

        <h1 className="not-found-title">Page not found</h1>

        <p className="not-found-description">
          The page you are looking for does not exist or has been moved.
        </p>

        <nav className="not-found-nav">
          <Link href="/" className="not-found-link not-found-link--primary">
            ← Go home
          </Link>
          <Link href="/wiki" className="not-found-link">
            Wiki
          </Link>
          <Link href="/blog" className="not-found-link">
            Blog
          </Link>
          <Link href="/plugins" className="not-found-link">
            Plugins
          </Link>
        </nav>
      </div>

      <footer>
        <p>
          &copy; 2026 Tabularis Project &mdash;{" "}
          <Link href="/">tabularis.dev</Link> &middot;{" "}
          <a href="https://github.com/debba/tabularis">GitHub</a> &middot;{" "}
          <a href="https://discord.gg/YrZPHAwMSG">Discord</a>
        </p>
      </footer>
    </div>
  );
}
