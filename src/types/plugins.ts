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
