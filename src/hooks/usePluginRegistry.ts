import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

import type { RegistryPluginWithStatus } from "../types/plugins";

export function usePluginRegistry(): {
  plugins: RegistryPluginWithStatus[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [plugins, setPlugins] = useState<RegistryPluginWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    invoke<RegistryPluginWithStatus[]>("fetch_plugin_registry")
      .then((result) => {
        setPlugins(result);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(String(err));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { plugins, loading, error, refresh };
}
