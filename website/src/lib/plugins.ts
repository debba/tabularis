import fs from "fs";
import path from "path";

export interface PluginRelease {
  version: string;
  assets: Record<string, string>;
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  author: string;
  homepage: string;
  latest_version: string;
  min_tabularis_version: string;
  releases: PluginRelease[];
}

export interface PluginRegistry {
  schema_version: number;
  plugins: Plugin[];
}

export function getPluginRegistry(): PluginRegistry {
  // In Next.js App Router, process.cwd() is the root of the project during build if started from there,
  // but we should be careful. Usually it's the 'website' directory.
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
