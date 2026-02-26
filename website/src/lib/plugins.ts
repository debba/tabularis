import fs from "fs";
import path from "path";

export interface PluginRelease {
  version: string;
  min_tabularis_version: string | null;
  assets: Record<string, string>;
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  author: string;
  homepage: string;
  latest_version: string;
  releases: PluginRelease[];
}

export interface PluginRegistry {
  schema_version: number;
  plugins: Plugin[];
}

export function getPluginRegistry(): PluginRegistry {
  const registryPath = path.join(process.cwd(), "..", "plugins", "registry.json");

  if (!fs.existsSync(registryPath)) {
    console.warn(`Plugin registry not found at ${registryPath}`);
    return { schema_version: 1, plugins: [] };
  }

  try {
    const raw = fs.readFileSync(registryPath, "utf-8");
    return JSON.parse(raw) as PluginRegistry;
  } catch (error) {
    console.error("Error reading plugin registry:", error);
    return { schema_version: 1, plugins: [] };
  }
}

export function getAllPlugins(): Plugin[] {
  return getPluginRegistry().plugins;
}

export function getLatestRelease(plugin: Plugin): PluginRelease | undefined {
  return plugin.releases.find((r) => r.version === plugin.latest_version);
}
