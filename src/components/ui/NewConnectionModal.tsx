import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Check,
  AlertCircle,
  Loader2,
  Database,
  Settings,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import clsx from "clsx";
import { SshConnectionsModal } from "./SshConnectionsModal";
import { loadSshConnections, type SshConnection } from "../../utils/ssh";

type Driver = "postgres" | "mysql" | "sqlite";

interface ConnectionParams {
  driver: Driver;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database: string;
  // SSH
  ssh_enabled?: boolean;
  ssh_connection_id?: string;
  // Legacy SSH fields (for backward compatibility)
  ssh_host?: string;
  ssh_port?: number;
  ssh_user?: string;
  ssh_password?: string;
  ssh_key_file?: string;
  ssh_key_passphrase?: string;
  save_in_keychain?: boolean;
}

interface SavedConnection {
  id: string;
  name: string;
  params: ConnectionParams;
}

interface NewConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
  initialConnection?: SavedConnection | null;
}

const InputClass =
  "w-full px-3 pt-2 pb-1 bg-base border border-strong rounded-lg text-primary focus:border-blue-500 focus:outline-none leading-tight";
const LabelClass = "block text-xs uppercase font-bold text-muted";

interface ConnectionInputProps {
  label: string;
  value: string | number | undefined;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  error?: React.ReactNode;
  autoFocus?: boolean;
  className?: string;
}

const ConnectionInput = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  autoFocus,
  className,
}: ConnectionInputProps) => {
  return (
    <div className={clsx("space-y-1", className)}>
      <label className={LabelClass}>{label}</label>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(InputClass, error && "border-amber-500/50")}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      {error}
    </div>
  );
};

export const NewConnectionModal = ({
  isOpen,
  onClose,
  onSave,
  initialConnection,
}: NewConnectionModalProps) => {
  const { t } = useTranslation();
  const [driver, setDriver] = useState<Driver>("postgres");
  const [name, setName] = useState("");
  const [formData, setFormData] = useState<Partial<ConnectionParams>>({
    host: "localhost",
    port: 3306,
    username: "",
    database: "",
    ssh_enabled: false,
    ssh_port: 22,
  });
  const [status, setStatus] = useState<
    "idle" | "testing" | "saving" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [sshConnections, setSshConnections] = useState<SshConnection[]>([]);
  const [isSshModalOpen, setIsSshModalOpen] = useState(false);
  const [sshMode, setSshMode] = useState<"existing" | "inline">("existing");

  // Load SSH connections
  const loadSshConnectionsList = async () => {
    const result = await loadSshConnections();
    setSshConnections(result);
  };

  // Populate form on open if editing
  useEffect(() => {
    if (!isOpen) return;

    const initializeForm = async () => {
      if (initialConnection) {
        setName(initialConnection.name);
        setDriver(initialConnection.params.driver);
        setFormData({ ...initialConnection.params });
        // Set SSH mode based on whether using connection ID or inline config
        setSshMode(
          initialConnection.params.ssh_connection_id ? "existing" : "inline",
        );
      } else {
        // Reset to defaults
        setName("");
        setDriver("mysql");
        setFormData({
          host: "localhost",
          port: 3306,
          username: "",
          database: "",
          ssh_enabled: false,
          ssh_port: 22,
        });
        setSshMode("existing");
      }
      setStatus("idle");
      setMessage("");
      await loadSshConnectionsList();
    };

    void initializeForm();
  }, [isOpen, initialConnection]);

  if (!isOpen) return null;

  const handleDriverChange = (newDriver: Driver) => {
    setDriver(newDriver);
    // Only reset if creating new, or be careful not to wipe existing data being edited?
    // Let's assume switching driver resets defaults for convenience.
    setFormData((prev) => ({
      ...prev,
      port:
        newDriver === "postgres"
          ? 5432
          : newDriver === "mysql"
            ? 3306
            : undefined,
      username: newDriver === "postgres" ? "postgres" : "root",
    }));
    setStatus("idle");
    setMessage("");
  };

  const updateField = (
    field: keyof ConnectionParams,
    value: string | number | boolean | undefined,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const testConnection = async () => {
    setStatus("testing");
    setMessage("");
    try {
      const result = await invoke<string>("test_connection", {
        params: {
          driver,
          ...formData,
          port: Number(formData.port),
        },
      });
      setStatus("success");
      setMessage(result);
      return true;
    } catch (err) {
      console.error("Connection test error:", err);
      setStatus("error");
      const msg =
        typeof err === "string"
          ? err
          : err instanceof Error
            ? err.message
            : JSON.stringify(err);
      setMessage(msg);
      return false;
    }
  };

  const saveConnection = async () => {
    if (!name.trim()) {
      setStatus("error");
      setMessage(t("newConnection.nameRequired"));
      return;
    }

    setStatus("saving");
    setMessage("");
    try {
      const params = {
        driver,
        ...formData,
        port: Number(formData.port),
      };

      if (initialConnection) {
        // Update
        await invoke("update_connection", {
          id: initialConnection.id,
          name,
          params,
        });
      } else {
        // Create
        await invoke("save_connection", {
          name,
          params,
        });
      }

      if (onSave) onSave();
      onClose();
    } catch (err) {
      setStatus("error");
      setMessage(typeof err === "string" ? err : t("newConnection.failSave"));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-sm">
      <div className="bg-elevated border border-strong rounded-xl shadow-2xl w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-default bg-base">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-900/30 rounded-lg">
              <Database size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">
                {initialConnection
                  ? t("newConnection.titleEdit")
                  : t("newConnection.titleNew")}
              </h2>
              <p className="text-xs text-secondary">
                {t("newConnection.subtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-secondary hover:text-primary hover:bg-surface-tertiary rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <ConnectionInput
            label={t("newConnection.name")}
            value={name}
            onChange={setName}
            placeholder={t("newConnection.namePlaceholder")}
            autoFocus
          />

          <div className="space-y-1">
            <label className={LabelClass}>{t("newConnection.dbType")}</label>
            <div className="flex gap-2 mt-1">
              {(["mysql", "postgres", "sqlite"] as Driver[]).map((d) => (
                <button
                  key={d}
                  onClick={() => handleDriverChange(d)}
                  className={clsx(
                    "px-4 py-2 rounded border text-sm font-medium capitalize flex-1",
                    driver === d
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-elevated border-strong text-secondary hover:border-strong",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {driver !== "sqlite" && (
            <div className="grid grid-cols-3 gap-4">
              <ConnectionInput
                className="col-span-2"
                label={t("newConnection.host")}
                value={formData.host}
                onChange={(val) => updateField("host", val)}
                placeholder="localhost"
              />
              <ConnectionInput
                label={t("newConnection.port")}
                value={formData.port}
                onChange={(val) => updateField("port", val)}
                type="number"
                placeholder={driver === "mysql" ? "3306" : "5432"}
              />
            </div>
          )}

          {driver !== "sqlite" && (
            <div className="grid grid-cols-2 gap-4">
              <ConnectionInput
                label={t("newConnection.username")}
                value={formData.username}
                onChange={(val) => updateField("username", val)}
                placeholder="Username"
              />
              <ConnectionInput
                label={t("newConnection.password")}
                value={formData.password}
                onChange={(val) => updateField("password", val)}
                type="password"
                placeholder={t("newConnection.passwordPlaceholder")}
                error={
                  formData.save_in_keychain && !formData.password ? (
                    <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {t("newConnection.passwordMissing")}
                    </p>
                  ) : null
                }
              />
            </div>
          )}

          <ConnectionInput
            label={
              driver === "sqlite"
                ? t("newConnection.filePath")
                : t("newConnection.dbName")
            }
            value={formData.database}
            onChange={(val) => updateField("database", val)}
            placeholder={
              driver === "sqlite"
                ? t("newConnection.filePathPlaceholder")
                : t("newConnection.dbNamePlaceholder")
            }
          />

          {/* SSH Tunnel Section */}
          {driver !== "sqlite" && (
            <div className="pt-4 border-t border-default space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="ssh-toggle"
                  checked={!!formData.ssh_enabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    updateField("ssh_enabled", enabled);
                    if (enabled && !formData.ssh_port)
                      updateField("ssh_port", 22);
                  }}
                  className="accent-blue-500 w-4 h-4 rounded cursor-pointer"
                />
                <label
                  htmlFor="ssh-toggle"
                  className="text-sm font-semibold text-secondary cursor-pointer select-none"
                >
                  {t("newConnection.useSsh")}
                </label>
              </div>

              {formData.ssh_enabled && (
                <div className="space-y-4 pl-3 border-l-2 border-default ml-1">
                  {/* SSH Mode Selection */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSshMode("existing");
                        // Clear inline fields when switching to existing
                        updateField("ssh_host", undefined);
                        updateField("ssh_user", undefined);
                        updateField("ssh_password", undefined);
                        updateField("ssh_key_file", undefined);
                        updateField("ssh_key_passphrase", undefined);
                      }}
                      className={clsx(
                        "flex-1 px-3 py-2 rounded border text-sm font-medium transition-colors",
                        sshMode === "existing"
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-elevated border-strong text-secondary hover:border-strong",
                      )}
                    >
                      {t("newConnection.useSshConnection")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSshMode("inline");
                        // Clear connection ID when switching to inline
                        updateField("ssh_connection_id", undefined);
                      }}
                      className={clsx(
                        "flex-1 px-3 py-2 rounded border text-sm font-medium transition-colors",
                        sshMode === "inline"
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-elevated border-strong text-secondary hover:border-strong",
                      )}
                    >
                      {t("newConnection.createInlineSsh")}
                    </button>
                  </div>

                  {/* Existing SSH Connection */}
                  {sshMode === "existing" && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className={LabelClass}>
                          {t("newConnection.selectSshConnection")}
                        </label>
                        <select
                          value={formData.ssh_connection_id || ""}
                          onChange={(e) =>
                            updateField("ssh_connection_id", e.target.value)
                          }
                          className={clsx(
                            InputClass,
                            "cursor-pointer appearance-auto",
                          )}
                        >
                          <option value="">
                            {sshConnections.length === 0
                              ? t("newConnection.noSshConnections")
                              : "-- " +
                                t("newConnection.selectSshConnection") +
                                " --"}
                          </option>
                          {sshConnections.map((conn) => (
                            <option key={conn.id} value={conn.id}>
                              {conn.name} ({conn.user}@{conn.host}:{conn.port})
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsSshModalOpen(true)}
                        className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1.5 font-medium"
                      >
                        <Settings size={14} />
                        {t("newConnection.manageSshConnections")}
                      </button>
                    </div>
                  )}

                  {/* Inline SSH Configuration */}
                  {sshMode === "inline" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <ConnectionInput
                          className="col-span-2"
                          label={t("newConnection.sshHost")}
                          value={formData.ssh_host}
                          onChange={(val) => updateField("ssh_host", val)}
                          placeholder="ssh.example.com"
                        />
                        <ConnectionInput
                          label={t("newConnection.sshPort")}
                          value={formData.ssh_port}
                          onChange={(val) =>
                            updateField("ssh_port", Number(val))
                          }
                          type="number"
                          placeholder="22"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <ConnectionInput
                          label={t("newConnection.sshUser")}
                          value={formData.ssh_user}
                          onChange={(val) => updateField("ssh_user", val)}
                          placeholder="Username"
                        />
                        <ConnectionInput
                          label={t("newConnection.sshPassword")}
                          value={formData.ssh_password}
                          onChange={(val) => updateField("ssh_password", val)}
                          type="password"
                          placeholder={t(
                            "newConnection.sshPasswordPlaceholder",
                          )}
                          error={
                            formData.save_in_keychain &&
                            !formData.ssh_password ? (
                              <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
                                <AlertCircle size={10} />
                                {t("newConnection.sshPasswordMissing")}
                              </p>
                            ) : null
                          }
                        />
                      </div>

                      <ConnectionInput
                        label={t("newConnection.sshKeyFile")}
                        value={formData.ssh_key_file}
                        onChange={(val) => updateField("ssh_key_file", val)}
                        placeholder={t("newConnection.sshKeyFilePlaceholder")}
                      />

                      <ConnectionInput
                        label={t("newConnection.sshKeyPassphrase")}
                        value={formData.ssh_key_passphrase}
                        onChange={(val) =>
                          updateField("ssh_key_passphrase", val)
                        }
                        type="password"
                        placeholder={t(
                          "newConnection.sshKeyPassphrasePlaceholder",
                        )}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="keychain-toggle"
              checked={!!formData.save_in_keychain}
              onChange={(e) =>
                updateField("save_in_keychain", e.target.checked)
              }
              className="accent-blue-500 w-4 h-4 rounded cursor-pointer"
            />
            <label
              htmlFor="keychain-toggle"
              className="text-sm font-medium text-secondary cursor-pointer select-none"
            >
              {t("newConnection.saveKeychain")}
            </label>
          </div>

          {/* Status Message */}
          {message && (
            <div
              className={clsx(
                "p-3 rounded-lg flex items-start gap-2 text-sm border",
                status === "success"
                  ? "bg-green-900/20 text-green-400 border-green-900/50"
                  : "bg-red-900/20 text-red-400 border-red-900/50",
              )}
            >
              {status === "success" ? (
                <Check size={16} className="mt-0.5" />
              ) : (
                <AlertCircle size={16} className="mt-0.5" />
              )}
              <span>{message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-default bg-base/50 flex justify-end gap-3">
          <button
            onClick={testConnection}
            disabled={status === "testing" || status === "saving"}
            className="px-4 py-2 text-secondary hover:text-primary hover:bg-surface-tertiary transition-colors text-sm flex items-center gap-2 disabled:opacity-50 rounded-lg"
          >
            {status === "testing" && (
              <Loader2 size={16} className="animate-spin" />
            )}
            {t("newConnection.testConnection")}
          </button>
          <button
            onClick={saveConnection}
            disabled={status === "saving"}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {status === "saving" && (
              <Loader2 size={16} className="animate-spin" />
            )}
            {t("newConnection.save")}
          </button>
        </div>
      </div>

      {/* SSH Connections Management Modal */}
      <SshConnectionsModal
        isOpen={isSshModalOpen}
        onClose={async () => {
          setIsSshModalOpen(false);
          await loadSshConnectionsList();
        }}
      />
    </div>
  );
};
