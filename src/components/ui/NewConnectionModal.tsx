import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Check,
  AlertCircle,
  Loader2,
  Database,
  Settings,
  XCircle,
  FolderOpen,
} from "lucide-react";
import { invoke } from "../../lib/invoke";
import { open } from "@tauri-apps/plugin-dialog";
import clsx from "clsx";
import { SshConnectionsModal } from "../modals/SshConnectionsModal";
import { SearchableSelect } from "./SearchableSelect";
import { useDrivers } from "../../hooks/useDrivers";
import type { PluginManifest } from "../../types/plugins";
import { loadSshConnections, type SshConnection } from "../../utils/ssh";

interface ConnectionParams {
  driver: string;
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
  const { drivers } = useDrivers();
  const [driver, setDriver] = useState<string>("postgres");
  const activeDriver = drivers.find((d) => d.id === driver) ?? drivers[0];
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
  const [testResult, setTestResult] = useState<"success" | "error" | null>(
    null,
  );
  const [sshConnections, setSshConnections] = useState<SshConnection[]>([]);
  const [isSshModalOpen, setIsSshModalOpen] = useState(false);
  const [sshMode, setSshMode] = useState<"existing" | "inline">("existing");
  const [availableDatabases, setAvailableDatabases] = useState<string[]>([]);
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [databaseLoadError, setDatabaseLoadError] = useState<string | null>(
    null,
  );
  const [passwordDirty, setPasswordDirty] = useState(false);
  const [sshPasswordDirty, setSshPasswordDirty] = useState(false);

  // Load SSH connections
  const loadSshConnectionsList = async () => {
    const result = await loadSshConnections();
    setSshConnections(result);
  };

  // Load available databases for the user
  const loadDatabases = async () => {
    if (activeDriver?.capabilities?.file_based === true) {
      // SQLite doesn't support database listing
      return;
    }

    setLoadingDatabases(true);
    setDatabaseLoadError(null);
    try {
      const listParams: Partial<ConnectionParams> = {
        driver,
        ...formData,
        port: formData.port != null ? Number(formData.port) : undefined,
      };

      // In edit mode: only send password if it was modified (dirty)
      // If not dirty, don't send it (backend will use saved password)
      if (initialConnection) {
        if (!passwordDirty) {
          delete listParams.password;
        }
        if (!sshPasswordDirty) {
          delete listParams.ssh_password;
        }
      }

      const databases = await invoke<string[]>("list_databases", {
        request: {
          params: {
            ...listParams,
          },
          connection_id: initialConnection?.id,
        },
      });
      setAvailableDatabases(databases);
    } catch (err) {
      console.error("Failed to load databases:", err);
      const errorMsg =
        typeof err === "string"
          ? err
          : err instanceof Error
            ? err.message
            : t("newConnection.failLoadDatabases");
      setDatabaseLoadError(errorMsg);
      setAvailableDatabases([]);
    } finally {
      setLoadingDatabases(false);
    }
  };

  // Populate form on open if editing
  useEffect(() => {
    if (!isOpen) return;

    const initializeForm = async () => {
      if (initialConnection) {
        setName(initialConnection.name);
        setDriver(initialConnection.params.driver);
        setFormData({ ...initialConnection.params });
        setPasswordDirty(false);
        setSshPasswordDirty(false);
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
        setPasswordDirty(false);
        setSshPasswordDirty(false);
        setSshMode("existing");
      }
      setStatus("idle");
      setMessage("");
      await loadSshConnectionsList();
    };

    void initializeForm();
  }, [isOpen, initialConnection]);

  if (!isOpen) return null;

  const handleDriverChange = (newDriver: string) => {
    setDriver(newDriver);
    // Only reset if creating new, or be careful not to wipe existing data being edited?
    // Let's assume switching driver resets defaults for convenience.
    setFormData((prev) => ({
      ...prev,
      driver: newDriver,
      port: drivers.find(d => d.id === newDriver)?.default_port ?? undefined,
      username: drivers.find(d => d.id === newDriver)?.default_username ?? "",
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
    setTestResult(null);
    try {
      const testParams: Partial<ConnectionParams> = {
        driver,
        ...formData,
        port: formData.port != null ? Number(formData.port) : undefined,
      };

      if (initialConnection) {
        // Only send password if it was modified (dirty)
        // If not dirty, don't send it (backend will use saved password)
        if (!passwordDirty) {
          delete testParams.password;
        }
        if (!sshPasswordDirty) {
          delete testParams.ssh_password;
        }
      }

      const result = await invoke<string>("test_connection", {
        request: {
          params: {
            ...testParams,
          },
          connection_id: initialConnection?.id,
        },
      });
      setStatus("success");
      setMessage(result);
      setTestResult("success");

      // Clear the success indicator and message after 3 seconds
      setTimeout(() => {
        setTestResult(null);
        setStatus("idle");
        setMessage("");
      }, 3000);

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
      setTestResult("error");

      // Clear only the error icon after 3 seconds, keep the message
      setTimeout(() => {
        setTestResult(null);
        setStatus("idle");
      }, 3000);

      return false;
    }
  };

  const saveConnection = async () => {
    if (!name.trim()) {
      setStatus("error");
      setMessage(t("newConnection.nameRequired"));
      setTestResult("error");
      return;
    }

    if (!formData.database?.trim()) {
      setStatus("error");
      setMessage(t("newConnection.dbNameRequired"));
      setTestResult("error");
      return;
    }

    setStatus("saving");
    setMessage("");
    setTestResult(null);
    try {
      const params: Partial<ConnectionParams> = {
        driver,
        ...formData,
        port: formData.port != null ? Number(formData.port) : undefined,
      };

      if (initialConnection) {
        if (!params.password?.trim()) {
          delete params.password;
        }
        if (!params.ssh_password?.trim()) {
          delete params.ssh_password;
        }
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
      const msg = typeof err === "string" ? err : t("newConnection.failSave");
      setMessage(msg);
      setTestResult("error");
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
              {drivers.map((d: PluginManifest) => (
                <button
                  key={d.id}
                  onClick={() => handleDriverChange(d.id)}
                  className={clsx(
                    "px-4 py-2 rounded border text-sm font-medium capitalize flex-1",
                    driver === d.id
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-elevated border-strong text-secondary hover:border-strong",
                  )}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>

          {activeDriver?.capabilities?.file_based === false && !activeDriver?.capabilities?.folder_based && (
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

          {activeDriver?.capabilities?.file_based === false && !activeDriver?.capabilities?.folder_based && (
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
                onChange={(val) => {
                  setPasswordDirty(true);
                  updateField("password", val);
                }}
                type="password"
                placeholder={
                  initialConnection && !passwordDirty && !formData.password
                    ? "<hidden>"
                    : t("newConnection.passwordPlaceholder")
                }
              />
            </div>
          )}

          {/* Database Name / File Path / Folder Path Field */}
          {activeDriver?.capabilities?.file_based === true || activeDriver?.capabilities?.folder_based === true ? (
            <div className="space-y-1">
              <label className={LabelClass}>
                {activeDriver.capabilities.folder_based
                  ? t("newConnection.folderPath")
                  : t("newConnection.filePath")}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.database ?? ""}
                  onChange={(e) => updateField("database", e.target.value)}
                  className={clsx(InputClass, "flex-1")}
                  placeholder={
                    activeDriver.capabilities.folder_based
                      ? t("newConnection.folderPathPlaceholder")
                      : t("newConnection.filePathPlaceholder")
                  }
                />
                <button
                  type="button"
                  onClick={async () => {
                    const selected = await open({
                      multiple: false,
                      directory: activeDriver.capabilities.folder_based,
                    });
                    if (selected) {
                      updateField("database", selected);
                    }
                  }}
                  className="px-3 pt-2 pb-1 bg-base hover:bg-surface-tertiary text-secondary hover:text-primary border border-strong rounded-lg transition-colors shrink-0"
                  title={
                    activeDriver.capabilities.folder_based
                      ? t("newConnection.browseFolder")
                      : t("newConnection.browseFile")
                  }
                >
                  <FolderOpen size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className={LabelClass}>
                  {t("newConnection.dbName")}
                </label>
                <button
                  type="button"
                  onClick={loadDatabases}
                  disabled={
                    loadingDatabases || !formData.host || !formData.username
                  }
                  className="text-xs text-blue-400 hover:text-blue-300 disabled:text-muted disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {loadingDatabases ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      {t("newConnection.loadingDatabases")}
                    </>
                  ) : (
                    <>
                      <Database size={12} />
                      {t("newConnection.loadDatabases")}
                    </>
                  )}
                </button>
              </div>
              <div className="space-y-2">
                {availableDatabases.length > 0 ? (
                  <SearchableSelect
                    value={formData.database || null}
                    options={availableDatabases}
                    onChange={(val) => updateField("database", val)}
                    placeholder={t("newConnection.selectDatabase")}
                    searchPlaceholder={t("common.search")}
                    noResultsLabel={t("newConnection.noDatabasesFound")}
                  />
                ) : (
                  <input
                    type="text"
                    value={formData.database ?? ""}
                    onChange={(e) => updateField("database", e.target.value)}
                    className={InputClass}
                    placeholder={t("newConnection.dbNamePlaceholder")}
                  />
                )}
                {databaseLoadError && (
                  <div className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {databaseLoadError}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SSH Tunnel Section */}
          {activeDriver?.capabilities?.file_based === false && !activeDriver?.capabilities?.folder_based && (
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
                        setSshPasswordDirty(false);
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
                          onChange={(val) => {
                            setSshPasswordDirty(true);
                            updateField("ssh_password", val);
                          }}
                          type="password"
                          placeholder={
                            initialConnection &&
                            !sshPasswordDirty &&
                            !formData.ssh_password
                              ? "<hidden>"
                              : t("newConnection.sshPasswordPlaceholder")
                          }
                          error={
                            formData.save_in_keychain &&
                            sshPasswordDirty &&
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

          {activeDriver?.capabilities?.file_based === false && !activeDriver?.capabilities?.folder_based && (
            <div className="mt-4 flex items-center gap-2">
              <input
                type="checkbox"
                id="keychain-toggle"
                checked={!!formData.save_in_keychain}
                onChange={(e) => {
                  updateField("password", "");
                  setPasswordDirty(true);
                  setSshPasswordDirty(true);
                  updateField("save_in_keychain", e.target.checked);
                }}
                className="accent-blue-500 w-4 h-4 rounded cursor-pointer"
              />
              <label
                htmlFor="keychain-toggle"
                className="text-sm font-medium text-secondary cursor-pointer select-none"
              >
                {t("newConnection.saveKeychain")}
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-default bg-base/50 space-y-3">
          {/* Error Message Only */}
          {message &&
            (status === "error" ||
              (status === "idle" && testResult !== "success")) && (
              <div className="text-sm text-red-500 flex items-start gap-2">
                <XCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{message}</span>
              </div>
            )}

          <div className="flex justify-end gap-3">
            <button
              onClick={testConnection}
              disabled={status === "testing" || status === "saving"}
              className="px-4 py-2 text-secondary hover:text-primary hover:bg-surface-tertiary transition-colors text-sm flex items-center gap-2 disabled:opacity-50 rounded-lg"
            >
              {status === "testing" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : testResult === "success" ? (
                <Check size={16} className="text-green-500" />
              ) : testResult === "error" ? (
                <XCircle size={16} className="text-red-500" />
              ) : null}
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
