import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { getAllPlugins, getLatestRelease } from "@/lib/plugins";

export const metadata: Metadata = {
  title: "Plugins | Tabularis",
  description: "Extend Tabularis with custom database drivers from the community.",
};

const PLATFORM_LABELS: Record<string, string> = {
  "linux-x64": "Linux x64",
  "linux-arm64": "Linux ARM64",
  "darwin-x64": "macOS x64",
  "darwin-arm64": "macOS ARM64",
  "win-x64": "Windows x64",
  "universal": "Universal",
};

export default function PluginsPage() {
  const plugins = getAllPlugins();

  return (
    <div className="container">
      <SiteHeader crumbs={[{ label: "plugins" }]} />

      <section>
        <div className="blog-intro">
          <img
            src="/img/logo.png"
            alt="Tabularis Logo"
            className="blog-intro-logo"
          />
          <div className="blog-intro-body">
            <h3>Community Drivers</h3>
            <p>
              Tabularis supports extending its database engine support via a
              language-agnostic plugin system. Browse the registry below to
              find drivers for your favorite databases.
            </p>
          </div>
        </div>

        <div className="plugin-list">
          {plugins.length === 0 && (
            <p className="search-empty">No plugins found in the registry.</p>
          )}
          {plugins.map((plugin) => {
            const latestRelease = getLatestRelease(plugin);
            const authorName = plugin.author.includes("<")
              ? plugin.author.split("<")[0].trim()
              : plugin.author;
            const authorUrl = plugin.author.match(/<(.*)>/)?.[1];

            return (
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
                    {authorUrl ? (
                      <a href={authorUrl} target="_blank" rel="noopener noreferrer">
                        {authorName}
                      </a>
                    ) : (
                      authorName
                    )}
                    {latestRelease?.min_tabularis_version && (
                      <>&nbsp;&middot; Requires Tabularis v{latestRelease.min_tabularis_version}+</>
                    )}
                  </div>

                  {/* Release history */}
                  {plugin.releases.length > 0 && (
                    <details className="plugin-releases">
                      <summary className="plugin-releases-toggle">
                        {plugin.releases.length} release{plugin.releases.length !== 1 ? "s" : ""}
                      </summary>
                      <table className="plugin-releases-table">
                        <thead>
                          <tr>
                            <th>Version</th>
                            <th>Requires Tabularis</th>
                            <th>Platforms</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...plugin.releases].reverse().map((release) => (
                            <tr key={release.version}>
                              <td>
                                <span className={release.version === plugin.latest_version ? "plugin-badge" : "plugin-badge plugin-badge-old"}>
                                  v{release.version}
                                </span>
                              </td>
                              <td>
                                {release.min_tabularis_version
                                  ? `≥ ${release.min_tabularis_version}`
                                  : "—"}
                              </td>
                              <td className="plugin-platforms">
                                {Object.keys(release.assets).map((key) => (
                                  <span key={key} className="plugin-platform-tag">
                                    {PLATFORM_LABELS[key] ?? key}
                                  </span>
                                ))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  )}
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
            );
          })}
        </div>

        <div className="plugin-cta">
          <h3>Build Your Own Plugin</h3>
          <p>
            Got a database you&apos;d like to support? The plugin guide covers
            the JSON-RPC protocol, manifest format, and includes a full Rust
            skeleton to get you started in minutes.
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

      <Footer />
    </div>
  );
}
