import type { ConnectionData } from '../contexts/DatabaseContext';

export interface SplitView {
  connectionIds: string[];
  mode: 'vertical' | 'horizontal';
}

/** Returns true if the connection belongs to the active split view */
export function isConnectionGrouped(connectionId: string, splitView: SplitView | null): boolean {
  if (!splitView) return false;
  return splitView.connectionIds.includes(connectionId);
}

/** Returns the flex container class for the given split mode */
export function buildSplitContainerClass(mode: 'vertical' | 'horizontal'): string {
  return mode === 'vertical'
    ? 'flex flex-row h-full w-full'
    : 'flex flex-col h-full w-full';
}

/** Returns the connection data for a specific connectionId from the map */
export function buildPanelDatabaseData(
  connectionId: string,
  connectionDataMap: Record<string, ConnectionData>,
): ConnectionData | undefined {
  return connectionDataMap[connectionId];
}

/** Returns true if at least 2 connections are selected */
export function canActivateSplit(selectedIds: Set<string>): boolean {
  return selectedIds.size >= 2;
}
