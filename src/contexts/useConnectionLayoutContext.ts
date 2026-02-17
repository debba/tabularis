import { useContext } from 'react';
import { ConnectionLayoutContext } from './ConnectionLayoutContext';
import type { ConnectionLayoutState } from '../hooks/useConnectionLayout';

export const useConnectionLayoutContext = (): ConnectionLayoutState => {
  const ctx = useContext(ConnectionLayoutContext);
  if (!ctx) {
    throw new Error('useConnectionLayoutContext must be used within ConnectionLayoutProvider');
  }
  return ctx;
};
