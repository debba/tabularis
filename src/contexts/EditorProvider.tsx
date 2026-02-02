import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Tab, SchemaCache, TableSchema } from '../types/editor';
import { EditorContext } from './EditorContext';
import { useDatabase } from '../hooks/useDatabase';
import { invoke } from '@tauri-apps/api/core';
import {
  generateTabId,
  loadTabsFromStorage,
  saveTabsToStorage,
  createInitialTabState,
  generateTabTitle,
  findExistingTableTab,
  getConnectionTabs,
  getActiveTab,
  closeTabWithState,
  closeAllTabsForConnection,
  closeOtherTabsForConnection,
  closeTabsToLeft,
  closeTabsToRight,
  updateTabInList,
  shouldUseCachedSchema,
  createSchemaCacheEntry,
} from '../utils/editor';

export const EditorProvider = ({ children }: { children: ReactNode }) => {
  const { activeConnectionId } = useDatabase();
  const [tabs, setTabs] = useState<Tab[]>(() => {
    const loaded = loadTabsFromStorage();
    return loaded?.tabs || [];
  });

  const [activeTabIds, setActiveTabIds] = useState<Record<string, string>>(() => {
    const loaded = loadTabsFromStorage();
    return loaded?.activeTabIds || {};
  });

  const schemaCacheRef = useRef<Record<string, SchemaCache>>({});
  const tabsRef = useRef<Tab[]>([]);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  const createInitialTab = useCallback((partial?: Partial<Tab>): Tab => {
    return createInitialTabState(activeConnectionId, partial);
  }, [activeConnectionId]);

  useEffect(() => {
    saveTabsToStorage(tabs, activeTabIds);
  }, [tabs, activeTabIds]);

  const activeTabId = activeConnectionId ? (activeTabIds[activeConnectionId] || null) : null;

  const setActiveTabId = useCallback((id: string | null) => {
    if (activeConnectionId && id) {
      setActiveTabIds(prev => ({ ...prev, [activeConnectionId]: id }));
    }
  }, [activeConnectionId]);

  const addTab = useCallback((partial?: Partial<Tab>) => {
    if (!activeConnectionId) return "";

    const existing = findExistingTableTab(
      tabsRef.current,
      activeConnectionId,
      partial?.activeTable || undefined
    );
    if (existing) {
        setActiveTabId(existing.id);
        return existing.id;
    }

    const id = generateTabId();
    setTabs(prev => {
      const title = generateTabTitle(prev, activeConnectionId, partial);
      const newTab = createInitialTab({ id, title, connectionId: activeConnectionId, ...partial });
      return [...prev, newTab];
    });
    setActiveTabId(id);
    return id;
  }, [createInitialTab, activeConnectionId, setActiveTabId]);

  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      const { newTabs, newActiveTabId: nextActiveId, createdNewTab } = closeTabWithState(
        prev,
        activeConnectionId || '',
        activeTabId,
        id,
        (connId) => createInitialTab({ id: generateTabId(), connectionId: connId })
      );

      if (createdNewTab && nextActiveId) {
        setActiveTabIds(prevIds => ({ ...prevIds, [activeConnectionId || '']: nextActiveId }));
      } else if (nextActiveId !== activeTabId) {
        setActiveTabIds(prevIds => ({ ...prevIds, [activeConnectionId || '']: nextActiveId || '' }));
      }

      return newTabs;
    });
  }, [activeConnectionId, activeTabId, createInitialTab]);

  const closeAllTabs = useCallback(() => {
    if (!activeConnectionId) return;
    setTabs(prev => {
      const { newTabs, newActiveTabId } = closeAllTabsForConnection(
        prev,
        activeConnectionId,
        (connId) => createInitialTab({ id: generateTabId(), connectionId: connId })
      );
      setActiveTabIds(prevIds => ({ ...prevIds, [activeConnectionId]: newActiveTabId }));
      return newTabs;
    });
  }, [activeConnectionId, createInitialTab]);

  const closeOtherTabs = useCallback((id: string) => {
    if (!activeConnectionId) return;
    setTabs(prev => {
      const newTabs = closeOtherTabsForConnection(prev, activeConnectionId, id);
      setActiveTabIds(prevIds => ({ ...prevIds, [activeConnectionId]: id }));
      return newTabs;
    });
  }, [activeConnectionId]);

  const closeTabsToLeftInternal = useCallback((id: string) => {
    if (!activeConnectionId) return;
    setTabs(prev => {
      const { newTabs, newActiveTabId } = closeTabsToLeft(
        prev,
        activeConnectionId,
        id,
        activeTabId
      );
      if (newActiveTabId && newActiveTabId !== activeTabId) {
        setActiveTabIds(prevIds => ({ ...prevIds, [activeConnectionId]: newActiveTabId }));
      }
      return newTabs;
    });
  }, [activeConnectionId, activeTabId]);

  const closeTabsToRightInternal = useCallback((id: string) => {
    if (!activeConnectionId) return;
    setTabs(prev => {
      const { newTabs, newActiveTabId } = closeTabsToRight(
        prev,
        activeConnectionId,
        id,
        activeTabId
      );
      if (newActiveTabId && newActiveTabId !== activeTabId) {
        setActiveTabIds(prevIds => ({ ...prevIds, [activeConnectionId]: newActiveTabId }));
      }
      return newTabs;
    });
  }, [activeConnectionId, activeTabId]);

  const updateTab = useCallback((id: string, partial: Partial<Tab>) => {
    setTabs(prev => updateTabInList(prev, id, partial));
  }, []);

  const getSchema = useCallback(async (connectionId: string, schemaVersion?: number): Promise<TableSchema[]> => {
    const cached = schemaCacheRef.current[connectionId];

    // Cache hit: same version, less than 5 minutes old
    if (shouldUseCachedSchema(cached, schemaVersion)) {
      console.log("Using cached schema for", connectionId);
      return cached!.data;
    }

    // Cache miss: fetch from backend
    console.log("Fetching schema from backend for", connectionId);
    const data = await invoke<TableSchema[]>('get_schema_snapshot', {
      connectionId
    });

    // Update cache in ref (no state update = no re-render)
    schemaCacheRef.current = {
      ...schemaCacheRef.current,
      [connectionId]: createSchemaCacheEntry(data, schemaVersion || 0)
    };

    return data;
  }, []); // No dependencies - stable function

  const activeTab = useMemo(() => {
    return getActiveTab(tabs, activeConnectionId, activeTabId);
  }, [tabs, activeTabId, activeConnectionId]);

  const connectionTabs = useMemo(() => {
    return getConnectionTabs(tabs, activeConnectionId);
  }, [tabs, activeConnectionId]);

  const contextValue = useMemo(() => ({
    tabs: connectionTabs,
    activeTabId,
    activeTab,
    addTab,
    closeTab,
    updateTab,
    setActiveTabId,
    closeAllTabs,
    closeOtherTabs,
    closeTabsToLeft: closeTabsToLeftInternal,
    closeTabsToRight: closeTabsToRightInternal,
    getSchema
  }), [
    connectionTabs,
    activeTabId,
    activeTab,
    addTab,
    closeTab,
    updateTab,
    setActiveTabId,
    closeAllTabs,
    closeOtherTabs,
    closeTabsToLeftInternal,
    closeTabsToRightInternal,
    getSchema
  ]);

  return (
    <EditorContext.Provider value={contextValue}>
      {children}
    </EditorContext.Provider>
  );
};
