import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

import type { PluginManifest } from "../types/plugins";
import { useSettings } from "./useSettings";

const FALLBACK_DRIVERS: PluginManifest[] = [
  {
    id: "postgres",
    name: "PostgreSQL",
    version: "1.0.0",
    description: "PostgreSQL databases",
    default_port: 5432,
    capabilities: {
      schemas: true,
      views: true,
      routines: true,
      file_based: false,
      folder_based: true,
      identifier_quote: '"',
      alter_primary_key: true,
      auto_increment_keyword: "",
      serial_type: "SERIAL",
      inline_pk: false,
      alter_column: true,
      create_foreign_keys: true,
    },
  },
  {
    id: "mysql",
    name: "MySQL",
    version: "1.0.0",
    description: "MySQL and MariaDB databases",
    default_port: 3306,
    capabilities: {
      schemas: false,
      views: true,
      routines: true,
      file_based: false,
      folder_based: true,
      identifier_quote: "`",
      alter_primary_key: true,
      auto_increment_keyword: "AUTO_INCREMENT",
      serial_type: "",
      inline_pk: false,
      alter_column: true,
      create_foreign_keys: true,
    },
  },
  {
    id: "sqlite",
    name: "SQLite",
    version: "1.0.0",
    description: "SQLite file-based databases",
    default_port: null,
    capabilities: {
      schemas: false,
      views: true,
      routines: false,
      file_based: true,
      folder_based: true,
      identifier_quote: '"',
      alter_primary_key: true,
      auto_increment_keyword: "AUTOINCREMENT",
      serial_type: "",
      inline_pk: true,
      alter_column: false,
      create_foreign_keys: false,
    },
  },
];

export function useDrivers(): {
  drivers: PluginManifest[];
  allDrivers: PluginManifest[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [allDrivers, setAllDrivers] =
    useState<PluginManifest[]>(FALLBACK_DRIVERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { settings } = useSettings();

  const load = useCallback(() => {
    invoke<PluginManifest[]>("get_registered_drivers")
      .then((result) => {
        setAllDrivers(result);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(String(err));
      })
      .finally(() => setLoading(false));
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  const builtin = ["mysql", "postgres", "sqlite"];
  const activeExt = settings.activeExternalDrivers || [];
  const active = allDrivers.filter(
    (d) => builtin.includes(d.id) || activeExt.includes(d.id),
  );

  return { drivers: active, allDrivers, loading, error, refresh };
}
