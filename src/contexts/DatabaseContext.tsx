import { createContext, useContext, useState, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface TableInfo {
  name: string;
}

interface SavedConnection {
  id: string;
  name: string;
  params: {
    driver: string;
    host?: string;
    database: string;
  };
}

interface DatabaseContextType {
  activeConnectionId: string | null;
  activeDriver: string | null;
  activeTable: string | null;
  activeConnectionName: string | null;
  activeDatabaseName: string | null;
  tables: TableInfo[];
  isLoadingTables: boolean;
  connect: (connectionId: string) => Promise<void>;
  disconnect: () => void;
  setActiveTable: (table: string | null) => void;
  refreshTables: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export const DatabaseProvider = ({ children }: { children: ReactNode }) => {
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [activeDriver, setActiveDriver] = useState<string | null>(null);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [activeConnectionName, setActiveConnectionName] = useState<string | null>(null);
  const [activeDatabaseName, setActiveDatabaseName] = useState<string | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);

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

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};
