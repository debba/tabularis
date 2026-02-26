import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { invoke } from "./lib/invoke";
import { MainLayout } from "./components/layout/MainLayout";
import { ConnectionLayoutProvider } from "./contexts/ConnectionLayoutProvider";
import { Connections } from "./pages/Connections";
import { Editor } from "./pages/Editor";
import { Settings } from "./pages/Settings";
import { SchemaDiagramPage } from "./pages/SchemaDiagramPage";
import { UpdateNotificationModal } from "./components/modals/UpdateNotificationModal";
import { CommunityModal } from "./components/modals/CommunityModal";
import { useUpdate } from "./hooks/useUpdate";

const COMMUNITY_MODAL_KEY = "tabularis_community_modal_dismissed";

function App() {
  const {
    updateInfo,
    isDownloading,
    downloadProgress,
    downloadAndInstall,
    dismissUpdate,
    error: updateError,
  } = useUpdate();
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isCommunityModalOpen, setIsCommunityModalOpen] = useState(
    () => !localStorage.getItem(COMMUNITY_MODAL_KEY),
  );

  const dismissCommunityModal = useCallback(() => {
    localStorage.setItem(COMMUNITY_MODAL_KEY, "1");
    setIsCommunityModalOpen(false);
  }, []);

  useEffect(() => {
    invoke<boolean>("is_debug_mode").then((debugMode) => {
      setIsDebugMode(debugMode);
    });
  }, []);

  useEffect(() => {
    if (isDebugMode) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [isDebugMode]);

  return (
    <>
      <BrowserRouter>
        <ConnectionLayoutProvider>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Connections />} />
              <Route path="editor" element={<Editor />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="/schema-diagram" element={<SchemaDiagramPage />} />
          </Routes>
        </ConnectionLayoutProvider>
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

      <CommunityModal
        isOpen={isCommunityModalOpen}
        onClose={dismissCommunityModal}
      />
    </>
  );
}

export default App;
