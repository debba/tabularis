import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useDatabase } from './DatabaseContext';

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  connection_id: string;
}

interface SavedQueriesContextType {
  queries: SavedQuery[];
  isLoading: boolean;
  saveQuery: (name: string, sql: string) => Promise<void>;
  updateQuery: (id: string, name: string, sql: string) => Promise<void>;
  deleteQuery: (id: string) => Promise<void>;
  refreshQueries: () => Promise<void>;
}

const SavedQueriesContext = createContext<SavedQueriesContextType | undefined>(undefined);

export const SavedQueriesProvider = ({ children }: { children: ReactNode }) => {
  const { activeConnectionId } = useDatabase();
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshQueries = async () => {
    if (!activeConnectionId) {
        setQueries([]);
        return;
    }
    
    setIsLoading(true);
    try {
      const result = await invoke<SavedQuery[]>('get_saved_queries', { connectionId: activeConnectionId });
      setQueries(result);
    } catch (e) {
      console.error("Failed to load saved queries:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshQueries();
  }, [activeConnectionId]);

  const saveQuery = async (name: string, sql: string) => {
    if (!activeConnectionId) return;
    try {
      await invoke('save_query', { connectionId: activeConnectionId, name, sql });
      await refreshQueries();
    } catch (e) {
      console.error("Failed to save query:", e);
      throw e;
    }
  };

  const updateQuery = async (id: string, name: string, sql: string) => {
    try {
      await invoke('update_saved_query', { id, name, sql });
      await refreshQueries();
    } catch (e) {
      console.error("Failed to update query:", e);
      throw e;
    }
  };

  const deleteQuery = async (id: string) => {
    try {
      await invoke('delete_saved_query', { id });
      await refreshQueries();
    } catch (e) {
      console.error("Failed to delete query:", e);
      throw e;
    }
  };

  return (
    <SavedQueriesContext.Provider value={{ queries, isLoading, saveQuery, updateQuery, deleteQuery, refreshQueries }}>
      {children}
    </SavedQueriesContext.Provider>
  );
};

export const useSavedQueries = () => {
  const context = useContext(SavedQueriesContext);
  if (context === undefined) {
    throw new Error('useSavedQueries must be used within a SavedQueriesProvider');
  }
  return context;
};
