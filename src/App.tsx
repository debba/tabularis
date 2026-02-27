import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { invoke } from "./lib/invoke";
import { MainLayout } from "./components/layout/MainLayout";
import { ConnectionLayoutProvider } from "./contexts/ConnectionLayoutProvider";
import { Connections } from "./pages/Connections";
import { Editor } from "./pages/Editor";
import { Settings } from "./pages/Settings";
import { SchemaDiagramPage } from "./pages/SchemaDiagramPage";
import { TaskManagerPage } from "./pages/TaskManagerPage";
import { UpdateNotificationModal } from "./components/modals/UpdateNotificationModal";
import { CommunityModal } from "./components/modals/CommunityModal";
import { AccessRevokedModal } from "./components/modals/AccessRevokedModal";
import { useUpdate } from "./hooks/useUpdate";
import { useSessionWatch } from "./hooks/useSessionWatch";
import { useHeartbeat } from "./hooks/useHeartbeat";
import { LoginPage } from "./components/LoginPage";
import { useTranslation } from "react-i18next";
import { CheckCircle, XCircle, Loader2, LogOut, Info } from "lucide-react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const COMMUNITY_MODAL_KEY = "tabularis_community_modal_dismissed";

interface AccessToast {
  requestId: string;
  name: string | null;
  ip: string;
  loading: boolean;
}

interface InfoToast {
  message: string;
}

function App() {
  const { t } = useTranslation();
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
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => isTauri() || !!localStorage.getItem("rc_token"),
  );
  const [isRevoked, setIsRevoked] = useState(false);
  const [accessToast, setAccessToast] = useState<AccessToast | null>(null);
  const [infoToast, setInfoToast] = useState<InfoToast | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const infoToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rcToken =
    isAuthenticated && !isTauri() ? localStorage.getItem("rc_token") : null;

  // Watch session revocation (web mode only)
  useSessionWatch({
    token: rcToken,
    onRevoked: () => setIsRevoked(true),
  });

  // Send heartbeat to keep session alive (web mode only)
  useHeartbeat(rcToken);

  const tryNotify = async (title: string, body: string) => {
    if (!isTauri()) return;
    try {
      let granted = await isPermissionGranted();
      if (!granted) {
        const result = await requestPermission();
        granted = result === "granted";
      }
      if (granted) sendNotification({ title, body });
    } catch {
      // Notifications not supported or permission denied — silently ignore
    }
  };

  const showInfoToast = (message: string) => {
    setInfoToast({ message });
    if (infoToastTimer.current) clearTimeout(infoToastTimer.current);
    infoToastTimer.current = setTimeout(() => setInfoToast(null), 5000);
  };

  // Listen for new access requests (Tauri mode only)
  useEffect(() => {
    if (!isTauri()) return;

    let unlistenRequest: (() => void) | null = null;
    let unlistenDisconnect: (() => void) | null = null;

    import("@tauri-apps/api/event").then(({ listen }) => {
      listen<{ requestId: string; name: string | null; ip: string }>(
        "rc_new_request",
        (event) => {
          setAccessToast({
            requestId: event.payload.requestId,
            name: event.payload.name,
            ip: event.payload.ip,
            loading: false,
          });
          const who = event.payload.name ?? event.payload.ip;
          tryNotify(
            "Tabularis Remote",
            `${who} ${t("settings.remoteControl.toast.newRequest")}`,
          );
        },
      ).then((fn) => {
        unlistenRequest = fn;
      });

      listen<{ name: string | null; ip: string }>(
        "rc_session_disconnected",
        (event) => {
          const who = event.payload.name ?? event.payload.ip;
          const msg = `${who} ${t("settings.remoteControl.toast.sessionDisconnected")}`;
          showInfoToast(msg);
          tryNotify("Tabularis Remote", msg);
        },
      ).then((fn) => {
        unlistenDisconnect = fn;
      });
    });

    return () => {
      unlistenRequest?.();
      unlistenDisconnect?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApprove = async () => {
    if (!accessToast) return;
    setAccessToast((t) => (t ? { ...t, loading: true } : null));
    try {
      await invoke("approve_access_request", { id: accessToast.requestId });
    } finally {
      setAccessToast(null);
    }
  };

  const handleDeny = async () => {
    if (!accessToast) return;
    setAccessToast((t) => (t ? { ...t, loading: true } : null));
    try {
      await invoke("deny_access_request", { id: accessToast.requestId });
    } finally {
      setAccessToast(null);
    }
  };

  const handleSelfDisconnect = async () => {
    if (!rcToken || disconnecting) return;
    setDisconnecting(true);
    try {
      await fetch("/api/disconnect", {
        method: "POST",
        headers: { Authorization: `Bearer ${rcToken}` },
      });
    } finally {
      localStorage.removeItem("rc_token");
      window.location.reload();
    }
  };

  const dismissCommunityModal = useCallback(() => {
    localStorage.setItem(COMMUNITY_MODAL_KEY, "1");
    setIsCommunityModalOpen(false);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    invoke<boolean>("is_debug_mode").then((debugMode) => {
      setIsDebugMode(debugMode);
    });
  }, [isAuthenticated]);

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

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <>
      <BrowserRouter>
        <ConnectionLayoutProvider>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Connections />} />
              <Route path="editor" element={<Editor />} />
              <Route
                path="settings"
                element={isTauri() ? <Settings /> : <Navigate to="/" replace />}
              />
            </Route>
            <Route path="/schema-diagram" element={<SchemaDiagramPage />} />
            <Route path="/task-manager" element={<TaskManagerPage />} />
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

      {/* Session revoked modal (web mode) */}
      <AccessRevokedModal isOpen={isRevoked} />

      {/* Self-disconnect button (web mode, bottom-left) */}
      {!isTauri() && isAuthenticated && !isRevoked && (
        <button
          onClick={handleSelfDisconnect}
          disabled={disconnecting}
          title={t("settings.remoteControl.sessions.disconnect")}
          className="fixed bottom-4 left-4 z-40 flex items-center gap-1.5 px-3 py-1.5 bg-surface-secondary hover:bg-red-900/40 border border-default hover:border-red-700/60 text-muted hover:text-red-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          {disconnecting ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <LogOut size={12} />
          )}
          {t("settings.remoteControl.sessions.disconnect")}
        </button>
      )}

      {/* New access request toast (Tauri mode) */}
      {accessToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-elevated border border-default rounded-xl shadow-2xl p-4 max-w-xs w-full space-y-3">
          <p className="text-sm text-primary font-medium">
            {accessToast.name
              ? `${accessToast.name} ${t("settings.remoteControl.toast.newRequest")}`
              : `${accessToast.ip} ${t("settings.remoteControl.toast.newRequest")}`}
          </p>
          <p className="text-xs text-muted">{accessToast.ip}</p>
          <div className="flex gap-2">
            <button
              onClick={handleApprove}
              disabled={accessToast.loading}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              {accessToast.loading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <CheckCircle size={12} />
              )}
              {t("settings.remoteControl.sessions.accept")}
            </button>
            <button
              onClick={handleDeny}
              disabled={accessToast.loading}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              {accessToast.loading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <XCircle size={12} />
              )}
              {t("settings.remoteControl.sessions.deny")}
            </button>
          </div>
        </div>
      )}

      {/* Disconnection info toast (Tauri mode) */}
      {infoToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-elevated border border-default rounded-xl shadow-2xl p-4 max-w-xs w-full flex items-start gap-3">
          <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
          <p className="text-sm text-secondary">{infoToast.message}</p>
        </div>
      )}
    </>
  );
}

export default App;
