import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { SplitPaneLayout } from './SplitPaneLayout';
import { useConnectionLayoutContext } from '../../hooks/useConnectionLayoutContext';
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts';

export const MainLayout = () => {
  const { splitView, isSplitVisible } = useConnectionLayoutContext();
  const location = useLocation();
  useGlobalShortcuts();

  const showSplit = !!splitView
    && isSplitVisible
    && location.pathname !== '/'
    && location.pathname !== '/connections'
    && location.pathname !== '/settings';

  return (
    <div className="flex h-screen bg-base text-primary overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {showSplit ? <SplitPaneLayout {...splitView} /> : <Outlet />}
      </main>
    </div>
  );
};
