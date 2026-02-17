import { useState } from "react";
import { Database, Loader2, Shield, X, AlertCircle, Terminal, Check, Copy, Power } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ConnectionStatus } from "../../../hooks/useConnectionManager";
import { getConnectionItemClass, getStatusDotClass } from "../../../utils/connectionManager";
import { ContextMenu } from "../../ui/ContextMenu";

interface Props {
  connection: ConnectionStatus;
  onSwitch: () => void;
  onOpenInEditor: () => void;
  onDisconnect: () => void;
}

export const OpenConnectionItem = ({ connection, onSwitch, onOpenInEditor, onDisconnect }: Props) => {
  const { t } = useTranslation();
  const { isActive, isConnecting, name, database, sshEnabled, error } = connection;
  const hasError = !!error;

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const menuItems = [
    {
      label: t("sidebar.openInEditor"),
      icon: Terminal,
      action: onOpenInEditor,
    },
    {
      label: t("sidebar.setAsActive"),
      icon: Check,
      action: onSwitch,
      disabled: isActive,
    },
    { separator: true as const },
    {
      label: t("sidebar.copyName"),
      icon: Copy,
      action: () => navigator.clipboard.writeText(name),
    },
    { separator: true as const },
    {
      label: t("connections.disconnect"),
      icon: Power,
      action: onDisconnect,
      danger: true,
    },
  ];

  return (
    <>
      <div className="relative group w-full flex justify-center mb-1">
        <button
          onClick={onSwitch}
          onContextMenu={handleContextMenu}
          className={`flex items-center justify-center w-12 h-12 rounded-lg transition-all relative ${getConnectionItemClass(isActive)}`}
        >
          {isConnecting ? (
            <Loader2 size={20} className="animate-spin text-blue-400" />
          ) : (
            <Database size={20} />
          )}

          {/* Status dot */}
          {!isConnecting && (
            <div
              className={`absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full border border-elevated ${getStatusDotClass(isActive, hasError)}`}
            />
          )}

          {/* SSH badge */}
          {sshEnabled && (
            <div className="absolute top-1 right-1">
              <Shield size={9} className="text-emerald-400 fill-emerald-400/20" />
            </div>
          )}

          {/* Error indicator */}
          {hasError && !isConnecting && (
            <div className="absolute -top-0.5 -left-0.5">
              <AlertCircle size={12} className="text-red-400" />
            </div>
          )}
        </button>

        {/* Disconnect button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDisconnect();
          }}
          className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-elevated border border-default rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-900/50 hover:text-red-400 text-muted z-10"
          title={t("connections.disconnect")}
        >
          <X size={8} />
        </button>

        {/* Tooltip */}
        <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-surface-secondary text-primary text-xs px-2 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-lg border border-default">
          <div className="font-medium">{name}</div>
          <div className="text-muted text-[10px]">{database}</div>
          {hasError && <div className="text-red-400 text-[10px] mt-0.5 max-w-[180px] truncate">{error}</div>}
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={menuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
};
