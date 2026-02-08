import type { Tab, SchemaCache, TableSchema } from '../types/editor';
import { quoteIdentifier } from './identifiers';

export interface TabsStorage {
  tabs: Tab[];
  activeTabIds: Record<string, string>;
}

export const STORAGE_KEY = 'sql_editor_tabs_v2';

export function generateTabId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function loadTabsFromStorage(): TabsStorage | null {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        tabs: parsed.tabs || [],
        activeTabIds: parsed.activeTabIds || {},
      };
    } catch (e) {
      console.error('Failed to load tabs from storage', e);
      return null;
    }
  }
  return null;
}

export function saveTabsToStorage(tabs: Tab[], activeTabIds: Record<string, string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeTabIds }));
}

export function createInitialTabState(
  connectionId: string | null,
  partial?: Partial<Tab>
): Tab {
  return {
    id: generateTabId(),
    title: 'Console',
    type: 'console',
    query: '',
    result: null,
    error: '',
    executionTime: null,
    page: 1,
    activeTable: null,
    pkColumn: null,
    isLoading: false,
    connectionId: connectionId || '',
    isEditorOpen: partial?.isEditorOpen ?? (partial?.type !== 'table'),
    ...partial,
  };
}

export function generateTabTitle(
  tabs: Tab[],
  activeConnectionId: string,
  partial?: Partial<Tab>
): string {
  if (partial?.title) {
    return partial.title;
  }

  if (partial?.type === 'table' && partial.activeTable) {
    return partial.activeTable;
  }

  const consoleCount = tabs.filter(
    (t) => t.connectionId === activeConnectionId && t.type === 'console'
  ).length;
  const queryBuilderCount = tabs.filter(
    (t) => t.connectionId === activeConnectionId && t.type === 'query_builder'
  ).length;

  if (partial?.type === 'query_builder') {
    return queryBuilderCount === 0 ? 'Visual Query' : `Visual Query ${queryBuilderCount + 1}`;
  }

  return consoleCount === 0 ? 'Console' : `Console ${consoleCount + 1}`;
}

export function findExistingTableTab(
  tabs: Tab[],
  connectionId: string,
  tableName: string | undefined
): Tab | undefined {
  if (!tableName) return undefined;
  return tabs.find(
    (t) =>
      t.connectionId === connectionId &&
      t.type === 'table' &&
      t.activeTable === tableName
  );
}

export function getConnectionTabs(tabs: Tab[], connectionId: string | null): Tab[] {
  if (!connectionId) return [];
  return tabs.filter((t) => t.connectionId === connectionId);
}

export function getActiveTab(
  tabs: Tab[],
  connectionId: string | null,
  activeTabId: string | null
): Tab | null {
  if (!connectionId || !activeTabId) return null;
  const tab = tabs.find((t) => t.id === activeTabId);
  return tab && tab.connectionId === connectionId ? tab : null;
}

export interface CloseTabResult {
  newTabs: Tab[];
  newActiveTabId: string | null;
  createdNewTab: boolean;
}

export function closeTabWithState(
  tabs: Tab[],
  connectionId: string,
  activeTabId: string | null,
  tabIdToClose: string,
  createTabFn: (connectionId: string) => Tab
): CloseTabResult {
  const tabToClose = tabs.find((t) => t.id === tabIdToClose);
  const newTabs = tabs.filter((t) => t.id !== tabIdToClose);
  const connTabs = newTabs.filter((t) => t.connectionId === connectionId);

  // If no tabs left for this connection, create a new console tab
  if (connTabs.length === 0 && tabToClose?.connectionId === connectionId) {
    const newTab = createTabFn(connectionId);
    return {
      newTabs: [...newTabs, newTab],
      newActiveTabId: newTab.id,
      createdNewTab: true,
    };
  }

  // If closing the active tab, find next active tab (prefer previous tab)
  let newActiveTabIdResult = activeTabId;
  if (activeTabId === tabIdToClose) {
    // Find index in the original connection tabs list
    const originalConnTabs = tabs.filter((t) => t.connectionId === connectionId);
    const closedIdx = originalConnTabs.findIndex((t) => t.id === tabIdToClose);
    // Prefer the previous tab, otherwise the first available
    const nextActiveIdx = Math.max(0, closedIdx - 1);
    const nextActiveTab = connTabs[nextActiveIdx];
    newActiveTabIdResult = nextActiveTab?.id || null;
  }

  return {
    newTabs,
    newActiveTabId: newActiveTabIdResult,
    createdNewTab: false,
  };
}

export function closeAllTabsForConnection(
  tabs: Tab[],
  connectionId: string,
  createTabFn: (connectionId: string) => Tab
): { newTabs: Tab[]; newActiveTabId: string } {
  const otherConnTabs = tabs.filter((t) => t.connectionId !== connectionId);
  const newTab = createTabFn(connectionId);
  return {
    newTabs: [...otherConnTabs, newTab],
    newActiveTabId: newTab.id,
  };
}

export function closeOtherTabsForConnection(
  tabs: Tab[],
  connectionId: string,
  keepTabId: string
): Tab[] {
  return tabs.filter((t) => t.connectionId !== connectionId || t.id === keepTabId);
}

export function closeTabsToLeft(
  tabs: Tab[],
  connectionId: string,
  targetTabId: string,
  activeTabId: string | null
): { newTabs: Tab[]; newActiveTabId: string | null } {
  const connTabs = tabs.filter((t) => t.connectionId === connectionId);
  const targetIndex = connTabs.findIndex((t) => t.id === targetTabId);
  
  if (targetIndex === -1) {
    return { newTabs: tabs, newActiveTabId: activeTabId };
  }

  const tabsToClose = connTabs.slice(0, targetIndex).map((t) => t.id);
  const otherConnTabs = tabs.filter((t) => t.connectionId !== connectionId);
  const remainingConnTabs = connTabs.slice(targetIndex);

  const activeTabWasClosed = activeTabId ? tabsToClose.includes(activeTabId) : false;
  const newActiveTabId = activeTabWasClosed ? targetTabId : activeTabId;

  return {
    newTabs: [...otherConnTabs, ...remainingConnTabs],
    newActiveTabId,
  };
}

export function closeTabsToRight(
  tabs: Tab[],
  connectionId: string,
  targetTabId: string,
  activeTabId: string | null
): { newTabs: Tab[]; newActiveTabId: string | null } {
  const connTabs = tabs.filter((t) => t.connectionId === connectionId);
  const targetIndex = connTabs.findIndex((t) => t.id === targetTabId);
  
  if (targetIndex === -1) {
    return { newTabs: tabs, newActiveTabId: activeTabId };
  }

  const tabsToClose = connTabs.slice(targetIndex + 1).map((t) => t.id);
  const otherConnTabs = tabs.filter((t) => t.connectionId !== connectionId);
  const remainingConnTabs = connTabs.slice(0, targetIndex + 1);

  const activeTabWasClosed = activeTabId ? tabsToClose.includes(activeTabId) : false;
  const newActiveTabId = activeTabWasClosed ? targetTabId : activeTabId;

  return {
    newTabs: [...otherConnTabs, ...remainingConnTabs],
    newActiveTabId,
  };
}

export function updateTabInList(
  tabs: Tab[],
  tabId: string,
  partial: Partial<Tab>
): Tab[] {
  return tabs.map((t) => (t.id === tabId ? { ...t, ...partial } : t));
}

// Schema cache utilities
export function shouldUseCachedSchema(
  cached: SchemaCache | undefined,
  schemaVersion?: number
): boolean {
  if (!cached) return false;
  
  // If schemaVersion is provided, check if it matches
  if (schemaVersion !== undefined && cached.version !== schemaVersion) {
    return false;
  }
  
  // Check if cache is less than 5 minutes old (300000 ms)
  const isFresh = Date.now() - cached.timestamp < 300000;
  return isFresh;
}

export function createSchemaCacheEntry(
  data: TableSchema[],
  version: number
): SchemaCache {
  return {
    data,
    version,
    timestamp: Date.now(),
  };
}

/**
 * Reconstruct a SELECT query for a table tab with filters, sort, and limit
 * @param tab - Tab containing table state
 * @param driver - Database driver for proper identifier quoting
 * @returns Reconstructed SQL query
 */
export function reconstructTableQuery(tab: Tab, driver?: string): string {
  if (!tab.activeTable) {
    return tab.query;
  }

  const filter = tab.filterClause ? `WHERE ${tab.filterClause}` : "";
  const sort = tab.sortClause ? `ORDER BY ${tab.sortClause}` : "";
  const quotedTable = quoteIdentifier(tab.activeTable, driver);

  let baseQuery = `SELECT * FROM ${quotedTable} ${filter} ${sort}`.trim();

  if (tab.limitClause && tab.limitClause > 0) {
    baseQuery = `${baseQuery} LIMIT ${tab.limitClause}`;
  }

  return baseQuery.replace(/\s+/g, ' ').trim();
}

/**
 * Format an export filename with timestamp and extension
 * @param tableName - Name of the table being exported
 * @param format - Export format (csv, json, etc.)
 * @returns Formatted filename
 */
export function formatExportFileName(tableName: string, format: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeName = tableName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safeName}_${timestamp}.${format}`;
}

/**
 * Validate a page number input
 * @param pageInput - Page number as string
 * @param totalPages - Total number of pages available
 * @returns True if page number is valid
 */
export function validatePageNumber(pageInput: string, totalPages: number): boolean {
  const num = parseInt(pageInput, 10);
  return !isNaN(num) && num >= 1 && num <= totalPages;
}

/**
 * Calculate total pages based on total rows and page size
 * @param totalRows - Total number of rows
 * @param pageSize - Number of rows per page
 * @returns Total number of pages
 */
export function calculateTotalPages(totalRows: number | null, pageSize: number): number {
  if (totalRows === null || totalRows === 0) return 1;
  return Math.ceil(totalRows / pageSize);
}
