import Link from "next/link";
import { Footer } from "@/components/Footer";
import { DiscordIcon } from "@/components/Icons";
import { LightboxGallery } from "@/components/Lightbox";
import { getAllPosts } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";
import { APP_VERSION } from "@/lib/version";

const GALLERY_ITEMS = [
  {
    src: "/img/screenshot-1.png",
    alt: "Connection Manager",
    caption: "Connection Manager",
  },
  {
    src: "/img/screenshot-2.png",
    alt: "SQL Editor",
    caption: "Data Grid & Editor",
  },
  {
    src: "/img/screenshot-3.png",
    alt: "Table Wizard",
    caption: "Schema Creation Wizard",
  },
  {
    src: "/img/screenshot-4.png",
    alt: "New Connection",
    caption: "Connection Setup",
  },
  { src: "/img/screenshot-8.png", alt: "AI Settings", caption: "AI Settings" },
  {
    src: "/img/screenshot-6.png",
    alt: "ER Diagram",
    caption: "ER Diagram Viewer",
  },
  {
    src: "/img/screenshot-7.png",
    alt: "Theme System",
    caption: "Theme System & Settings",
  },
  {
    src: "/img/screenshot-5.png",
    alt: "Visual Query Builder",
    caption: "Visual Query Builder",
  },
  { src: "/img/screenshot-9.png", alt: "Plugins", caption: "Plugins" },
];

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

  return (
    <div className="container">
      {/* HERO */}
      <header className="hero">
        <div className="hero-badges">
          <span className="badge version">v{APP_VERSION}</span>
          <span className="badge">Open Source</span>
          <span className="badge">Apache 2.0</span>
          <span className="badge">🌍 EN | IT | ES</span>
          <a
            href="https://discord.gg/YrZPHAwMSG"
            className="badge"
            style={{
              textDecoration: "none",
              color: "#5865f2",
              borderColor: "rgba(88, 101, 242, 0.4)",
              background: "rgba(88, 101, 242, 0.1)",
            }}
          >
            <DiscordIcon size={14} />
            Discord
          </a>
        </div>

        <h1>
          <img src="/img/logo.png" alt="Logo" className="logo-img" />
          tabularis
        </h1>

        <p
          style={{
            fontSize: "1.2rem",
            color: "var(--text-muted)",
            marginTop: "1rem",
          }}
        >
          A lightweight, developer-focused database management tool.
          <br />
          Built with <strong>Tauri</strong> and <strong>React</strong> for
          speed, security, and aesthetics.
        </p>

        <div className="download-grid">
          <a
            href="https://github.com/debba/tabularis/releases/download/v0.8.0/tabularis_0.9.0_x64-setup.exe"
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
        <div style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
          Or view source on{" "}
          <a href="https://github.com/debba/tabularis">GitHub</a>
        </div>
      </header>

      {/* MAIN SCREENSHOT */}
      <div className="screenshot-container">
        <img
          src="/img/overview.png"
          alt="Tabularis Overview"
          className="screenshot-main"
        />
        <p
          style={{
            marginTop: "1rem",
            color: "var(--text-muted)",
            fontSize: "0.9rem",
          }}
        >
          Connection Manager &amp; SQL Editor
        </p>
      </div>

      {/* WHY TABULARIS */}
      <section className="section">
        <h2>_why_tabularis</h2>
        <p>
          This project was born from frustration with existing database tools.
          Most current solutions feel clunky, outdated, or bloated with poor
          user experience.
        </p>
        <p>
          <strong>Tabularis</strong> is the answer: a refreshing alternative
          built to prioritize UX without sacrificing power. It bridges the gap
          between native performance and web flexibility, using Tauri to keep
          the footprint tiny and startup instant.
        </p>
        <div className="tech-stack">
          <div className="tech-item">
            <span className="dot" style={{ background: "#dea584" }} />
            Rust
          </div>
          <div className="tech-item">
            <span className="dot" style={{ background: "#2b7489" }} />
            TypeScript
          </div>
          <div className="tech-item">
            <span className="dot" style={{ background: "#61dafb" }} />
            React
          </div>
          <div className="tech-item">
            <span className="dot" style={{ background: "#f1e05a" }} />
            SQLite/PG/MySQL
          </div>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="section">
        <h2>_capabilities</h2>
        <div className="features-grid">
          <article className="feature-card">
            <h3>🔌 Multi-Database</h3>
            <p>
              First-class support for <strong>PostgreSQL</strong> (with
              multi-schema support), <strong>MySQL/MariaDB</strong>, and{" "}
              <strong>SQLite</strong>. Manage multiple connection profiles with
              secure local persistence.
            </p>
          </article>
          <article className="feature-card">
            <h3>🤖 AI Assistance (Experimental)</h3>
            <p>
              Generate SQL from natural language (&quot;Show me active
              users&quot;) and get explanations for complex queries. Securely
              integrated with OpenAI, Anthropic, OpenRouter, and{" "}
              <strong>Ollama (Local LLM)</strong> for total privacy.
            </p>
          </article>
          <article className="feature-card">
            <h3>🔌 MCP Server</h3>
            <p>
              Built-in <strong>Model Context Protocol</strong> support. Expose
              your database schemas and run queries directly from Claude or
              other MCP-compatible AI agents.
            </p>
          </article>
          <article className="feature-card">
            <h3>🎨 Visual Query Builder</h3>
            <p>
              Construct complex queries visually. Drag tables, connect columns
              for JOINs, and let the tool write the SQL for you. Includes
              aggregate functions and advanced filtering.
            </p>
          </article>
          <article className="feature-card">
            <h3>🔒 SSH Tunneling &amp; Security</h3>
            <p>
              Connect to remote databases securely through SSH tunnels and
              manage SSH connections right from the connection manager.
              Passwords and API Keys are stored securely in your system&apos;s
              Keychain.
            </p>
          </article>
          <article className="feature-card">
            <h3>📝 Modern SQL Editor</h3>
            <p>
              Monaco-based editor with syntax highlighting, multiple tabs, and
              DataGrip-style execution (run selected, run all).
            </p>
          </article>
          <article className="feature-card">
            <h3>🪟 Split View</h3>
            <p>
              Work with <strong>multiple connections simultaneously</strong> in
              a resizable split-pane layout. Open any connection directly from
              the sidebar context menu and compare results across databases side
              by side.
            </p>
          </article>
          <article className="feature-card">
            <h3>🗄️ Schema Management</h3>
            <p>
              <strong>Inline editing</strong> of table and column properties
              directly from the sidebar. GUI wizards to Create Tables, Modify
              Columns, and Manage Indexes/Foreign Keys. Visualize your database
              structure with an interactive <strong>ER Diagram</strong> -
              auto-generated graphs showing all tables and foreign key
              relationships in a separate window with zoom, pan, and fullscreen
              mode.
            </p>
          </article>
          <article className="feature-card">
            <h3>📦 SQL Dump &amp; Import</h3>
            <p>
              Export full database dumps and re-import SQL with a guided flow,
              making migrations and backups fast and safe.
            </p>
          </article>
          <article className="feature-card">
            <h3>📊 Data Grid</h3>
            <p>
              Inline editing, row deletion, and easy data entry. Copy selected
              rows to the clipboard, or export results to JSON or CSV with a
              single click.
            </p>
          </article>
          <article className="feature-card">
            <h3>🔄 Seamless Updates</h3>
            <p>
              <strong>Automatic:</strong> Tabularis checks for updates on
              startup and notifies you when a new version is available. <br />
              <strong>Manual:</strong> You can always check for updates manually
              or download the latest release from GitHub.
            </p>
          </article>
        </div>
      </section>

      {/* PLUGINS */}
      <section className="section" id="plugins">
        <h2>_plugins</h2>
        <p>
          Tabularis supports extending its database support via an{" "}
          <strong>external plugin system</strong>. Plugins are standalone
          executables that communicate with the app through{" "}
          <strong>JSON-RPC 2.0 over stdin/stdout</strong>. They can be written
          in any programming language and distributed independently of the main
          app.
        </p>

        <div className="features-grid" style={{ margin: "2rem 0 3rem" }}>
          <article className="feature-card">
            <h3>🧩 Language-Agnostic</h3>
            <p>
              Write your driver in Rust, Go, Python, Node.js — anything that
              speaks JSON-RPC over stdin/stdout. No SDK required.
            </p>
          </article>
          <article className="feature-card">
            <h3>⚡ Hot Install</h3>
            <p>
              Install, update, and remove plugins from{" "}
              <strong>Settings → Plugins</strong> without restarting. New
              drivers appear instantly in the connection form.
            </p>
          </article>
          <article className="feature-card">
            <h3>🔒 Process Isolation</h3>
            <p>
              Each plugin runs as a separate process. A crashing plugin never
              takes down the app — only the affected connection fails.
            </p>
          </article>
        </div>

        <h3
          style={{
            color: "var(--text-main)",
            fontSize: "1rem",
            marginBottom: "1rem",
            fontWeight: 600,
          }}
        >
          Available Plugins
        </h3>

        <div className="plugin-list">
          <div className="plugin-entry">
            <div className="plugin-entry-info">
              <div className="plugin-entry-header">
                <a
                  href="https://github.com/debba/tabularis-duckdb-plugin"
                  className="plugin-name"
                >
                  DuckDB
                </a>
                <span className="plugin-badge">v0.1.0</span>
              </div>
              <p className="plugin-desc">
                Fast in-process OLAP SQL engine. File-based, no server required.
                Ideal for analytics on local datasets.
              </p>
              <div className="plugin-meta">
                by <a href="https://github.com/debba">debba</a> &middot;{" "}
                <span className="plugin-platforms">
                  Linux &middot; macOS &middot; Windows
                </span>
              </div>
            </div>
            <a
              href="https://github.com/debba/tabularis-duckdb-plugin"
              className="btn-plugin"
            >
              View &rarr;
            </a>
          </div>
        </div>

        <p style={{ fontSize: "0.9rem" }}>
          <a href="https://github.com/debba/tabularis/blob/main/plugins/README.md">
            Browse the plugin registry &rarr;
          </a>
        </p>

        <div className="plugin-cta">
          <h3>Build Your Own Plugin</h3>
          <p>
            Got a database you&apos;d like to support? The plugin guide covers
            the JSON-RPC protocol, manifest format, data types, and includes a
            full Rust skeleton to get you started in minutes.
          </p>
          <a
            href="https://github.com/debba/tabularis/blob/main/plugins/PLUGIN_GUIDE.md"
            className="btn-download"
            style={{ display: "inline-flex", width: "auto" }}
          >
            Read the Plugin Guide &rarr;
          </a>
        </div>
      </section>

      {/* THEMES */}
      <section className="section">
        <h2>_themes</h2>
        <p>
          Why stare at a dull interface? Tabularis brings a first-class theming
          experience. Switch instantly between <strong>10+ presets</strong>{" "}
          without restarting.
        </p>

        <div className="theme-grid">
          {THEMES.map((theme) => (
            <div key={theme.name} className="theme-preview">
              <div className="theme-name">{theme.name}</div>
              <div className="palette">
                {theme.colors.map((color, i) => (
                  <div
                    key={i}
                    className="color-dot"
                    style={{ background: color }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="features-grid">
          <article className="feature-card">
            <h3>⚡ Zero-Latency Switching</h3>
            <p>
              No restarts. No reloads. The entire application including the
              Monaco Editor repaints instantly when you switch themes.
            </p>
          </article>
          <article className="feature-card">
            <h3>🎨 Full Consistency</h3>
            <p>
              Syntax highlighting is automatically generated from the UI theme,
              ensuring perfect visual harmony between your chrome and your code.
            </p>
          </article>
          <article className="feature-card">
            <h3>🛠️ CSS Variable Engine</h3>
            <p>
              Built on a modern CSS variable system allowing for complete
              customization and easy creation of new custom themes.
            </p>
          </article>
          <article className="feature-card">
            <h3>🔠 Typography Control</h3>
            <p>
              Your code, your font. Choose from built-in favorites like{" "}
              <strong>JetBrains Mono</strong> and <strong>Fira Code</strong>, or
              use any font installed on your system. Adjust text size for
              perfect readability.
            </p>
          </article>
        </div>
      </section>

      {/* WIKI */}
      <section className="section" id="wiki">
        <h2>_wiki</h2>
        <p>
          Need a deeper dive? Explore our documentation to learn about all the
          powerful features Tabularis has to offer.
        </p>
        <p className="blog-all-link">
          <Link href="/wiki">Go to Wiki →</Link>
        </p>
      </section>

      {/* BLOG */}
      <section className="section" id="blog">
        <h2>_blog</h2>
        <div className="post-list">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
        <p className="blog-all-link">
          <Link href="/blog">View all posts →</Link>
        </p>
      </section>

      {/* GALLERY */}
      <section className="section">
        <h2>_gallery</h2>
        <LightboxGallery items={GALLERY_ITEMS} />
      </section>

      {/* COMMUNITY */}
      <section className="section">
        <h2>_community</h2>
        <p>
          Join our <strong>Discord server</strong> to chat with the maintainers,
          suggest new features, or get help from the community.
        </p>
        <div style={{ marginTop: "1.5rem" }}>
          <a
            href="https://discord.gg/YrZPHAwMSG"
            className="btn-download"
            style={{
              display: "inline-flex",
              width: "auto",
              borderColor: "#5865f2",
              background: "rgba(88, 101, 242, 0.1)",
            }}
          >
            <DiscordIcon size={20} className="discord-join-icon" />
            <span>Join Discord</span>
          </a>
        </div>
      </section>

      {/* INSTALLATION */}
      <section className="section">
        <h2>_installation</h2>

        <h3>Direct Download</h3>
        <div
          className="download-grid"
          style={{ marginTop: "1rem", marginBottom: "2rem" }}
        >
          <a
            href={`https://github.com/debba/tabularis/releases/download/v${APP_VERSION}/tabularis_${APP_VERSION}_x64-setup.exe`}
            className="btn-download"
          >
            <span>Windows (.exe)</span>
          </a>
          <a
            href={`https://github.com/debba/tabularis/releases/download/v${APP_VERSION}/tabularis_${APP_VERSION}_x64.dmg`}
            className="btn-download"
          >
            <span>macOS (.dmg)</span>
          </a>
          <a
            href={`https://github.com/debba/tabularis/releases/download/v${APP_VERSION}/tabularis_${APP_VERSION}_amd64.AppImage`}
            className="btn-download"
          >
            <span>Linux (.AppImage)</span>
          </a>
        </div>
        <p style={{ marginBottom: "2rem" }}>
          <a href="https://github.com/debba/tabularis/releases">
            View all releases on GitHub &rarr;
          </a>
        </p>

        <h3>Arch Linux (AUR)</h3>
        <p>Install via your favorite AUR helper:</p>
        <pre>
          <code>
            <span className="cmd">yay</span> <span className="flag">-S</span>{" "}
            tabularis-bin
          </code>
        </pre>

        <h3>Snap (Linux)</h3>
        <pre>
          <code>
            <span className="cmd">sudo</span> snap install tabularis
          </code>
        </pre>

        <h3>Build from Source</h3>
        <pre>
          <code>
            <span className="cmd">git</span> <span className="arg">clone</span>{" "}
            <span className="str">https://github.com/debba/tabularis.git</span>
            {"\n"}
            <span className="cmd">cd</span> tabularis{"\n"}
            <span className="cmd">npm</span>{" "}
            <span className="arg">install</span>
            {"\n"}
            <span className="cmd">npm</span> <span className="arg">run</span>{" "}
            tauri build
          </code>
        </pre>
      </section>

      <Footer />
    </div>
  );
}
