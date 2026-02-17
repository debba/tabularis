import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  DatabaseContext, 
  type TableInfo, 
  type ViewInfo, 
  type RoutineInfo, 
  type SavedConnection, 
  type ConnectionData 
} from './DatabaseContext';
import type { ReactNode } from 'react';
import { clearAutocompleteCache } from '../utils/autocomplete';

const createEmptyConnectionData = (driver: string = '', name: string = '', dbName: string = ''): ConnectionData => ({
  driver,
  connectionName: name,
  databaseName: dbName,
  tables: [],
  views: [],
  routines: [],
  isLoadingTables: false,
  isLoadingViews: false,
  isLoadingRoutines: false,
  schemas: [],
  isLoadingSchemas: false,
  schemaDataMap: {},
  activeSchema: null,
  selectedSchemas: [],
  needsSchemaSelection: false,
  isConnecting: false,
  isConnected: false,
});

export const DatabaseProvider = ({ children }: { children: ReactNode }) => {
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [openConnectionIds, setOpenConnectionIds] = useState<string[]>([]);
  const [connectionDataMap, setConnectionDataMap] = useState<Record<string, ConnectionData>>({});
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);

  const getActiveConnectionData = useCallback((): ConnectionData | undefined => {
    if (!activeConnectionId) return undefined;
    return connectionDataMap[activeConnectionId];
  }, [activeConnectionId, connectionDataMap]);

  const activeData = getActiveConnectionData();

  const activeDriver = activeData?.driver ?? null;
  const activeConnectionName = activeData?.connectionName ?? null;
  const activeDatabaseName = activeData?.databaseName ?? null;
  const tables = activeData?.tables ?? [];
  const views = activeData?.views ?? [];
  const routines = activeData?.routines ?? [];
  const isLoadingTables = activeData?.isLoadingTables ?? false;
  const isLoadingViews = activeData?.isLoadingViews ?? false;
  const isLoadingRoutines = activeData?.isLoadingRoutines ?? false;
  const schemas = activeData?.schemas ?? [];
  const isLoadingSchemas = activeData?.isLoadingSchemas ?? false;
  const schemaDataMap = activeData?.schemaDataMap ?? {};
  const activeSchema = activeData?.activeSchema ?? null;
  const selectedSchemas = activeData?.selectedSchemas ?? [];
  const needsSchemaSelection = activeData?.needsSchemaSelection ?? false;

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

  const updateConnectionData = useCallback((connectionId: string, updates: Partial<ConnectionData>) => {
    setConnectionDataMap(prev => ({
      ...prev,
      [connectionId]: {
        ...prev[connectionId],
        ...updates,
      },
    }));
  }, []);

  const refreshTables = async () => {
    if (!activeConnectionId) return;
    updateConnectionData(activeConnectionId, { isLoadingTables: true });
    try {
      const result = await invoke<TableInfo[]>('get_tables', { connectionId: activeConnectionId });
      updateConnectionData(activeConnectionId, { tables: result, isLoadingTables: false });
    } catch (e) {
      console.error('Failed to refresh tables:', e);
      updateConnectionData(activeConnectionId, { isLoadingTables: false });
    }
  };

  const refreshViews = async () => {
    if (!activeConnectionId) return;
    updateConnectionData(activeConnectionId, { isLoadingViews: true });
    try {
      const result = await invoke<ViewInfo[]>('get_views', { connectionId: activeConnectionId });
      updateConnectionData(activeConnectionId, { views: result, isLoadingViews: false });
    } catch (e) {
      console.error('Failed to refresh views:', e);
      updateConnectionData(activeConnectionId, { isLoadingViews: false });
    }
  };

  const refreshRoutines = async () => {
    if (!activeConnectionId) return;
    updateConnectionData(activeConnectionId, { isLoadingRoutines: true });
    try {
      const result = await invoke<RoutineInfo[]>('get_routines', { connectionId: activeConnectionId });
      updateConnectionData(activeConnectionId, { routines: result, isLoadingRoutines: false });
    } catch (e) {
      console.error('Failed to refresh routines:', e);
      updateConnectionData(activeConnectionId, { isLoadingRoutines: false });
    }
  };

  const loadSchemaData = useCallback(async (schema: string) => {
    if (!activeConnectionId) return;

    const currentData = connectionDataMap[activeConnectionId];
    if (!currentData) return;

    const existingSchemaData = currentData.schemaDataMap[schema];
    if (existingSchemaData?.isLoaded || existingSchemaData?.isLoading) return;

    updateConnectionData(activeConnectionId, {
      schemaDataMap: {
        ...currentData.schemaDataMap,
        [schema]: { tables: [], views: [], routines: [], isLoading: true, isLoaded: false },
      },
    });

    try {
      const [tablesResult, viewsResult, routinesResult] = await Promise.all([
        invoke<TableInfo[]>('get_tables', { connectionId: activeConnectionId, schema }),
        invoke<ViewInfo[]>('get_views', { connectionId: activeConnectionId, schema }),
        invoke<RoutineInfo[]>('get_routines', { connectionId: activeConnectionId, schema }),
      ]);

      const freshData = connectionDataMap[activeConnectionId];
      if (freshData) {
        updateConnectionData(activeConnectionId, {
          schemaDataMap: {
            ...freshData.schemaDataMap,
            [schema]: {
              tables: tablesResult,
              views: viewsResult,
              routines: routinesResult,
              isLoading: false,
              isLoaded: true,
            },
          },
        });
      }
    } catch (e) {
      console.error(`Failed to load schema data for ${schema}:`, e);
      const freshData = connectionDataMap[activeConnectionId];
      if (freshData) {
        updateConnectionData(activeConnectionId, {
          schemaDataMap: {
            ...freshData.schemaDataMap,
            [schema]: { tables: [], views: [], routines: [], isLoading: false, isLoaded: false },
          },
        });
      }
    }
  }, [activeConnectionId, connectionDataMap, updateConnectionData]);

  const refreshSchemaData = useCallback(async (schema: string) => {
    if (!activeConnectionId) return;

    const currentData = connectionDataMap[activeConnectionId];
    if (!currentData) return;

    updateConnectionData(activeConnectionId, {
      schemaDataMap: {
        ...currentData.schemaDataMap,
        [schema]: { 
          ...(currentData.schemaDataMap[schema] || { tables: [], views: [], routines: [], isLoaded: false }), 
          isLoading: true 
        },
      },
    });

    try {
      const [tablesResult, viewsResult, routinesResult] = await Promise.all([
        invoke<TableInfo[]>('get_tables', { connectionId: activeConnectionId, schema }),
        invoke<ViewInfo[]>('get_views', { connectionId: activeConnectionId, schema }),
        invoke<RoutineInfo[]>('get_routines', { connectionId: activeConnectionId, schema }),
      ]);

      const freshData = connectionDataMap[activeConnectionId];
      if (freshData) {
        updateConnectionData(activeConnectionId, {
          schemaDataMap: {
            ...freshData.schemaDataMap,
            [schema]: {
              tables: tablesResult,
              views: viewsResult,
              routines: routinesResult,
              isLoading: false,
              isLoaded: true,
            },
          },
        });
      }
    } catch (e) {
      console.error(`Failed to refresh schema data for ${schema}:`, e);
      const freshData = connectionDataMap[activeConnectionId];
      if (freshData) {
        updateConnectionData(activeConnectionId, {
          schemaDataMap: {
            ...freshData.schemaDataMap,
            [schema]: { 
              ...(freshData.schemaDataMap[schema] || { tables: [], views: [], routines: [], isLoaded: false }), 
              isLoading: false 
            },
          },
        });
      }
    }
  }, [activeConnectionId, connectionDataMap, updateConnectionData]);

  const setSelectedSchemas = useCallback(async (newSchemas: string[]) => {
    if (!activeConnectionId) return;

    const currentData = connectionDataMap[activeConnectionId];
    if (!currentData) return;

    updateConnectionData(activeConnectionId, { 
      selectedSchemas: newSchemas, 
      needsSchemaSelection: false 
    });

    try {
      await invoke('set_selected_schemas', {
        connectionId: activeConnectionId,
        schemas: newSchemas,
      });
    } catch (e) {
      console.error('Failed to persist selected schemas:', e);
    }

    for (const schema of newSchemas) {
      const existing = currentData.schemaDataMap[schema];
      if (!existing?.isLoaded && !existing?.isLoading) {
        loadSchemaData(schema);
      }
    }

    if (!currentData.activeSchema || !newSchemas.includes(currentData.activeSchema)) {
      const nextSchema = newSchemas[0] || null;
      updateConnectionData(activeConnectionId, { activeSchema: nextSchema });
      if (nextSchema && activeConnectionId) {
        invoke('set_schema_preference', { connectionId: activeConnectionId, schema: nextSchema }).catch(() => {});
      }
    }
  }, [activeConnectionId, connectionDataMap, updateConnectionData, loadSchemaData]);

  const connect = async (connectionId: string) => {
    const allConnections = await invoke<SavedConnection[]>('get_connections');
    const conn = allConnections.find(c => c.id === connectionId);
    if (!conn) {
      throw new Error('Connection not found');
    }

    const driver = conn.params.driver;

    if (!openConnectionIds.includes(connectionId)) {
      setOpenConnectionIds(prev => [...prev, connectionId]);
    }

    setConnectionDataMap(prev => ({
      ...prev,
      [connectionId]: {
        ...createEmptyConnectionData(driver, conn.name, conn.params.database),
        isConnecting: true,
        isConnected: false,
      },
    }));

    setActiveConnectionId(connectionId);
    setActiveTable(null);

    try {
      try {
        await invoke<string>('test_connection', {
          request: {
            params: conn.params,
            connection_id: connectionId,
          },
        });
      } catch (testError) {
        const errorMsg = typeof testError === 'string' ? testError : (testError as Error).message || String(testError);
        updateConnectionData(connectionId, { 
          isConnecting: false, 
          isConnected: false,
          error: errorMsg 
        });
        setOpenConnectionIds(prev => prev.filter(id => id !== connectionId));
        throw new Error(errorMsg);
      }

      if (driver === 'postgres') {
        updateConnectionData(connectionId, { isLoadingSchemas: true });

        try {
          const schemasResult = await invoke<string[]>('get_schemas', { connectionId });
          updateConnectionData(connectionId, { schemas: schemasResult });

          let savedSelection: string[] = [];
          try {
            savedSelection = await invoke<string[]>('get_selected_schemas', { connectionId });
          } catch {
            // Ignore - no saved selection exists yet
          }

          const validSelection = savedSelection.filter(s => schemasResult.includes(s));

          if (validSelection.length > 0) {
            let preferredSchema = validSelection[0];
            try {
              const saved = await invoke<string | null>('get_schema_preference', { connectionId });
              if (saved && validSelection.includes(saved)) {
                preferredSchema = saved;
              }
            } catch {
              // Ignore - no saved preference exists yet
            }

            const [tablesResult, viewsResult, routinesResult] = await Promise.all([
              invoke<TableInfo[]>('get_tables', { connectionId, schema: preferredSchema }),
              invoke<ViewInfo[]>('get_views', { connectionId, schema: preferredSchema }),
              invoke<RoutineInfo[]>('get_routines', { connectionId, schema: preferredSchema }),
            ]);

            updateConnectionData(connectionId, {
              selectedSchemas: validSelection,
              needsSchemaSelection: false,
              activeSchema: preferredSchema,
              schemaDataMap: {
                [preferredSchema]: {
                  tables: tablesResult,
                  views: viewsResult,
                  routines: routinesResult,
                  isLoading: false,
                  isLoaded: true,
                },
              },
              isLoadingSchemas: false,
              isConnecting: false,
              isConnected: true,
            });
          } else {
            updateConnectionData(connectionId, {
              selectedSchemas: [],
              needsSchemaSelection: true,
              isLoadingSchemas: false,
              isConnecting: false,
              isConnected: true,
            });
          }
        } catch (e) {
          console.error('Failed to fetch schemas:', e);
          updateConnectionData(connectionId, { 
            isLoadingSchemas: false, 
            isConnecting: false,
            isConnected: true,
          });
        }
      } else {
        const [tablesResult, viewsResult, routinesResult] = await Promise.all([
          invoke<TableInfo[]>('get_tables', { connectionId }),
          invoke<ViewInfo[]>('get_views', { connectionId }),
          invoke<RoutineInfo[]>('get_routines', { connectionId })
        ]);

        updateConnectionData(connectionId, {
          tables: tablesResult,
          views: viewsResult,
          routines: routinesResult,
          isConnecting: false,
          isConnected: true,
        });
      }
    } catch (error) {
      console.error('Failed to connect:', error);
      updateConnectionData(connectionId, { 
        isConnecting: false, 
        isConnected: false,
        error: String(error)
      });
      setOpenConnectionIds(prev => prev.filter(id => id !== connectionId));
      throw error;
    }
  };

  const disconnect = async (connectionId?: string) => {
    const targetId = connectionId || activeConnectionId;
    if (!targetId) return;

    console.log(`[DatabaseProvider] Disconnecting from connection: ${targetId}`);

    clearAutocompleteCache(targetId);

    try {
      await invoke('disconnect_connection', { connectionId: targetId });
      console.log(`[DatabaseProvider] Successfully disconnected from: ${targetId}`);
    } catch (error) {
      console.error(`[DatabaseProvider] Failed to disconnect from ${targetId}:`, error);
    }

    setOpenConnectionIds(prev => prev.filter(id => id !== targetId));
    setConnectionDataMap(prev => {
      const newMap = { ...prev };
      delete newMap[targetId];
      return newMap;
    });

    if (activeConnectionId === targetId) {
      const remainingIds = openConnectionIds.filter(id => id !== targetId);
      if (remainingIds.length > 0) {
        setActiveConnectionId(remainingIds[0]);
      } else {
        setActiveConnectionId(null);
        setActiveTable(null);
      }
    }
  };

  const switchConnection = useCallback((connectionId: string) => {
    if (openConnectionIds.includes(connectionId)) {
      setActiveConnectionId(connectionId);
      setActiveTable(null);
    }
  }, [openConnectionIds]);

  const setActiveTableWithSchema = useCallback((table: string | null, schema?: string | null) => {
    setActiveTable(table);
    if (schema !== undefined && schema !== null && activeConnectionId) {
      updateConnectionData(activeConnectionId, { activeSchema: schema });
      invoke('set_schema_preference', { connectionId: activeConnectionId, schema }).catch(() => {});
    }
  }, [activeConnectionId, updateConnectionData]);

  const loadConnections = useCallback(async () => {
    setIsLoadingConnections(true);
    try {
      const result = await invoke<SavedConnection[]>('get_connections');
      setConnections(result);
    } catch (e) {
      console.error('Failed to load connections:', e);
    } finally {
      setIsLoadingConnections(false);
    }
  }, []);

  const getConnectionData = useCallback((connectionId: string): ConnectionData | undefined => {
    return connectionDataMap[connectionId];
  }, [connectionDataMap]);

  const isConnectionOpen = useCallback((connectionId: string): boolean => {
    return openConnectionIds.includes(connectionId);
  }, [openConnectionIds]);

  return (
    <DatabaseContext.Provider value={{
      activeConnectionId,
      openConnectionIds,
      connectionDataMap,
      activeTable,
      activeDriver,
      activeConnectionName,
      activeDatabaseName,
      tables,
      views,
      routines,
      isLoadingTables,
      isLoadingViews,
      isLoadingRoutines,
      schemas,
      isLoadingSchemas,
      schemaDataMap,
      activeSchema,
      selectedSchemas,
      needsSchemaSelection,
      connections,
      loadConnections,
      isLoadingConnections,
      connect,
      disconnect,
      switchConnection,
      setActiveTable: setActiveTableWithSchema,
      refreshTables,
      refreshViews,
      refreshRoutines,
      loadSchemaData,
      refreshSchemaData,
      setSelectedSchemas,
      getConnectionData,
      isConnectionOpen,
    }}>
      {children}
    </DatabaseContext.Provider>
  );
};
