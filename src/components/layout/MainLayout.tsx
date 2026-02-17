import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { SplitPaneLayout } from './SplitPaneLayout';
import { useConnectionLayoutContext } from '../../contexts/ConnectionLayoutContext';

export const MainLayout = () => {
  const { splitView } = useConnectionLayoutContext();

  return (
    <div className="flex h-screen bg-base text-primary overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {splitView ? <SplitPaneLayout {...splitView} /> : <Outlet />}
      </main>
    </div>
  );
};
