import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { MainLayout } from './components/layout/MainLayout';
import { Connections } from './pages/Connections';
import { Editor } from './pages/Editor';
import { Settings } from './pages/Settings';
import { SchemaDiagramPage } from './pages/SchemaDiagramPage';
import { UpdateNotificationModal } from './components/modals/UpdateNotificationModal';
import { useUpdate } from './hooks/useUpdate';

function App() {
  const {
    updateInfo,
    isDownloading,
    downloadProgress,
    downloadAndInstall,
    dismissUpdate,
    error: updateError
  } = useUpdate();
  const [isDebugMode, setIsDebugMode] = useState(false);

  useEffect(() => {
    invoke<boolean>('is_debug_mode').then(setIsDebugMode);
  }, []);

  useEffect(() => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isLocalhost || isDebugMode) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [isDebugMode]);

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Connections />} />
            <Route path="editor" element={<Editor />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="/schema-diagram" element={<SchemaDiagramPage />} />
        </Routes>
      </BrowserRouter>

      <UpdateNotificationModal
        isOpen={!!updateInfo}
        onClose={dismissUpdate}
        updateInfo={updateInfo!}
        isDownloading={isDownloading}
        downloadProgress={downloadProgress}
        onDownloadAndInstall={downloadAndInstall}
        error={updateError}
      />
    </>
  );
}

export default App;
