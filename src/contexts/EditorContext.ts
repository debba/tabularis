import { createContext } from 'react';
import type { Tab } from '../types/editor';

export interface EditorContextType {
  tabs: Tab[];
  activeTabId: string | null;
  activeTab: Tab | null;
  addTab: (tab?: Partial<Tab>) => string;
  closeTab: (id: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (id: string) => void;
  closeTabsToLeft: (id: string) => void;
  closeTabsToRight: (id: string) => void;
  updateTab: (id: string, partial: Partial<Tab>) => void;
  setActiveTabId: (id: string) => void;
}

export const EditorContext = createContext<EditorContextType | undefined>(undefined);
