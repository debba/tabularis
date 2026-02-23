export interface DriverCapabilities {
  schemas: boolean;
  views: boolean;
  routines: boolean;
  file_based: boolean;
  identifier_quote: string;
  alter_primary_key: boolean;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  default_port: number | null;
  capabilities: DriverCapabilities;
}

export interface RegistryPluginWithStatus {
  id: string;
  name: string;
  description: string;
  author: string;
  homepage: string;
  latest_version: string;
  min_tabularis_version: string;
  installed_version: string | null;
  update_available: boolean;
  platform_supported: boolean;
}

export interface InstalledPluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
}
