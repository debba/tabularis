import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plug2, Settings, Cpu, PanelLeft } from "lucide-react";
import { DiscordIcon } from "../icons/DiscordIcon";
import { openUrl } from "@tauri-apps/plugin-opener";
import { DISCORD_URL } from "../../config/links";
import { useDatabase } from "../../hooks/useDatabase";
import { useTheme } from "../../hooks/useTheme";
import { McpModal } from "../modals/McpModal";

// Sub-components
import { NavItem } from "./sidebar/NavItem";
import { OpenConnectionItem } from "./sidebar/OpenConnectionItem";
import { ConnectionGroupItem } from "./sidebar/ConnectionGroupItem";
import { ExplorerSidebar } from "./ExplorerSidebar";
import { PanelDatabaseProvider } from "./PanelDatabaseProvider";

// Hooks & Utils
import { useSidebarResize } from "../../hooks/useSidebarResize";
import { useConnectionManager } from "../../hooks/useConnectionManager";
import { useConnectionLayoutContext } from "../../contexts/ConnectionLayoutContext";
import { isConnectionGrouped } from "../../utils/connectionLayout";

export const Sidebar = () => {
  const { t } = useTranslation();
  const { currentTheme } = useTheme();
  const isDarkTheme = !currentTheme?.id?.includes("-light");
  const { activeConnectionId } = useDatabase();
  const navigate = useNavigate();
  const location = useLocation();

  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);
  const [isMcpModalOpen, setIsMcpModalOpen] = useState(false);

  const {
    openConnections,
    handleDisconnect: disconnectConnection,
    handleSwitch,
  } = useConnectionManager();

  const {
    splitView,
    isSplitVisible,
    selectedConnectionIds,
    toggleSelection,
    activateSplit,
    hideSplitView,
    explorerConnectionId
  } = useConnectionLayoutContext();

  const { sidebarWidth, startResize } = useSidebarResize();

  const handleSwitchToConnection = (connectionId: string) => {
    handleSwitch(connectionId);
    if (location.pathname === "/") {
      navigate("/editor");
    }
  };

  const handleSwitchOrSetExplorer = (connectionId: string) => {
    if (splitView) {
      hideSplitView();
    }
    handleSwitchToConnection(connectionId);
  };

  const handleDisconnectConnection = async (connectionId: string) => {
    const isLast = openConnections.length <= 1;
    await disconnectConnection(connectionId);
    if (isLast) {
      navigate("/");
    }
  };

  const handleOpenInEditor = (connectionId: string) => {
    handleSwitch(connectionId);
    navigate("/editor");
  };

  const explorerConnId = (splitView && isSplitVisible) ? explorerConnectionId : activeConnectionId;
  const shouldShowExplorer =
    !!explorerConnId &&
    location.pathname !== "/settings" &&
    location.pathname !== "/";

  return (
    <div className="flex h-full">
      {/* Primary Navigation Bar (Narrow) */}
      <aside className="w-16 bg-elevated border-r border-default flex flex-col items-center py-4 z-20">
        <div className="mb-8" title="tabularis">
          <img
            src="/logo.png"
            alt="tabularis"
            className="w-12 h-12 p-2 rounded-2xl mx-auto mb-4 shadow-lg shadow-blue-500/30"
            style={{
              backgroundColor: isDarkTheme
                ? currentTheme?.colors?.surface?.secondary || "#334155"
                : currentTheme?.colors?.bg?.elevated || "#f8fafc",
            }}
          />
        </div>

        <nav className="flex-1 w-full flex flex-col items-center">
          <NavItem
            to="/"
            icon={Plug2}
            label={t("sidebar.connections")}
            isConnected={!!activeConnectionId}
          />

          {/* Open connections */}
          {openConnections.length > 0 && (
            <div className="w-full flex flex-col items-center mt-2 pt-2 border-t border-default">
              {/* Show group item once if there is a split view */}
              {splitView && (
                <ConnectionGroupItem
                  connections={openConnections.filter(c =>
                    isConnectionGrouped(c.id, splitView),
                  )}
                  mode={splitView.mode}
                />
              )}

              {/* Show individual items for non-grouped connections */}
              {openConnections
                .filter(conn => !isConnectionGrouped(conn.id, splitView))
                .map(conn => (
                  <OpenConnectionItem
                    key={conn.id}
                    connection={conn}
                    isSelected={selectedConnectionIds.has(conn.id)}
                    onSwitch={() => handleSwitchOrSetExplorer(conn.id)}
                    onOpenInEditor={() => handleOpenInEditor(conn.id)}
                    onDisconnect={() => handleDisconnectConnection(conn.id)}
                    onToggleSelect={(isCtrlHeld) => toggleSelection(conn.id, isCtrlHeld)}
                    selectedConnectionIds={selectedConnectionIds}
                    onActivateSplit={activateSplit}
                  />
                ))}
            </div>
          )}
        </nav>

        <div className="mt-auto">
          <button
            onClick={() => openUrl(DISCORD_URL)}
            className="flex items-center justify-center w-12 h-12 rounded-lg transition-colors mb-2 relative group text-secondary hover:bg-surface-secondary hover:text-indigo-400"
          >
            <div className="relative">
              <DiscordIcon size={24} />
            </div>
            <span className="absolute left-14 bg-surface-secondary text-primary text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
              Discord
            </span>
          </button>

          <button
            onClick={() => setIsMcpModalOpen(true)}
            className="flex items-center justify-center w-12 h-12 rounded-lg transition-colors mb-2 relative group text-secondary hover:bg-surface-secondary hover:text-primary"
          >
            <div className="relative">
              <Cpu size={24} />
            </div>
            <span className="absolute left-14 bg-surface-secondary text-primary text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
              MCP Server
            </span>
          </button>

          <NavItem
            to="/settings"
            icon={Settings}
            label={t("sidebar.settings")}
          />
        </div>
      </aside>

      {/* Secondary Sidebar (Schema Explorer) */}
      {shouldShowExplorer && !isExplorerCollapsed && explorerConnId && (
        <PanelDatabaseProvider connectionId={explorerConnId}>
          <ExplorerSidebar
            sidebarWidth={sidebarWidth}
            startResize={startResize}
            onCollapse={() => setIsExplorerCollapsed(true)}
          />
        </PanelDatabaseProvider>
      )}

      {/* Collapsed Explorer (Icon only) */}
      {shouldShowExplorer && isExplorerCollapsed && (
        <div className="w-12 bg-base border-r border-default flex flex-col items-center py-4">
          <button
            onClick={() => setIsExplorerCollapsed(false)}
            className="text-muted hover:text-secondary hover:bg-surface-secondary rounded-lg p-2 transition-colors group relative"
            title={t("sidebar.expandExplorer")}
          >
            <PanelLeft size={20} />
            <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-surface-secondary text-primary text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
              {t("sidebar.expandExplorer")}
            </span>
          </button>
        </div>
      )}

      {isMcpModalOpen && (
        <McpModal
          isOpen={isMcpModalOpen}
          onClose={() => setIsMcpModalOpen(false)}
        />
      )}
    </div>
  );
};
