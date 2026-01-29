import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Tab } from '../types/editor';
import { EditorContext } from './EditorContext';
import { useDatabase } from '../hooks/useDatabase';

export const EditorProvider = ({ children }: { children: ReactNode }) => {
  const { activeConnectionId } = useDatabase();
  const [tabs, setTabs] = useState<Tab[]>(() => {
    const saved = localStorage.getItem('sql_editor_tabs_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.tabs || [];
      } catch (e) {
        console.error("Failed to load tabs", e);
      }
    }
    return [];
  });

  const [activeTabIds, setActiveTabIds] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('sql_editor_tabs_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.activeTabIds || {};
      } catch (e) {
        console.error("Failed to load activeTabIds", e);
      }
    }
    return {};
  });
  const tabsRef = useRef<Tab[]>([]);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  const createInitialTab = useCallback((partial?: Partial<Tab>): Tab => {
    return {
      id: Math.random().toString(36).substring(2, 9),
      title: "Console",
      type: 'console',
      query: "",
      result: null,
      error: "",
      executionTime: null,
      page: 1,
      activeTable: null,
      pkColumn: null,
      isLoading: false,
      connectionId: activeConnectionId || "",
      isEditorOpen: partial?.isEditorOpen ?? (partial?.type !== 'table'),
      ...partial
    };
  }, [activeConnectionId]);

  useEffect(() => {
    localStorage.setItem('sql_editor_tabs_v2', JSON.stringify({ tabs, activeTabIds }));
  }, [tabs, activeTabIds]);

  const activeTabId = activeConnectionId ? activeTabIds[activeConnectionId] : null;

  const setActiveTabId = useCallback((id: string | null) => {
    if (activeConnectionId && id) {
      setActiveTabIds(prev => ({ ...prev, [activeConnectionId]: id }));
    }
  }, [activeConnectionId]);

  const addTab = useCallback((partial?: Partial<Tab>) => {
    if (!activeConnectionId) return "";

    const existing = tabsRef.current.find(t => 
      t.connectionId === activeConnectionId && 
      t.type === 'table' && 
      t.activeTable === partial?.activeTable
    );
    if (existing) {
        setActiveTabId(existing.id);
        return existing.id;
    }

    const id = Math.random().toString(36).substring(2, 9);
    setTabs(prev => {
      let title = partial?.title;
      if (!title) {
        if (partial?.type === 'table' && partial.activeTable) {
          title = partial.activeTable;
        } else {
          const consoleCount = prev.filter(t => t.connectionId === activeConnectionId && t.type === 'console').length;
          const queryBuilderCount = prev.filter(t => t.connectionId === activeConnectionId && t.type === 'query_builder').length;
          
          if (partial?.type === 'query_builder') {
             title = queryBuilderCount === 0 ? "Visual Query" : `Visual Query ${queryBuilderCount + 1}`;
          } else {
             title = consoleCount === 0 ? "Console" : `Console ${consoleCount + 1}`;
          }
        }
      }
      const newTab = createInitialTab({ id, title, connectionId: activeConnectionId, ...partial });
      return [...prev, newTab];
    });
    setActiveTabId(id);
    return id;
  }, [createInitialTab, activeConnectionId, setActiveTabId]);

  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      const tabToClose = prev.find(t => t.id === id);
      const newTabs = prev.filter(t => t.id !== id);
      const connTabs = newTabs.filter(t => t.connectionId === activeConnectionId);
      
      if (connTabs.length === 0 && tabToClose?.connectionId === activeConnectionId) {
        const nextId = Math.random().toString(36).substring(2, 9);
        const t = createInitialTab({ id: nextId, title: "Console", type: 'console', connectionId: activeConnectionId });
        setActiveTabIds(prevIds => ({ ...prevIds, [activeConnectionId]: nextId }));
        return [...newTabs, t];
      }
      
      if (activeTabId === id) {
        const closedIdx = prev.findIndex(t => t.id === id);
        const nextActiveIdx = Math.min(closedIdx, connTabs.length > 0 ? connTabs.length - 1 : 0);
        const nextActiveTab = connTabs[nextActiveIdx];
        if (nextActiveTab && activeConnectionId) {
          setActiveTabIds(prevIds => ({ ...prevIds, [activeConnectionId]: nextActiveTab.id }));
        }
      }
      
      return newTabs;
    });
  }, [createInitialTab, activeConnectionId, activeTabId]);

  const closeAllTabs = useCallback(() => {
    if (!activeConnectionId) return;
    setTabs(prev => {
      // Keep tabs from other connections
      const otherConnTabs = prev.filter(t => t.connectionId !== activeConnectionId);
      
      // Create fresh console tab for current connection
      const nextId = Math.random().toString(36).substring(2, 9);
      const t = createInitialTab({ id: nextId, title: "Console", type: 'console', connectionId: activeConnectionId });
      setActiveTabIds(prevIds => ({ ...prevIds, [activeConnectionId]: nextId }));
      
      return [...otherConnTabs, t];
    });
  }, [activeConnectionId, createInitialTab]);

  const closeOtherTabs = useCallback((id: string) => {
    if (!activeConnectionId) return;
    setTabs(prev => {
      // Keep tabs from other connections AND the one with id
      const toKeep = prev.filter(t => t.connectionId !== activeConnectionId || t.id === id);
      
      // Ensure the kept tab is active
      setActiveTabIds(prevIds => ({ ...prevIds, [activeConnectionId]: id }));
      
      return toKeep;
    });
  }, [activeConnectionId]);

  const closeTabsToLeft = useCallback((id: string) => {
    if (!activeConnectionId) return;
    setTabs(prev => {
      const connTabs = prev.filter(t => t.connectionId === activeConnectionId);
      const targetIndex = connTabs.findIndex(t => t.id === id);
      if (targetIndex === -1) return prev;

      const tabsToClose = connTabs.slice(0, targetIndex).map(t => t.id);
      const otherConnTabs = prev.filter(t => t.connectionId !== activeConnectionId);
      const remainingConnTabs = connTabs.slice(targetIndex);

      // If active tab was among closed ones, set active to the target tab
      // (The target tab is the leftmost surviving tab)
      const activeTabWasClosed = tabsToClose.includes(activeTabId || "");
      if (activeTabWasClosed) {
        setActiveTabIds(prevIds => ({ ...prevIds, [activeConnectionId]: id }));
      }

      return [...otherConnTabs, ...remainingConnTabs];
    });
  }, [activeConnectionId, activeTabId]);

  const closeTabsToRight = useCallback((id: string) => {
    if (!activeConnectionId) return;
    setTabs(prev => {
      const connTabs = prev.filter(t => t.connectionId === activeConnectionId);
      const targetIndex = connTabs.findIndex(t => t.id === id);
      if (targetIndex === -1) return prev;

      const tabsToClose = connTabs.slice(targetIndex + 1).map(t => t.id);
      const otherConnTabs = prev.filter(t => t.connectionId !== activeConnectionId);
      const remainingConnTabs = connTabs.slice(0, targetIndex + 1);

      // If active tab was among closed ones, set active to the target tab
      // (The target tab is the rightmost surviving tab)
      const activeTabWasClosed = tabsToClose.includes(activeTabId || "");
      if (activeTabWasClosed) {
         setActiveTabIds(prevIds => ({ ...prevIds, [activeConnectionId]: id }));
      }

      return [...otherConnTabs, ...remainingConnTabs];
    });
  }, [activeConnectionId, activeTabId]);

  const updateTab = useCallback((id: string, partial: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...partial } : t));
  }, []);

  const activeTab = useMemo(() => {
    if (!activeConnectionId || !activeTabId) return null;
    const tab = tabs.find(t => t.id === activeTabId);
    return (tab && tab.connectionId === activeConnectionId) ? tab : null;
  }, [tabs, activeTabId, activeConnectionId]);

  const connectionTabs = useMemo(() => {
    return tabs.filter(t => t.connectionId === activeConnectionId);
  }, [tabs, activeConnectionId]);

  return (
    <EditorContext.Provider value={{ 
      tabs: connectionTabs, 
      activeTabId, 
      activeTab,
      addTab, 
      closeTab, 
      updateTab, 
      setActiveTabId,
      closeAllTabs,
      closeOtherTabs,
      closeTabsToLeft,
      closeTabsToRight
    }}>
      {children}
    </EditorContext.Provider>
  );
};
