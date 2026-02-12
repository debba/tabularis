import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DatabaseContext, type TableInfo, type ViewInfo, type RoutineInfo, type SavedConnection, type SchemaData } from './DatabaseContext';
import type { ReactNode } from 'react';
import { clearAutocompleteCache } from '../utils/autocomplete';

export const DatabaseProvider = ({ children }: { children: ReactNode }) => {
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [activeDriver, setActiveDriver] = useState<string | null>(null);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [activeConnectionName, setActiveConnectionName] = useState<string | null>(null);
  const [activeDatabaseName, setActiveDatabaseName] = useState<string | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [views, setViews] = useState<ViewInfo[]>([]);
  const [routines, setRoutines] = useState<RoutineInfo[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [isLoadingViews, setIsLoadingViews] = useState(false);
  const [isLoadingRoutines, setIsLoadingRoutines] = useState(false);

  // Schema support (PostgreSQL)
  const [schemas, setSchemas] = useState<string[]>([]);
  const [isLoadingSchemas, setIsLoadingSchemas] = useState(false);
  const [schemaDataMap, setSchemaDataMap] = useState<Record<string, SchemaData>>({});
  const [activeSchema, setActiveSchema] = useState<string | null>(null);
  const [selectedSchemas, setSelectedSchemasState] = useState<string[]>([]);
  const [needsSchemaSelection, setNeedsSchemaSelection] = useState(false);

  // Sync Window Title with active connection
  // WORKAROUND: Using custom Tauri command instead of window.setTitle() for Wayland support
  // See: https://github.com/tauri-apps/tauri/issues/13749
  useEffect(() => {
    const updateTitle = async () => {
      try {
        let title = 'tabularis';
        if (activeConnectionName && activeDatabaseName) {
          const schemaSuffix = activeSchema && activeDriver === 'postgres' ? `/${activeSchema}` : '';
          title = `tabularis - ${activeConnectionName} (${activeDatabaseName}${schemaSuffix})`;
        }
        await invoke('set_window_title', { title });
      } catch (e) {
        console.error('Failed to update window title', e);
      }
    };
    updateTitle();
  }, [activeConnectionName, activeDatabaseName, activeSchema, activeDriver]);

  const refreshTables = async () => {
      if (!activeConnectionId) return;
      setIsLoadingTables(true);
      try {
          const result = await invoke<TableInfo[]>('get_tables', { connectionId: activeConnectionId });
          setTables(result);
      } catch (e) {
          console.error('Failed to refresh tables:', e);
      } finally {
          setIsLoadingTables(false);
      }
  };

  const refreshViews = async () => {
      if (!activeConnectionId) return;
      setIsLoadingViews(true);
      try {
          const result = await invoke<ViewInfo[]>('get_views', { connectionId: activeConnectionId });
          setViews(result);
      } catch (e) {
          console.error('Failed to refresh views:', e);
      } finally {
          setIsLoadingViews(false);
      }
  };

  const refreshRoutines = async () => {
    if (!activeConnectionId) return;
    setIsLoadingRoutines(true);
    try {
      const result = await invoke<RoutineInfo[]>('get_routines', { connectionId: activeConnectionId });
      setRoutines(result);
    } catch (e) {
      console.error('Failed to refresh routines:', e);
    } finally {
      setIsLoadingRoutines(false);
    }
  };

  const loadSchemaData = useCallback(async (schema: string) => {
    if (!activeConnectionId) return;

    // Skip if already loaded or currently loading
    setSchemaDataMap(prev => {
      const existing = prev[schema];
      if (existing?.isLoaded || existing?.isLoading) return prev;
      return {
        ...prev,
        [schema]: { tables: [], views: [], routines: [], isLoading: true, isLoaded: false },
      };
    });

    // Check outside setState to decide whether to proceed
    const existing = schemaDataMap[schema];
    if (existing?.isLoaded || existing?.isLoading) return;

    try {
      const [tablesResult, viewsResult, routinesResult] = await Promise.all([
        invoke<TableInfo[]>('get_tables', { connectionId: activeConnectionId, schema }),
        invoke<ViewInfo[]>('get_views', { connectionId: activeConnectionId, schema }),
        invoke<RoutineInfo[]>('get_routines', { connectionId: activeConnectionId, schema }),
      ]);

      setSchemaDataMap(prev => ({
        ...prev,
        [schema]: {
          tables: tablesResult,
          views: viewsResult,
          routines: routinesResult,
          isLoading: false,
          isLoaded: true,
        },
      }));
    } catch (e) {
      console.error(`Failed to load schema data for ${schema}:`, e);
      setSchemaDataMap(prev => ({
        ...prev,
        [schema]: { tables: [], views: [], routines: [], isLoading: false, isLoaded: false },
      }));
    }
  }, [activeConnectionId, schemaDataMap]);

  const refreshSchemaData = useCallback(async (schema: string) => {
    if (!activeConnectionId) return;

    setSchemaDataMap(prev => ({
      ...prev,
      [schema]: { ...(prev[schema] || { tables: [], views: [], routines: [], isLoaded: false }), isLoading: true },
    }));

    try {
      const [tablesResult, viewsResult, routinesResult] = await Promise.all([
        invoke<TableInfo[]>('get_tables', { connectionId: activeConnectionId, schema }),
        invoke<ViewInfo[]>('get_views', { connectionId: activeConnectionId, schema }),
        invoke<RoutineInfo[]>('get_routines', { connectionId: activeConnectionId, schema }),
      ]);

      setSchemaDataMap(prev => ({
        ...prev,
        [schema]: {
          tables: tablesResult,
          views: viewsResult,
          routines: routinesResult,
          isLoading: false,
          isLoaded: true,
        },
      }));
    } catch (e) {
      console.error(`Failed to refresh schema data for ${schema}:`, e);
      setSchemaDataMap(prev => ({
        ...prev,
        [schema]: { ...(prev[schema] || { tables: [], views: [], routines: [], isLoaded: false }), isLoading: false },
      }));
    }
  }, [activeConnectionId]);

  const setSelectedSchemas = useCallback(async (newSchemas: string[]) => {
    setSelectedSchemasState(newSchemas);
    setNeedsSchemaSelection(false);

    if (activeConnectionId) {
      // Persist selection
      try {
        await invoke('set_selected_schemas', {
          connectionId: activeConnectionId,
          schemas: newSchemas,
        });
      } catch (e) {
        console.error('Failed to persist selected schemas:', e);
      }

      // Load data for newly-added schemas
      for (const schema of newSchemas) {
        const existing = schemaDataMap[schema];
        if (!existing?.isLoaded && !existing?.isLoading) {
          loadSchemaData(schema);
        }
      }

      // Update activeSchema if missing or no longer in the selection
      if (!activeSchema || !newSchemas.includes(activeSchema)) {
        const nextSchema = newSchemas[0] || null;
        setActiveSchema(nextSchema);
        if (nextSchema && activeConnectionId) {
          invoke('set_schema_preference', { connectionId: activeConnectionId, schema: nextSchema }).catch(() => {});
        }
      }
    }
  }, [activeConnectionId, schemaDataMap, loadSchemaData, activeSchema]);

  const connect = async (connectionId: string) => {
    // Disconnect from previous connection if exists
    if (activeConnectionId && activeConnectionId !== connectionId) {
      console.log(`[DatabaseProvider] Disconnecting from previous connection: ${activeConnectionId}`);
      try {
        await invoke('disconnect_connection', { connectionId: activeConnectionId });
        console.log(`[DatabaseProvider] Successfully disconnected from: ${activeConnectionId}`);
      } catch (error) {
        console.error(`[DatabaseProvider] Failed to disconnect from ${activeConnectionId}:`, error);
      }
    }

    setActiveConnectionId(connectionId);
    setIsLoadingTables(true);
    setIsLoadingViews(true);
    setIsLoadingRoutines(true);
    setTables([]);
    setViews([]);
    setRoutines([]);
    setActiveDriver(null);
    setActiveTable(null);
    setActiveConnectionName(null);
    setActiveDatabaseName(null);
    setSchemas([]);
    setSchemaDataMap({});
    setActiveSchema(null);
    setSelectedSchemasState([]);
    setNeedsSchemaSelection(false);

    try {
      // 1. Get driver info
      const connections = await invoke<SavedConnection[]>('get_connections');
      const conn = connections.find(c => c.id === connectionId);
      let driver: string | null = null;
      if (conn) {
        driver = conn.params.driver;
        setActiveDriver(driver);
        setActiveConnectionName(conn.name);
        setActiveDatabaseName(conn.params.database);
      }

      // 2. Test the connection (SSH tunnel + database) before proceeding
      if (conn) {
        try {
          await invoke<string>('test_connection', {
            request: {
              params: conn.params,
              connection_id: connectionId,
            },
          });
        } catch (testError) {
          // Connection test failed - throw error with clear message
          const errorMsg = typeof testError === 'string' ? testError : (testError as Error).message || String(testError);
          throw new Error(errorMsg);
        }
      }

      // 3. For PostgreSQL: fetch schemas, then check saved selection
      if (driver === 'postgres') {
        setIsLoadingSchemas(true);
        try {
          const schemasResult = await invoke<string[]>('get_schemas', { connectionId });
          setSchemas(schemasResult);

          // Check for saved schema selection
          let savedSelection: string[] = [];
          try {
            savedSelection = await invoke<string[]>('get_selected_schemas', { connectionId });
          } catch {
            // Ignore errors
          }

          // Filter saved selection to only include schemas that still exist
          const validSelection = savedSelection.filter(s => schemasResult.includes(s));

          if (validSelection.length > 0) {
            // Saved selection exists: load those schemas
            setSelectedSchemasState(validSelection);
            setNeedsSchemaSelection(false);

            // Get saved preferred schema or use first selected
            let preferredSchema = validSelection[0];
            try {
              const saved = await invoke<string | null>('get_schema_preference', { connectionId });
              if (saved && validSelection.includes(saved)) {
                preferredSchema = saved;
              }
            } catch {
              // Ignore preference errors
            }

            setActiveSchema(preferredSchema);

            // Auto-load the preferred schema's data
            const [tablesResult, viewsResult, routinesResult] = await Promise.all([
              invoke<TableInfo[]>('get_tables', { connectionId, schema: preferredSchema }),
              invoke<ViewInfo[]>('get_views', { connectionId, schema: preferredSchema }),
              invoke<RoutineInfo[]>('get_routines', { connectionId, schema: preferredSchema }),
            ]);

            setSchemaDataMap({
              [preferredSchema]: {
                tables: tablesResult,
                views: viewsResult,
                routines: routinesResult,
                isLoading: false,
                isLoaded: true,
              },
            });
          } else {
            // No saved selection: user must pick schemas
            setSelectedSchemasState([]);
            setNeedsSchemaSelection(true);
          }
        } catch (e) {
          console.error('Failed to fetch schemas:', e);
        } finally {
          setIsLoadingSchemas(false);
        }
      } else {
        // 4. MySQL/SQLite: fetch flat tables/views/routines
        const [tablesResult, viewsResult, routinesResult] = await Promise.all([
          invoke<TableInfo[]>('get_tables', { connectionId }),
          invoke<ViewInfo[]>('get_views', { connectionId }),
          invoke<RoutineInfo[]>('get_routines', { connectionId })
        ]);
        setTables(tablesResult);
        setViews(viewsResult);
        setRoutines(routinesResult);
      }
    } catch (error) {
      console.error('Failed to fetch tables/views/routines:', error);
      setActiveConnectionId(null);
      setActiveDriver(null);
      setActiveConnectionName(null);
      setActiveDatabaseName(null);
      throw error;
    } finally {
      setIsLoadingTables(false);
      setIsLoadingViews(false);
      setIsLoadingRoutines(false);
    }
  };

  const setActiveTableWithSchema = useCallback((table: string | null, schema?: string | null) => {
    setActiveTable(table);
    if (schema !== undefined && schema !== null) {
      setActiveSchema(schema);
      // Save preference
      if (activeConnectionId) {
        invoke('set_schema_preference', { connectionId: activeConnectionId, schema }).catch(() => {});
      }
    }
  }, [activeConnectionId]);

  const disconnect = async () => {
    if (activeConnectionId) {
      console.log(`[DatabaseProvider] Disconnecting from connection: ${activeConnectionId}`);

      // Clear autocomplete cache
      clearAutocompleteCache(activeConnectionId);

      // Close the actual database connection
      try {
        await invoke('disconnect_connection', { connectionId: activeConnectionId });
        console.log(`[DatabaseProvider] Successfully disconnected from: ${activeConnectionId}`);
      } catch (error) {
        console.error(`[DatabaseProvider] Failed to disconnect from ${activeConnectionId}:`, error);
      }
    }

    // Clear local state
    setActiveConnectionId(null);
    setActiveDriver(null);
    setActiveTable(null);
    setActiveConnectionName(null);
    setActiveDatabaseName(null);
    setTables([]);
    setViews([]);
    setRoutines([]);
    setSchemas([]);
    setSchemaDataMap({});
    setActiveSchema(null);
    setSelectedSchemasState([]);
    setNeedsSchemaSelection(false);
    setIsLoadingSchemas(false);
  };

  return (
    <DatabaseContext.Provider value={{
      activeConnectionId,
      activeDriver,
      activeTable,
      activeConnectionName,
      activeDatabaseName,
      tables,
      views,
      routines,
      isLoadingTables,
      isLoadingViews,
      isLoadingRoutines,
      connect,
      disconnect,
      setActiveTable: setActiveTableWithSchema,
      refreshTables,
      refreshViews,
      refreshRoutines,
      // Schema support
      schemas,
      isLoadingSchemas,
      schemaDataMap,
      activeSchema,
      loadSchemaData,
      refreshSchemaData,
      // Schema selection
      selectedSchemas,
      setSelectedSchemas,
      needsSchemaSelection,
    }}>
      {children}
    </DatabaseContext.Provider>
  );
};
