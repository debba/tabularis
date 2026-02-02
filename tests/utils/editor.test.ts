import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Tab, TableSchema, SchemaCache } from '../../src/types/editor';
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
  STORAGE_KEY,
} from '../../src/utils/editor';

describe('editor', () => {
  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateTabId', () => {
    it('should generate a string of 7 characters', () => {
      const id = generateTabId();
      expect(id).toHaveLength(7);
      expect(typeof id).toBe('string');
    });

    it('should generate unique ids', () => {
      const id1 = generateTabId();
      const id2 = generateTabId();
      expect(id1).not.toBe(id2);
    });

    it('should only contain alphanumeric characters', () => {
      const id = generateTabId();
      expect(id).toMatch(/^[a-z0-9]+$/);
    });
  });

  describe('loadTabsFromStorage', () => {
    it('should return null when no data in localStorage', () => {
      localStorageMock.getItem.mockReturnValue(null);
      const result = loadTabsFromStorage();
      expect(result).toBeNull();
      expect(localStorageMock.getItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it('should return parsed data from localStorage', () => {
      const mockData = {
        tabs: [{ id: 'tab-1', title: 'Test Tab' } as Tab],
        activeTabIds: { 'conn-1': 'tab-1' },
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockData));
      
      const result = loadTabsFromStorage();
      
      expect(result).toEqual(mockData);
    });

    it('should return null when JSON parsing fails', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = loadTabsFromStorage();
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load tabs from storage',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it('should handle missing tabs or activeTabIds', () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify({}));
      
      const result = loadTabsFromStorage();
      
      expect(result).toEqual({
        tabs: [],
        activeTabIds: {},
      });
    });
  });

  describe('saveTabsToStorage', () => {
    it('should save data to localStorage', () => {
      const tabs = [{ id: 'tab-1', title: 'Test Tab' } as Tab];
      const activeTabIds = { 'conn-1': 'tab-1' };
      
      saveTabsToStorage(tabs, activeTabIds);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify({ tabs, activeTabIds })
      );
    });
  });

  describe('createInitialTabState', () => {
    it('should create a console tab with default values', () => {
      const tab = createInitialTabState('conn-1');
      
      expect(tab).toMatchObject({
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
        connectionId: 'conn-1',
        isEditorOpen: true,
      });
      expect(tab.id).toHaveLength(7);
    });

    it('should use partial values when provided', () => {
      const partial = {
        title: 'Custom Tab',
        type: 'table' as const,
        query: 'SELECT * FROM users',
        activeTable: 'users',
      };
      
      const tab = createInitialTabState('conn-1', partial);
      
      expect(tab.title).toBe('Custom Tab');
      expect(tab.type).toBe('table');
      expect(tab.query).toBe('SELECT * FROM users');
      expect(tab.activeTable).toBe('users');
      expect(tab.isEditorOpen).toBe(false);
    });

    it('should handle null connectionId', () => {
      const tab = createInitialTabState(null);
      
      expect(tab.connectionId).toBe('');
    });

    it('should allow overriding isEditorOpen', () => {
      const tab = createInitialTabState('conn-1', {
        type: 'table',
        isEditorOpen: true,
      });
      
      expect(tab.isEditorOpen).toBe(true);
    });
  });

  describe('generateTabTitle', () => {
    const createMockTab = (overrides: Partial<Tab> = {}): Tab => ({
      id: 'tab-1',
      title: 'Test',
      type: 'console',
      query: '',
      result: null,
      error: '',
      executionTime: null,
      page: 1,
      activeTable: null,
      pkColumn: null,
      connectionId: 'conn-1',
      ...overrides,
    });

    it('should return provided title', () => {
      const tabs: Tab[] = [];
      const title = generateTabTitle(tabs, 'conn-1', { title: 'Custom Title' });
      expect(title).toBe('Custom Title');
    });

    it('should return table name for table tabs', () => {
      const tabs: Tab[] = [];
      const title = generateTabTitle(tabs, 'conn-1', {
        type: 'table',
        activeTable: 'users',
      });
      expect(title).toBe('users');
    });

    it('should generate "Console" for first console tab', () => {
      const tabs: Tab[] = [];
      const title = generateTabTitle(tabs, 'conn-1', { type: 'console' });
      expect(title).toBe('Console');
    });

    it('should generate "Console N" for additional console tabs', () => {
      const tabs: Tab[] = [
        createMockTab({ type: 'console', connectionId: 'conn-1' }),
        createMockTab({ type: 'console', connectionId: 'conn-1' }),
      ];
      const title = generateTabTitle(tabs, 'conn-1', { type: 'console' });
      expect(title).toBe('Console 3');
    });

    it('should generate "Visual Query" for first query builder tab', () => {
      const tabs: Tab[] = [];
      const title = generateTabTitle(tabs, 'conn-1', { type: 'query_builder' });
      expect(title).toBe('Visual Query');
    });

    it('should generate "Visual Query N" for additional query builder tabs', () => {
      const tabs: Tab[] = [
        createMockTab({ type: 'query_builder', connectionId: 'conn-1' }),
      ];
      const title = generateTabTitle(tabs, 'conn-1', { type: 'query_builder' });
      expect(title).toBe('Visual Query 2');
    });

    it('should only count tabs for the specified connection', () => {
      const tabs: Tab[] = [
        createMockTab({ type: 'console', connectionId: 'conn-1' }),
        createMockTab({ type: 'console', connectionId: 'conn-2' }),
      ];
      const title = generateTabTitle(tabs, 'conn-1', { type: 'console' });
      expect(title).toBe('Console 2');
    });
  });

  describe('findExistingTableTab', () => {
    const createMockTab = (overrides: Partial<Tab> = {}): Tab => ({
      id: 'tab-1',
      title: 'Test',
      type: 'console',
      query: '',
      result: null,
      error: '',
      executionTime: null,
      page: 1,
      activeTable: null,
      pkColumn: null,
      connectionId: 'conn-1',
      ...overrides,
    });

    it('should find existing table tab', () => {
      const tabs: Tab[] = [
        createMockTab({
          id: 'tab-1',
          type: 'table',
          connectionId: 'conn-1',
          activeTable: 'users',
        }),
      ];
      
      const result = findExistingTableTab(tabs, 'conn-1', 'users');
      
      expect(result).toBeDefined();
      expect(result?.id).toBe('tab-1');
    });

    it('should return undefined when no matching tab exists', () => {
      const tabs: Tab[] = [
        createMockTab({
          type: 'table',
          connectionId: 'conn-1',
          activeTable: 'posts',
        }),
      ];
      
      const result = findExistingTableTab(tabs, 'conn-1', 'users');
      
      expect(result).toBeUndefined();
    });

    it('should return undefined when tableName is undefined', () => {
      const tabs: Tab[] = [
        createMockTab({
          type: 'table',
          connectionId: 'conn-1',
          activeTable: 'users',
        }),
      ];
      
      const result = findExistingTableTab(tabs, 'conn-1', undefined);
      
      expect(result).toBeUndefined();
    });

    it('should not match tabs from different connections', () => {
      const tabs: Tab[] = [
        createMockTab({
          type: 'table',
          connectionId: 'conn-2',
          activeTable: 'users',
        }),
      ];
      
      const result = findExistingTableTab(tabs, 'conn-1', 'users');
      
      expect(result).toBeUndefined();
    });
  });

  describe('getConnectionTabs', () => {
    const createMockTab = (overrides: Partial<Tab> = {}): Tab => ({
      id: 'tab-1',
      title: 'Test',
      type: 'console',
      query: '',
      result: null,
      error: '',
      executionTime: null,
      page: 1,
      activeTable: null,
      pkColumn: null,
      connectionId: 'conn-1',
      ...overrides,
    });

    it('should return tabs for specific connection', () => {
      const tabs: Tab[] = [
        createMockTab({ id: 'tab-1', connectionId: 'conn-1' }),
        createMockTab({ id: 'tab-2', connectionId: 'conn-1' }),
        createMockTab({ id: 'tab-3', connectionId: 'conn-2' }),
      ];
      
      const result = getConnectionTabs(tabs, 'conn-1');
      
      expect(result).toHaveLength(2);
      expect(result.map((t) => t.id)).toEqual(['tab-1', 'tab-2']);
    });

    it('should return empty array when connectionId is null', () => {
      const tabs: Tab[] = [createMockTab()];
      
      const result = getConnectionTabs(tabs, null);
      
      expect(result).toEqual([]);
    });

    it('should return empty array when no tabs match', () => {
      const tabs: Tab[] = [createMockTab({ connectionId: 'conn-2' })];
      
      const result = getConnectionTabs(tabs, 'conn-1');
      
      expect(result).toEqual([]);
    });
  });

  describe('getActiveTab', () => {
    const createMockTab = (overrides: Partial<Tab> = {}): Tab => ({
      id: 'tab-1',
      title: 'Test',
      type: 'console',
      query: '',
      result: null,
      error: '',
      executionTime: null,
      page: 1,
      activeTable: null,
      pkColumn: null,
      connectionId: 'conn-1',
      ...overrides,
    });

    it('should return active tab', () => {
      const tabs: Tab[] = [
        createMockTab({ id: 'tab-1' }),
        createMockTab({ id: 'tab-2' }),
      ];
      
      const result = getActiveTab(tabs, 'conn-1', 'tab-1');
      
      expect(result?.id).toBe('tab-1');
    });

    it('should return null when connectionId is null', () => {
      const tabs: Tab[] = [createMockTab()];
      
      const result = getActiveTab(tabs, null, 'tab-1');
      
      expect(result).toBeNull();
    });

    it('should return null when activeTabId is null', () => {
      const tabs: Tab[] = [createMockTab()];
      
      const result = getActiveTab(tabs, 'conn-1', null);
      
      expect(result).toBeNull();
    });

    it('should return null when tab belongs to different connection', () => {
      const tabs: Tab[] = [createMockTab({ id: 'tab-1', connectionId: 'conn-2' })];
      
      const result = getActiveTab(tabs, 'conn-1', 'tab-1');
      
      expect(result).toBeNull();
    });

    it('should return null when tab does not exist', () => {
      const tabs: Tab[] = [createMockTab({ id: 'tab-1' })];
      
      const result = getActiveTab(tabs, 'conn-1', 'non-existent');
      
      expect(result).toBeNull();
    });
  });

  describe('closeTabWithState', () => {
    const createMockTab = (overrides: Partial<Tab> = {}): Tab => ({
      id: 'tab-1',
      title: 'Test',
      type: 'console',
      query: '',
      result: null,
      error: '',
      executionTime: null,
      page: 1,
      activeTable: null,
      pkColumn: null,
      connectionId: 'conn-1',
      ...overrides,
    });

    const createTabFn = (connectionId: string): Tab => ({
      id: 'new-tab',
      title: 'New Console',
      type: 'console',
      query: '',
      result: null,
      error: '',
      executionTime: null,
      page: 1,
      activeTable: null,
      pkColumn: null,
      connectionId,
      isEditorOpen: true,
    });

    it('should close tab and update state', () => {
      const tabs: Tab[] = [
        createMockTab({ id: 'tab-1' }),
        createMockTab({ id: 'tab-2' }),
      ];
      
      const result = closeTabWithState(tabs, 'conn-1', 'tab-1', 'tab-2', createTabFn);
      
      expect(result.newTabs).toHaveLength(1);
      expect(result.newTabs[0].id).toBe('tab-1');
      expect(result.newActiveTabId).toBe('tab-1');
      expect(result.createdNewTab).toBe(false);
    });

    it('should create new tab when closing last tab for connection', () => {
      const tabs: Tab[] = [createMockTab({ id: 'tab-1' })];
      
      const result = closeTabWithState(tabs, 'conn-1', 'tab-1', 'tab-1', createTabFn);
      
      expect(result.newTabs).toHaveLength(1);
      expect(result.newTabs[0].id).toBe('new-tab');
      expect(result.newActiveTabId).toBe('new-tab');
      expect(result.createdNewTab).toBe(true);
    });

    it('should handle closing active tab', () => {
      const tabs: Tab[] = [
        createMockTab({ id: 'tab-1' }),
        createMockTab({ id: 'tab-2' }),
        createMockTab({ id: 'tab-3' }),
      ];
      
      const result = closeTabWithState(tabs, 'conn-1', 'tab-2', 'tab-2', createTabFn);
      
      expect(result.newTabs).toHaveLength(2);
      // When closing active tab at index 1, should select previous tab (tab-1)
      expect(result.newActiveTabId).toBe('tab-1');
    });

    it('should select first tab when closing the first tab', () => {
      const tabs: Tab[] = [
        createMockTab({ id: 'tab-1' }),
        createMockTab({ id: 'tab-2' }),
        createMockTab({ id: 'tab-3' }),
      ];
      
      const result = closeTabWithState(tabs, 'conn-1', 'tab-1', 'tab-1', createTabFn);
      
      expect(result.newTabs).toHaveLength(2);
      // When closing first tab, should select the new first tab (tab-2)
      expect(result.newActiveTabId).toBe('tab-2');
    });

    it('should keep other connection tabs when creating new tab', () => {
      const tabs: Tab[] = [
        createMockTab({ id: 'tab-1', connectionId: 'conn-1' }),
        createMockTab({ id: 'tab-2', connectionId: 'conn-2' }),
      ];
      
      const result = closeTabWithState(tabs, 'conn-1', 'tab-1', 'tab-1', createTabFn);
      
      expect(result.newTabs).toHaveLength(2);
      expect(result.newTabs.map((t) => t.id)).toContain('tab-2');
      expect(result.newTabs.map((t) => t.id)).toContain('new-tab');
    });
  });

  describe('closeAllTabsForConnection', () => {
    const createMockTab = (overrides: Partial<Tab> = {}): Tab => ({
      id: 'tab-1',
      title: 'Test',
      type: 'console',
      query: '',
      result: null,
      error: '',
      executionTime: null,
      page: 1,
      activeTable: null,
      pkColumn: null,
      connectionId: 'conn-1',
      ...overrides,
    });

    const createTabFn = (connectionId: string): Tab => ({
      id: 'fresh-tab',
      title: 'Fresh Console',
      type: 'console',
      query: '',
      result: null,
      error: '',
      executionTime: null,
      page: 1,
      activeTable: null,
      pkColumn: null,
      connectionId,
      isEditorOpen: true,
    });

    it('should close all tabs for connection and create fresh tab', () => {
      const tabs: Tab[] = [
        createMockTab({ id: 'tab-1', connectionId: 'conn-1' }),
        createMockTab({ id: 'tab-2', connectionId: 'conn-1' }),
        createMockTab({ id: 'tab-3', connectionId: 'conn-2' }),
      ];
      
      const result = closeAllTabsForConnection(tabs, 'conn-1', createTabFn);
      
      expect(result.newTabs).toHaveLength(2);
      expect(result.newTabs.map((t) => t.id)).toEqual(['tab-3', 'fresh-tab']);
      expect(result.newActiveTabId).toBe('fresh-tab');
    });

    it('should work with empty tabs array', () => {
      const tabs: Tab[] = [];
      
      const result = closeAllTabsForConnection(tabs, 'conn-1', createTabFn);
      
      expect(result.newTabs).toHaveLength(1);
      expect(result.newTabs[0].id).toBe('fresh-tab');
    });
  });

  describe('closeOtherTabsForConnection', () => {
    const createMockTab = (overrides: Partial<Tab> = {}): Tab => ({
      id: 'tab-1',
      title: 'Test',
      type: 'console',
      query: '',
      result: null,
      error: '',
      executionTime: null,
      page: 1,
      activeTable: null,
      pkColumn: null,
      connectionId: 'conn-1',
      ...overrides,
    });

    it('should keep only specified tab for connection', () => {
      const tabs: Tab[] = [
        createMockTab({ id: 'tab-1', connectionId: 'conn-1' }),
        createMockTab({ id: 'tab-2', connectionId: 'conn-1' }),
        createMockTab({ id: 'tab-3', connectionId: 'conn-1' }),
        createMockTab({ id: 'tab-4', connectionId: 'conn-2' }),
      ];
      
      const result = closeOtherTabsForConnection(tabs, 'conn-1', 'tab-2');
      
      expect(result).toHaveLength(2);
      expect(result.map((t) => t.id)).toEqual(['tab-2', 'tab-4']);
    });
  });

  describe('closeTabsToLeft', () => {
    const createMockTab = (overrides: Partial<Tab> = {}): Tab => ({
      id: 'tab-1',
      title: 'Test',
      type: 'console',
      query: '',
      result: null,
      error: '',
      executionTime: null,
      page: 1,
      activeTable: null,
      pkColumn: null,
      connectionId: 'conn-1',
      ...overrides,
    });

    it('should close tabs to the left of target', () => {
      const tabs: Tab[] = [
        createMockTab({ id: 'tab-1', connectionId: 'conn-1' }),
        createMockTab({ id: 'tab-2', connectionId: 'conn-1' }),
        createMockTab({ id: 'tab-3', connectionId: 'conn-1' }),
      ];
      
      const result = closeTabsToLeft(tabs, 'conn-1', 'tab-2', 'tab-3');
      
      expect(result.newTabs).toHaveLength(2);
      expect(result.newTabs.map((t) => t.id)).toEqual(['tab-2', 'tab-3']);
      expect(result.newActiveTabId).toBe('tab-3');
    });

    it('should update active tab if it was closed', () => {
      const tabs: Tab[] = [
        createMockTab({ id: 'tab-1', connectionId: 'conn-1' }),
        createMockTab({ id: 'tab-2', connectionId: 'conn-1' }),
        createMockTab({ id: 'tab-3', connectionId: 'conn-1' }),
      ];
      
      const result = closeTabsToLeft(tabs, 'conn-1', 'tab-2', 'tab-1');
      
      expect(result.newActiveTabId).toBe('tab-2');
    });

    it('should keep tabs from other connections', () => {
      const tabs: Tab[] = [
        createMockTab({ id: 'tab-1', connectionId: 'conn-1' }),
        createMockTab({ id: 'tab-2', connectionId: 'conn-2' }),
        createMockTab({ id: 'tab-3', connectionId: 'conn-1' }),
      ];
      
      const result = closeTabsToLeft(tabs, 'conn-1', 'tab-3', 'tab-1');
      
      expect(result.newTabs).toHaveLength(2);
      expect(result.newTabs.map((t) => t.id)).toEqual(['tab-2', 'tab-3']);
    });

    it('should return original tabs when target not found', () => {
      const tabs: Tab[] = [
        createMockTab({ id: 'tab-1', connectionId: 'conn-1' }),
      ];
      
      const result = closeTabsToLeft(tabs, 'conn-1', 'non-existent', 'tab-1');
      
      expect(result.newTabs).toEqual(tabs);
      expect(result.newActiveTabId).toBe('tab-1');
    });
  });

  describe('closeTabsToRight', () => {
    const createMockTab = (overrides: Partial<Tab> = {}): Tab => ({
      id: 'tab-1',
      title: 'Test',
      type: 'console',
      query: '',
      result: null,
      error: '',
      executionTime: null,
      page: 1,
      activeTable: null,
      pkColumn: null,
      connectionId: 'conn-1',
      ...overrides,
    });

    it('should close tabs to the right of target', () => {
      const tabs: Tab[] = [
        createMockTab({ id: 'tab-1', connectionId: 'conn-1' }),
        createMockTab({ id: 'tab-2', connectionId: 'conn-1' }),
        createMockTab({ id: 'tab-3', connectionId: 'conn-1' }),
      ];
      
      const result = closeTabsToRight(tabs, 'conn-1', 'tab-2', 'tab-1');
      
      expect(result.newTabs).toHaveLength(2);
      expect(result.newTabs.map((t) => t.id)).toEqual(['tab-1', 'tab-2']);
      expect(result.newActiveTabId).toBe('tab-1');
    });

    it('should update active tab if it was closed', () => {
      const tabs: Tab[] = [
        createMockTab({ id: 'tab-1', connectionId: 'conn-1' }),
        createMockTab({ id: 'tab-2', connectionId: 'conn-1' }),
        createMockTab({ id: 'tab-3', connectionId: 'conn-1' }),
      ];
      
      const result = closeTabsToRight(tabs, 'conn-1', 'tab-2', 'tab-3');
      
      expect(result.newActiveTabId).toBe('tab-2');
    });

    it('should return original tabs when target not found', () => {
      const tabs: Tab[] = [
        createMockTab({ id: 'tab-1', connectionId: 'conn-1' }),
      ];
      
      const result = closeTabsToRight(tabs, 'conn-1', 'non-existent', 'tab-1');
      
      expect(result.newTabs).toEqual(tabs);
      expect(result.newActiveTabId).toBe('tab-1');
    });
  });

  describe('updateTabInList', () => {
    const createMockTab = (overrides: Partial<Tab> = {}): Tab => ({
      id: 'tab-1',
      title: 'Test',
      type: 'console',
      query: '',
      result: null,
      error: '',
      executionTime: null,
      page: 1,
      activeTable: null,
      pkColumn: null,
      connectionId: 'conn-1',
      ...overrides,
    });

    it('should update tab properties', () => {
      const tabs: Tab[] = [
        createMockTab({ id: 'tab-1', title: 'Old Title' }),
        createMockTab({ id: 'tab-2', title: 'Other' }),
      ];
      
      const result = updateTabInList(tabs, 'tab-1', { title: 'New Title' });
      
      expect(result[0].title).toBe('New Title');
      expect(result[1].title).toBe('Other');
    });

    it('should not modify other tabs', () => {
      const tabs: Tab[] = [
        createMockTab({ id: 'tab-1' }),
        createMockTab({ id: 'tab-2' }),
      ];
      
      const result = updateTabInList(tabs, 'tab-1', { query: 'SELECT *' });
      
      expect(result[1]).toEqual(tabs[1]);
    });

    it('should return new array without mutating original', () => {
      const tabs: Tab[] = [createMockTab({ id: 'tab-1' })];
      
      const result = updateTabInList(tabs, 'tab-1', { title: 'New' });
      
      expect(result).not.toBe(tabs);
      expect(tabs[0].title).toBe('Test');
    });
  });

  describe('shouldUseCachedSchema', () => {
    const createMockSchemaCache = (overrides: Partial<SchemaCache> = {}): SchemaCache => ({
      data: [],
      version: 1,
      timestamp: Date.now(),
      ...overrides,
    });

    it('should return false when no cache exists', () => {
      const result = shouldUseCachedSchema(undefined);
      expect(result).toBe(false);
    });

    it('should return true for fresh cache without version check', () => {
      const cache = createMockSchemaCache({ timestamp: Date.now() - 1000 });
      const result = shouldUseCachedSchema(cache);
      expect(result).toBe(true);
    });

    it('should return false for stale cache (older than 5 minutes)', () => {
      const cache = createMockSchemaCache({ timestamp: Date.now() - 301000 });
      const result = shouldUseCachedSchema(cache);
      expect(result).toBe(false);
    });

    it('should check version when provided', () => {
      const cache = createMockSchemaCache({ version: 1, timestamp: Date.now() });
      const result = shouldUseCachedSchema(cache, 2);
      expect(result).toBe(false);
    });

    it('should return true when version matches', () => {
      const cache = createMockSchemaCache({ version: 2, timestamp: Date.now() });
      const result = shouldUseCachedSchema(cache, 2);
      expect(result).toBe(true);
    });

    it('should return true for fresh cache with undefined version', () => {
      const cache = createMockSchemaCache({ timestamp: Date.now() });
      const result = shouldUseCachedSchema(cache, undefined);
      expect(result).toBe(true);
    });
  });

  describe('createSchemaCacheEntry', () => {
    it('should create cache entry with current timestamp', () => {
      const data: TableSchema[] = [
        { name: 'users', columns: [], foreign_keys: [] },
      ];
      const version = 5;
      
      const before = Date.now();
      const result = createSchemaCacheEntry(data, version);
      const after = Date.now();
      
      expect(result.data).toBe(data);
      expect(result.version).toBe(version);
      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(after);
    });
  });
});
