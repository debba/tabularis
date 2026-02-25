import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { getAllPlugins } from "@/lib/plugins";

export const metadata: Metadata = {
  title: "Plugins | Tabularis",
  description: "Extend Tabularis with custom database drivers from the community.",
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
                  by {plugin.author.includes("<") ? (
                    <a href={plugin.author.match(/<(.*)>/)?.[1]} target="_blank" rel="noopener noreferrer">
                      {plugin.author.split("<")[0].trim()}
                    </a>
                  ) : plugin.author} &middot;{" "}
                  <span className="plugin-platforms">
                    Supports Tabularis v{plugin.min_tabularis_version}+
                  </span>
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
