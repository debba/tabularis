import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useConnectionLayout } from '../hooks/useConnectionLayout';
import type { ConnectionLayoutState } from '../hooks/useConnectionLayout';

export type { ConnectionLayoutState };

const ConnectionLayoutContext = createContext<ConnectionLayoutState | undefined>(undefined);

export const ConnectionLayoutProvider = ({ children }: { children: ReactNode }) => {
  const layout = useConnectionLayout();
  return (
    <ConnectionLayoutContext.Provider value={layout}>
      {children}
    </ConnectionLayoutContext.Provider>
  );
};

export const useConnectionLayoutContext = (): ConnectionLayoutState => {
  const ctx = useContext(ConnectionLayoutContext);
  if (!ctx) {
    throw new Error('useConnectionLayoutContext must be used within ConnectionLayoutProvider');
  }
  return ctx;
};
