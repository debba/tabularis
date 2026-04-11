import Link from "next/link";
import fs from "fs";
import path from "path";
import { JsonLd } from "@/components/JsonLd";
import { marked } from "@/lib/markdown";
import { Footer } from "@/components/Footer";
import { DiscordIcon } from "@/components/Icons";
import { getAllPosts } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";
import { APP_VERSION } from "@/lib/version";
import { getAllPlugins } from "@/lib/plugins";

import { SiteHeader } from "@/components/SiteHeader";
import { DownloadButtons } from "@/components/DownloadButtons";
import { SponsorsSection, IconExternalLink, IconArrow } from "@/components/SponsorsSection";
import { ExpandableText } from "@/components/ExpandableText";
import { CarouselGrid } from "@/components/CarouselGrid";
import {
  buildBreadcrumbJsonLd,
  buildSoftwareApplicationJsonLd,
} from "@/lib/seo";

const GITHUB_EDIT_HOME_URL =
  "https://github.com/debba/tabularis/edit/main/website/content/home.md";

const SEO_ENTRY_POINTS = [
  {
    href: "/solutions/postgresql-client",
    title: "PostgreSQL Client",
    excerpt:
      "A developer-focused PostgreSQL workflow with SQL editing, schema tools, SSH, and notebooks.",
  },
  {
    href: "/solutions/sql-notebooks",
    title: "SQL Notebooks",
    excerpt:
      "Reusable SQL analysis with cells, markdown, inline charts, and parameters.",
  },
  {
    href: "/solutions/mcp-database-client",
    title: "MCP Database Client",
    excerpt:
      "A local database workflow for Claude, Cursor, and other MCP-compatible AI tools.",
  },
  {
    href: "/compare/dbeaver-alternative",
    title: "DBeaver Alternative",
    excerpt:
      "A focused comparison for developers evaluating a more modern open-source SQL workflow.",
  },
  {
    href: "/solutions/open-source-database-client-linux",
    title: "Database Client for Linux",
    excerpt:
      "An open-source desktop workflow for Linux users who want SQL editing, SSH, and cross-platform parity.",
  },
  {
    href: "/solutions/sqlite-client-for-developers",
    title: "SQLite Client",
    excerpt:
      "A stronger desktop workflow for SQLite-based apps, prototypes, migrations, and local debugging.",
  },
  {
    href: "/solutions/mysql-client-for-developers",
    title: "MySQL Client",
    excerpt:
      "A developer-focused MySQL and MariaDB workflow with SQL editing, SSH, and reusable notebook analysis.",
  },
  {
    href: "/solutions/secure-database-client",
    title: "Secure Database Client",
    excerpt:
      "A local-first database workflow with SSH tunneling, system keychain storage, and controlled desktop access.",
  },
  {
    href: "/solutions/plugin-based-database-client",
    title: "Plugin-Based Database Client",
    excerpt:
      "An extensible database client with a plugin system for custom engines and broader database workflows.",
  },
  {
    href: "/solutions/duckdb-redis-database-workflows",
    title: "DuckDB and Redis Workflows",
    excerpt:
      "Extend beyond built-in engines with plugin-driven workflows for analytical and mixed-stack database use cases.",
  },
];

// Helper to parse home.md into sections
function getHomeContent() {
  const filePath = path.join(process.cwd(), "content", "home.md");
  if (!fs.existsSync(filePath)) return {};

  const content = fs.readFileSync(filePath, "utf-8");
  const sections: Record<string, string> = {};

  // Split by # Header
  const parts = content.split(/^# /m);
  parts.forEach((part) => {
    if (!part.trim()) return;
    const lines = part.split("\n");
    const title = lines[0].trim().toLowerCase().replace(/[^\w]/g, "_");
    const body = lines.slice(1).join("\n").trim();
    sections[title] = marked.parse(body) as string;
  });

  return sections;
}

const THEMES = [
  {
    name: "Tabularis Dark",
    colors: ["#020617", "#1e293b", "#3b82f6", "#f87171"],
  },
  {
    name: "Tabularis Light",
    colors: ["#ffffff", "#f1f5f9", "#3b82f6", "#dc2626"],
  },
  { name: "Dracula", colors: ["#282a36", "#44475a", "#bd93f9", "#ff79c6"] },
  { name: "Nord", colors: ["#2e3440", "#3b4252", "#88c0d0", "#bf616a"] },
  { name: "Monokai", colors: ["#272822", "#3e3d32", "#a6e22e", "#f92672"] },
  { name: "GitHub Dark", colors: ["#24292e", "#1f2428", "#0366d6", "#ea4a5a"] },
  {
    name: "One Dark Pro",
    colors: ["#282c34", "#21252b", "#61afef", "#e06c75"],
  },
  {
    name: "Solarized Dark",
    colors: ["#002b36", "#073642", "#268bd2", "#b58900"],
  },
  {
    name: "Solarized Light",
    colors: ["#fdf6e3", "#eee8d5", "#268bd2", "#b58900"],
  },
  {
    name: "High Contrast",
    colors: ["#000000", "#1a1a1a", "#ffffff", "#ffff00"],
  },
];

export default function HomePage() {
  const posts = getAllPosts();
  const plugins = getAllPlugins()
    .slice(0, 3)
    .map((plugin) => ({
      ...plugin,
      min_tabularis_version: plugin.releases.find(
        (release) => release.version === plugin.latest_version,
      )?.min_tabularis_version,
    }));
  const home = getHomeContent();

  return (
    <div className="container">
      <JsonLd
        data={[
          buildBreadcrumbJsonLd([{ name: "Home", path: "/" }]),
          buildSoftwareApplicationJsonLd(),
        ]}
      />
      <SiteHeader />
      {/* HERO */}
      <header className="hero">
        <div className="hero-badges">
          <span className="badge version">v{APP_VERSION}</span>
          <span className="badge">Open Source</span>
          <span className="badge">Apache 2.0</span>
          <span className="badge">🌍 EN | IT | ES | ZH</span>
        </div>

        <p
          style={{
            fontSize: "1.2rem",
            color: "var(--text-muted)",
            marginTop: "1rem",
          }}
        >
          An open-source desktop client for modern databases.
          <br />
          Supports <strong>PostgreSQL</strong>, <strong>MySQL/MariaDB</strong>,
          and <strong>SQLite</strong>. Hackable with plugins.
          <br />
          Notebooks, AI, and MCP included for real daily work.
        </p>

        <DownloadButtons showInstallLink />

      </header>

      {/* MAIN SCREENSHOT */}
      <div className="screenshot-container">
        <img
          src="/img/overview.png"
          alt="Tabularis Overview"
          className="screenshot-main"
        />
      </div>

      {/* SPONSORS */}
      <SponsorsSection />

      {/* WHY TABULARIS */}
      <section className="section">
        <h2>_why_tabularis</h2>
        <div
          className="post-content"
          dangerouslySetInnerHTML={{ __html: home.why_tabularis || "" }}
        />
        <a
          href={GITHUB_EDIT_HOME_URL}
          className="edit-on-github-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit on GitHub
        </a>
        <div
          className="tech-stack"
          style={{
            marginTop: "2rem",
            display: "flex",
            gap: "2rem",
            flexWrap: "wrap",
            color: "var(--text-muted)",
          }}
        >
          <div
            className="tech-item"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <span
              className="dot"
              style={{
                background: "#dea584",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
              }}
            />
            Rust
          </div>
          <div
            className="tech-item"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <span
              className="dot"
              style={{
                background: "#2b7489",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
              }}
            />
            TypeScript
          </div>
          <div
            className="tech-item"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <span
              className="dot"
              style={{
                background: "#61dafb",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
              }}
            />
            React
          </div>
          <div
            className="tech-item"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <span
              className="dot"
              style={{
                background: "#f1e05a",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
              }}
            />
            SQLite/PG/MySQL
          </div>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="section">
        <h2>_capabilities</h2>
        <CarouselGrid className="features-grid">
          <article className="feature-card has-screenshot">
            <Link href="/wiki/connections" className="feature-card-screenshot">
              <img src="/img/tabularis-connection-manager.png" alt="Connection Manager" />
            </Link>
            <div className="feature-card-body">
              <div className="feature-card-header">
                <h3>🔌 Multi-Database</h3>
                <Link href="/wiki/connections" className="sponsor-external-link" aria-label="Learn more about Multi-Database">
                  <IconExternalLink size={13} />
                </Link>
              </div>
              <ExpandableText>
                Work across <strong>PostgreSQL</strong>,{" "}
                <strong>MySQL/MariaDB</strong>, and <strong>SQLite</strong> from
                one consistent interface. Save multiple connection profiles
                locally and switch between them without friction.
              </ExpandableText>
              <div className="sponsor-card-footer">
                <Link href="/wiki/connections" className="sponsor-learn-btn">
                  Learn more <IconArrow size={12} />
                </Link>
              </div>
            </div>
          </article>
          <article className="feature-card has-screenshot">
            <Link href="/wiki/ai-assistant" className="feature-card-screenshot">
              <img src="/img/tabularis-ai-assistant.png" alt="AI Assistant" />
            </Link>
            <div className="feature-card-body">
              <div className="feature-card-header">
                <h3>🤖 AI Assistance (Experimental)</h3>
                <Link href="/wiki/ai-assistant" className="sponsor-external-link" aria-label="Learn more about AI Assistance">
                  <IconExternalLink size={13} />
                </Link>
              </div>
              <ExpandableText>
                Draft SQL from plain English, explain unfamiliar queries, and
                iterate faster while staying in control of your provider. Works
                with OpenAI, Anthropic, OpenRouter, and{" "}
                <strong>Ollama (local models)</strong>.
              </ExpandableText>
              <div className="sponsor-card-footer">
                <Link href="/wiki/ai-assistant" className="sponsor-learn-btn">
                  Learn more <IconArrow size={12} />
                </Link>
              </div>
            </div>
          </article>
          <article className="feature-card has-screenshot">
            <Link href="/wiki/mcp-server" className="feature-card-screenshot">
              <img src="/img/tabularis-mcp-server.png" alt="MCP Server Integration" />
            </Link>
            <div className="feature-card-body">
              <div className="feature-card-header">
                <h3>🔌 MCP Server</h3>
                <Link href="/wiki/mcp-server" className="sponsor-external-link" aria-label="Learn more about MCP Server">
                  <IconExternalLink size={13} />
                </Link>
              </div>
              <ExpandableText>
                Built-in <strong>Model Context Protocol</strong> support lets AI
                agents inspect your schemas and run database actions through
                Tabularis instead of ad-hoc scripts.
              </ExpandableText>
              <div className="sponsor-card-footer">
                <Link href="/wiki/mcp-server" className="sponsor-learn-btn">
                  Learn more <IconArrow size={12} />
                </Link>
              </div>
            </div>
          </article>
          <article className="feature-card has-screenshot">
            <Link href="/wiki/visual-query-builder" className="feature-card-screenshot">
              <img src="/img/tabularis-visual-query-builder.png" alt="Visual Query Builder" />
            </Link>
            <div className="feature-card-body">
              <div className="feature-card-header">
                <h3>🎨 Visual Query Builder</h3>
                <Link href="/wiki/visual-query-builder" className="sponsor-external-link" aria-label="Learn more about Visual Query Builder">
                  <IconExternalLink size={13} />
                </Link>
              </div>
              <ExpandableText>
                Build joins, filters, and aggregations visually, then inspect the
                generated SQL. Useful when exploring a schema or assembling a
                query before dropping down to raw SQL.
              </ExpandableText>
              <div className="sponsor-card-footer">
                <Link href="/wiki/visual-query-builder" className="sponsor-learn-btn">
                  Learn more <IconArrow size={12} />
                </Link>
              </div>
            </div>
          </article>
          <article className="feature-card has-screenshot">
            <Link href="/wiki/editor" className="feature-card-screenshot">
              <img src="/img/tabularis-sql-editor-data-grid.png" alt="SQL Editor" />
            </Link>
            <div className="feature-card-body">
              <div className="feature-card-header">
                <h3>📝 Modern SQL Editor</h3>
                <Link href="/wiki/editor" className="sponsor-external-link" aria-label="Learn more about SQL Editor">
                  <IconExternalLink size={13} />
                </Link>
              </div>
              <ExpandableText>
                Monaco-powered editing with multiple tabs, syntax highlighting,
                and precise execution controls. Run the current selection or the
                whole script without leaving the keyboard.
              </ExpandableText>
              <div className="sponsor-card-footer">
                <Link href="/wiki/editor" className="sponsor-learn-btn">
                  Learn more <IconArrow size={12} />
                </Link>
              </div>
            </div>
          </article>
          <article className="feature-card has-screenshot">
            <Link href="/wiki/notebooks" className="feature-card-screenshot">
              <img src="/img/posts/tabularis-notebook-sql-cell-pie-chart-data-grid.png" alt="SQL Notebooks" />
            </Link>
            <div className="feature-card-body">
              <div className="feature-card-header">
                <h3>📓 SQL Notebooks</h3>
                <Link href="/wiki/notebooks" className="sponsor-external-link" aria-label="Learn more about SQL Notebooks">
                  <IconExternalLink size={13} />
                </Link>
              </div>
              <ExpandableText>
                Combine <strong>SQL</strong> and <strong>Markdown</strong> in
                reusable, multi-cell workflows. Keep inline results, lightweight
                charts, shared variables, parameters, and repeatable analysis in
                one place.
              </ExpandableText>
              <div className="sponsor-card-footer">
                <Link href="/wiki/notebooks" className="sponsor-learn-btn">
                  Learn more <IconArrow size={12} />
                </Link>
              </div>
            </div>
          </article>
          <article className="feature-card has-screenshot">
            <Link href="/wiki/schema-management" className="feature-card-screenshot">
              <img src="/img/tabularis-schema-management-er-diagram.png" alt="ER Diagram" />
            </Link>
            <div className="feature-card-body">
              <div className="feature-card-header">
                <h3>🗄️ Schema Management</h3>
                <Link href="/wiki/schema-management" className="sponsor-external-link" aria-label="Learn more about Schema Management">
                  <IconExternalLink size={13} />
                </Link>
              </div>
              <ExpandableText>
                Edit tables and columns inline, use guided schema dialogs for
                structural changes, and inspect relationships with an interactive{" "}
                <strong>ER diagram</strong>.
              </ExpandableText>
              <div className="sponsor-card-footer">
                <Link href="/wiki/schema-management" className="sponsor-learn-btn">
                  Learn more <IconArrow size={12} />
                </Link>
              </div>
            </div>
          </article>
          <article className="feature-card has-screenshot">
            <Link href="/wiki/task-manager" className="feature-card-screenshot">
              <img src="/img/tabularis-task-manager.png" alt="Task Manager" />
            </Link>
            <div className="feature-card-body">
              <div className="feature-card-header">
                <h3>📈 Task Manager</h3>
                <Link href="/wiki/task-manager" className="sponsor-external-link" aria-label="Learn more about Task Manager">
                  <IconExternalLink size={13} />
                </Link>
              </div>
              <ExpandableText>
                Monitor <strong>plugin processes</strong> in real time. Track CPU,
                RAM and disk usage for each plugin, inspect child processes, and
                force-kill or restart any plugin directly from the built-in Task
                Manager window.
              </ExpandableText>
              <div className="sponsor-card-footer">
                <Link href="/wiki/task-manager" className="sponsor-learn-btn">
                  Learn more <IconArrow size={12} />
                </Link>
              </div>
            </div>
          </article>
          <article className="feature-card has-screenshot">
            <Link href="/wiki/data-grid" className="feature-card-screenshot">
              <img src="/img/tabularis-sql-editor-data-grid.png" alt="Data Grid" />
            </Link>
            <div className="feature-card-body">
              <div className="feature-card-header">
                <h3>📊 Data Grid</h3>
                <Link href="/wiki/data-grid" className="sponsor-external-link" aria-label="Learn more about Data Grid">
                  <IconExternalLink size={13} />
                </Link>
              </div>
              <ExpandableText>
                Browse and edit result sets without leaving the query workflow.
                Update rows inline, remove records, copy selections, or export
                results to JSON and CSV in one step.
              </ExpandableText>
              <div className="sponsor-card-footer">
                <Link href="/wiki/data-grid" className="sponsor-learn-btn">
                  Learn more <IconArrow size={12} />
                </Link>
              </div>
            </div>
          </article>
          <article className="feature-card has-screenshot">
            <Link href="/wiki/connections" className="feature-card-screenshot">
              <img src="/img/tabularis-ssh-tunneling.png" alt="SSH Tunneling & Security" />
            </Link>
            <div className="feature-card-body">
              <div className="feature-card-header">
                <h3>🔒 SSH Tunneling &amp; Security</h3>
                <Link href="/wiki/connections" className="sponsor-external-link" aria-label="Learn more about SSH Tunneling">
                  <IconExternalLink size={13} />
                </Link>
              </div>
              <ExpandableText>
                Reach remote databases through SSH tunnels and keep secrets out
                of plain text. Passwords and API keys are stored in your
                system&apos;s keychain.
              </ExpandableText>
              <div className="sponsor-card-footer">
                <Link href="/wiki/connections" className="sponsor-learn-btn">
                  Learn more <IconArrow size={12} />
                </Link>
              </div>
            </div>
          </article>
          <article className="feature-card has-screenshot">
            <Link href="/wiki/split-view" className="feature-card-screenshot">
              <img src="/img/tabularis-split-view.png" alt="Split View" />
            </Link>
            <div className="feature-card-body">
              <div className="feature-card-header">
                <h3>🪟 Split View</h3>
                <Link href="/wiki/split-view" className="sponsor-external-link" aria-label="Learn more about Split View">
                  <IconExternalLink size={13} />
                </Link>
              </div>
              <ExpandableText>
                Open <strong>multiple connections at once</strong> in a
                resizable split layout and compare datasets side by side without
                jumping between windows.
              </ExpandableText>
              <div className="sponsor-card-footer">
                <Link href="/wiki/split-view" className="sponsor-learn-btn">
                  Learn more <IconArrow size={12} />
                </Link>
              </div>
            </div>
          </article>
          <article className="feature-card has-screenshot">
            <Link href="/wiki/dump-import" className="feature-card-screenshot">
              <img src="/img/tabularis-sql-dump-import.png" alt="SQL Dump & Import" />
            </Link>
            <div className="feature-card-body">
              <div className="feature-card-header">
                <h3>📦 SQL Dump &amp; Import</h3>
                <Link href="/wiki/dump-import" className="sponsor-external-link" aria-label="Learn more about SQL Dump & Import">
                  <IconExternalLink size={13} />
                </Link>
              </div>
              <ExpandableText>
                Export full SQL dumps and bring them back with a guided import
                flow. Useful for backups, local restores, and quick migration
                loops.
              </ExpandableText>
              <div className="sponsor-card-footer">
                <Link href="/wiki/dump-import" className="sponsor-learn-btn">
                  Learn more <IconArrow size={12} />
                </Link>
              </div>
            </div>
          </article>
          <article className="feature-card has-screenshot">
            <Link href="/wiki/updates" className="feature-card-screenshot">
              <img src="/img/tabularis-automatic-updates.png" alt="Seamless Updates" />
            </Link>
            <div className="feature-card-body">
              <div className="feature-card-header">
                <h3>🔄 Seamless Updates</h3>
                <Link href="/wiki/updates" className="sponsor-external-link" aria-label="Learn more about Updates">
                  <IconExternalLink size={13} />
                </Link>
              </div>
              <ExpandableText>
                <strong>Automatic:</strong> Tabularis checks for updates on
                startup and notifies you when a new version is available.{" "}
                <strong>Manual:</strong> You can always check for updates manually
                or download the latest release from GitHub.
              </ExpandableText>
              <div className="sponsor-card-footer">
                <Link href="/wiki/updates" className="sponsor-learn-btn">
                  Learn more <IconArrow size={12} />
                </Link>
              </div>
            </div>
          </article>
        </CarouselGrid>
      </section>

      <section className="section">
        <h2>_explore_by_intent</h2>
        <p>
          Start from the workflow you actually care about: PostgreSQL work,
          MySQL and SQLite work, reusable SQL analysis, secure access,
          extensibility, AI-native database tooling, or tool comparisons.
        </p>
        <div className="wiki-index-grid" style={{ marginTop: "1.5rem" }}>
          {SEO_ENTRY_POINTS.map((entry) => (
            <Link key={entry.href} href={entry.href} className="wiki-index-card">
              <span className="wiki-index-card-title">{entry.title}</span>
              <span className="wiki-index-card-excerpt">{entry.excerpt}</span>
            </Link>
          ))}
        </div>
        <p className="blog-all-link" style={{ marginTop: "1.25rem" }}>
          <Link href="/solutions" style={{ fontWeight: 600 }}>
            Browse all solutions →
          </Link>
        </p>
      </section>

      {/* PLUGINS */}
      <section className="section" id="plugins">
        <h2>_plugins</h2>
        <div
          className="post-content"
          dangerouslySetInnerHTML={{ __html: home.plugins || "" }}
        />
        <a
          href={GITHUB_EDIT_HOME_URL}
          className="edit-on-github-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit on GitHub
        </a>

        <h3
          style={{
            color: "var(--text-bright)",
            fontSize: "1rem",
            margin: "2.5rem 0 1.25rem",
            fontWeight: 600,
          }}
        >
          Available Plugins
        </h3>

        <div className="plugin-list">
          {plugins.length === 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              No plugins found in registry.
            </p>
          )}
          {plugins.map((plugin) => (
            <div key={plugin.id} className="plugin-entry">
              <div className="plugin-entry-info">
                <div className="plugin-entry-header">
                  <a
                    href={plugin.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="plugin-name"
                  >
                    {plugin.name}
                  </a>
                  <span className="plugin-badge">v{plugin.latest_version}</span>
                </div>
                <p className="plugin-desc">{plugin.description}</p>
                <div className="plugin-meta">
                  by{" "}
                  {plugin.author.includes("<") ? (
                    <a
                      href={plugin.author.match(/<(.*)>/)?.[1]}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {plugin.author.split("<")[0].trim()}
                    </a>
                  ) : (
                    plugin.author
                  )}{" "}
                  &middot;{" "}
                  {plugin?.min_tabularis_version && (
                    <span className="plugin-platforms">
                      Supports Tabularis v{plugin.min_tabularis_version}
                    </span>
                  )}
                </div>
              </div>
              <a
                href={plugin.homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-plugin"
              >
                Repo &rarr;
              </a>
            </div>
          ))}
        </div>

        <p style={{ fontSize: "0.9rem", marginTop: "1.5rem" }}>
          <Link href="/plugins">Browse the full plugin registry &rarr;</Link>
        </p>
      </section>

      {/* THEMES */}
      <section className="section">
        <h2>_themes</h2>
        <p>
          Tabularis treats themes as part of the workflow, not a cosmetic extra.
          Switch between <strong>10+ presets</strong> instantly, with editor
          syntax colors generated to stay coherent with the active UI theme.
        </p>

        <div className="theme-grid">
          {THEMES.map((theme) => (
            <div key={theme.name} className="theme-card">
              <div
                className="theme-card-preview"
                style={{ background: theme.colors[0] }}
              >
                <div
                  className="theme-card-sidebar"
                  style={{ background: theme.colors[1] }}
                >
                  <div
                    className="theme-card-dot"
                    style={{ background: theme.colors[2] }}
                  />
                  <div
                    className="theme-card-dot"
                    style={{ background: theme.colors[3] }}
                  />
                  <div
                    className="theme-card-dot"
                    style={{ background: theme.colors[2], opacity: 0.5 }}
                  />
                </div>
                <div className="theme-card-content">
                  <div
                    className="theme-card-line"
                    style={{ background: theme.colors[2], width: "60%" }}
                  />
                  <div
                    className="theme-card-line"
                    style={{ background: theme.colors[3], width: "40%" }}
                  />
                  <div
                    className="theme-card-line"
                    style={{
                      background: theme.colors[1],
                      width: "75%",
                      opacity: 0.6,
                    }}
                  />
                </div>
              </div>
              <div className="theme-card-label">{theme.name}</div>
            </div>
          ))}
        </div>
      </section>

      {/* WIKI */}
      <section className="section" id="wiki">
        <h2>_wiki</h2>
        <p>
          Need implementation details, setup steps, or feature walkthroughs? The
          wiki covers the workflows behind the UI.
        </p>
        <p className="blog-all-link" style={{ marginTop: "1rem" }}>
          <Link href="/wiki" style={{ fontWeight: 600 }}>
            Go to Wiki →
          </Link>
        </p>
      </section>

      {/* BLOG */}
      <section className="section" id="blog">
        <h2>_blog</h2>
        <div className="post-list">
          {posts.slice(0, 3).map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
        <p className="blog-all-link" style={{ marginTop: "2rem" }}>
          <Link href="/blog" style={{ fontWeight: 600 }}>
            View all posts →
          </Link>
        </p>
        <p className="blog-all-link" style={{ marginTop: "0.75rem" }}>
          <Link href="/compare/datagrip-alternative" style={{ fontWeight: 600 }}>
            Compare Tabularis with DataGrip →
          </Link>
        </p>
      </section>

      {/* COMMUNITY */}
      <section className="section">
        <h2>_community</h2>
        <p>
          Join the <strong>Discord server</strong> to talk with maintainers,
          share feedback, report friction, and help shape the roadmap.
        </p>
        <div style={{ marginTop: "2rem" }}>
          <a
            href="https://discord.gg/YrZPHAwMSG"
            className="discord-btn"
            style={{
              padding: "0.75rem 1.5rem",
              fontSize: "1rem",
            }}
          >
            <DiscordIcon size={20} />
            <span>Join Discord</span>
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
