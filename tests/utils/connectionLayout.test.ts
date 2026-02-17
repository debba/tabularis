import { describe, it, expect } from 'vitest';
import {
  isConnectionGrouped,
  buildSplitContainerClass,
  buildPanelDatabaseData,
  canActivateSplit,
  type SplitView,
} from '../../src/utils/connectionLayout';
import type { ConnectionData } from '../../src/contexts/DatabaseContext';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makeSplitView = (overrides?: Partial<SplitView>): SplitView => ({
  connectionIds: ['conn-a', 'conn-b'],
  mode: 'vertical',
  ...overrides,
});

const makeConnectionData = (overrides?: Partial<ConnectionData>): ConnectionData => ({
  driver: 'postgres',
  connectionName: 'Test DB',
  databaseName: 'mydb',
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
  isConnected: true,
  ...overrides,
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('connectionLayout', () => {
  describe('isConnectionGrouped', () => {
    it('returns false when splitView is null', () => {
      expect(isConnectionGrouped('conn-a', null)).toBe(false);
    });

    it('returns true when connectionId is in the split view', () => {
      const splitView = makeSplitView({ connectionIds: ['conn-a', 'conn-b'] });
      expect(isConnectionGrouped('conn-a', splitView)).toBe(true);
      expect(isConnectionGrouped('conn-b', splitView)).toBe(true);
    });

    it('returns false when connectionId is not in the split view', () => {
      const splitView = makeSplitView({ connectionIds: ['conn-a', 'conn-b'] });
      expect(isConnectionGrouped('conn-c', splitView)).toBe(false);
    });

    it('returns false for empty connectionIds array', () => {
      const splitView = makeSplitView({ connectionIds: [] });
      expect(isConnectionGrouped('conn-a', splitView)).toBe(false);
    });
  });

  describe('buildSplitContainerClass', () => {
    it('returns flex-row class for vertical mode', () => {
      const result = buildSplitContainerClass('vertical');
      expect(result).toContain('flex-row');
      expect(result).toContain('flex');
      expect(result).toContain('h-full');
      expect(result).toContain('w-full');
    });

    it('returns flex-col class for horizontal mode', () => {
      const result = buildSplitContainerClass('horizontal');
      expect(result).toContain('flex-col');
      expect(result).toContain('flex');
      expect(result).toContain('h-full');
      expect(result).toContain('w-full');
    });

    it('vertical and horizontal return different classes', () => {
      expect(buildSplitContainerClass('vertical')).not.toBe(
        buildSplitContainerClass('horizontal'),
      );
    });
  });

  describe('buildPanelDatabaseData', () => {
    it('returns connection data for a known connectionId', () => {
      const data = makeConnectionData({ driver: 'mysql' });
      const map = { 'conn-a': data };
      expect(buildPanelDatabaseData('conn-a', map)).toBe(data);
    });

    it('returns undefined for unknown connectionId', () => {
      const map = { 'conn-a': makeConnectionData() };
      expect(buildPanelDatabaseData('conn-unknown', map)).toBeUndefined();
    });

    it('returns undefined for empty map', () => {
      expect(buildPanelDatabaseData('conn-a', {})).toBeUndefined();
    });

    it('returns correct entry from multi-entry map', () => {
      const dataA = makeConnectionData({ driver: 'postgres' });
      const dataB = makeConnectionData({ driver: 'mysql' });
      const map = { 'conn-a': dataA, 'conn-b': dataB };
      expect(buildPanelDatabaseData('conn-b', map)).toBe(dataB);
    });
  });

  describe('canActivateSplit', () => {
    it('returns false for empty set', () => {
      expect(canActivateSplit(new Set())).toBe(false);
    });

    it('returns false for single connection', () => {
      expect(canActivateSplit(new Set(['conn-a']))).toBe(false);
    });

    it('returns true for exactly 2 connections', () => {
      expect(canActivateSplit(new Set(['conn-a', 'conn-b']))).toBe(true);
    });

    it('returns true for 3 or more connections', () => {
      expect(canActivateSplit(new Set(['conn-a', 'conn-b', 'conn-c']))).toBe(true);
    });
  });
});
