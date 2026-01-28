import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DatabaseContext, type TableInfo, type SavedConnection } from './DatabaseContext';
import type { ReactNode } from 'react';

export const DatabaseProvider = ({ children }: { children: ReactNode }) => {
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [activeDriver, setActiveDriver] = useState<string | null>(null);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [activeConnectionName, setActiveConnectionName] = useState<string | null>(null);
  const [activeDatabaseName, setActiveDatabaseName] = useState<string | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);

  // Sync Window Title with active connection
  // WORKAROUND: Using custom Tauri command instead of window.setTitle() for Wayland support
  // See: https://github.com/tauri-apps/tauri/issues/13749
  useEffect(() => {
    const updateTitle = async () => {
      try {
        const title = (activeConnectionName && activeDatabaseName)
          ? `debba.sql - ${activeConnectionName} (${activeDatabaseName})`
          : 'debba.sql';
        await invoke('set_window_title', { title });
      } catch (e) {
        console.error('Failed to update window title', e);
      }
    };
    updateTitle();
  }, [activeConnectionName, activeDatabaseName]);

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

  const connect = async (connectionId: string) => {
    setActiveConnectionId(connectionId);
    setIsLoadingTables(true);
    setTables([]);
    setActiveDriver(null);
    setActiveTable(null);
    setActiveConnectionName(null);
    setActiveDatabaseName(null);

    try {
      // 1. Get driver info
      const connections = await invoke<SavedConnection[]>('get_connections');
      const conn = connections.find(c => c.id === connectionId);
      if (conn) {
        setActiveDriver(conn.params.driver);
        setActiveConnectionName(conn.name);
        setActiveDatabaseName(conn.params.database);
      }

      // 2. Get tables
      const result = await invoke<TableInfo[]>('get_tables', { connectionId });
      setTables(result);
    } catch (error) {
      console.error('Failed to fetch tables:', error);
      setActiveConnectionId(null);
      setActiveDriver(null);
      setActiveConnectionName(null);
      setActiveDatabaseName(null);
      throw error;
    } finally {
      setIsLoadingTables(false);
    }
  };

  const disconnect = () => {
    setActiveConnectionId(null);
    setActiveDriver(null);
    setActiveTable(null);
    setActiveConnectionName(null);
    setActiveDatabaseName(null);
    setTables([]);
  };

  return (
    <DatabaseContext.Provider value={{ 
      activeConnectionId, 
      activeDriver, 
      activeTable, 
      activeConnectionName,
      activeDatabaseName,
      tables, 
      isLoadingTables, 
      connect, 
      disconnect,
      setActiveTable,
      refreshTables
    }}>
      {children}
    </DatabaseContext.Provider>
  );
};
