import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { canActivateSplit } from '../utils/connectionLayout';
import type { SplitView } from '../utils/connectionLayout';

export interface ConnectionLayoutState {
  selectedConnectionIds: Set<string>;
  splitView: SplitView | null;
  explorerConnectionId: string | null;
  toggleSelection: (id: string, isCtrlHeld: boolean) => void;
  activateSplit: (mode: 'vertical' | 'horizontal') => void;
  deactivateSplit: () => void;
  clearSelection: () => void;
  setExplorerConnectionId: (id: string | null) => void;
}

export function useConnectionLayout(): ConnectionLayoutState {
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<Set<string>>(new Set());
  const [splitView, setSplitView] = useState<SplitView | null>(null);
  const [explorerConnectionId, setExplorerConnectionId] = useState<string | null>(null);
  const navigate = useNavigate();

  const toggleSelection = useCallback((id: string, isCtrlHeld: boolean) => {
    if (!isCtrlHeld) {
      setSelectedConnectionIds(new Set());
      return;
    }
    setSelectedConnectionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const activateSplit = useCallback((mode: 'vertical' | 'horizontal') => {
    if (!canActivateSplit(selectedConnectionIds)) return;
    const connectionIds = Array.from(selectedConnectionIds);
    setSplitView({ connectionIds, mode });
    setExplorerConnectionId(connectionIds[0]);
    setSelectedConnectionIds(new Set());
    navigate('/editor');
  }, [selectedConnectionIds, navigate]);

  const deactivateSplit = useCallback(() => {
    setSplitView(null);
    setExplorerConnectionId(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedConnectionIds(new Set());
  }, []);

  return {
    selectedConnectionIds,
    splitView,
    explorerConnectionId,
    toggleSelection,
    activateSplit,
    deactivateSplit,
    clearSelection,
    setExplorerConnectionId,
  };
}
