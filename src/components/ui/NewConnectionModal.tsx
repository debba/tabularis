import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, Check, AlertCircle, Loader2, Database } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import clsx from "clsx";

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
  ssh_host?: string;
  ssh_port?: number;
  ssh_user?: string;
  ssh_password?: string;
  ssh_key_file?: string;
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
    port: 5432,
    username: "postgres",
    database: "postgres",
    ssh_enabled: false,
    ssh_port: 22,
  });
  const [status, setStatus] = useState<
    "idle" | "testing" | "saving" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  // Populate form on open if editing
  useEffect(() => {
    if (!isOpen) return;

    const initializeForm = () => {
      if (initialConnection) {
        setName(initialConnection.name);
        setDriver(initialConnection.params.driver);
        setFormData({ ...initialConnection.params });
      } else {
        // Reset to defaults
        setName("");
        setDriver("postgres");
        setFormData({
          host: "localhost",
          port: 5432,
          username: "postgres",
          database: "postgres",
          ssh_enabled: false,
          ssh_port: 22,
        });
      }
      setStatus("idle");
      setMessage("");
    };

    initializeForm();
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

  const InputClass =
    "w-full px-3 pt-2 pb-1 bg-base border border-strong rounded-lg text-primary focus:border-blue-500 focus:outline-none leading-tight";
  const LabelClass = "block text-xs uppercase font-bold text-muted";

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
                {initialConnection ? t("newConnection.titleEdit") : t("newConnection.titleNew")}
              </h2>
              <p className="text-xs text-secondary">{t("newConnection.subtitle")}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-secondary hover:text-primary hover:bg-surface-tertiary rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="space-y-1">
            <label className={LabelClass}>{t("newConnection.name")}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={InputClass}
              placeholder={t("newConnection.namePlaceholder")}
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className={LabelClass}>{t("newConnection.dbType")}</label>
            <div className="flex gap-2 mt-1">
              {(["postgres", "mysql", "sqlite"] as Driver[]).map((d) => (
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
              <div className="col-span-2">
                <label className={LabelClass}>{t("newConnection.host")}</label>
                <input
                  value={formData.host}
                  onChange={(e) => updateField("host", e.target.value)}
                  className={InputClass}
                />
              </div>
              <div>
                <label className={LabelClass}>{t("newConnection.port")}</label>
                <input
                  type="number"
                  value={formData.port}
                  onChange={(e) => updateField("port", e.target.value)}
                  className={InputClass}
                />
              </div>
            </div>
          )}

          {driver !== "sqlite" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LabelClass}>{t("newConnection.username")}</label>
                <input
                  value={formData.username}
                  onChange={(e) => updateField("username", e.target.value)}
                  className={InputClass}
                />
              </div>
              <div>
                <label className={LabelClass}>{t("newConnection.password")}</label>
                <input
                  type="password"
                  value={formData.password || ""}
                  onChange={(e) => updateField("password", e.target.value)}
                  className={clsx(
                    InputClass,
                    formData.save_in_keychain &&
                      !formData.password &&
                      "border-amber-500/50",
                  )}
                  placeholder={t("newConnection.passwordPlaceholder")}
                />
                {formData.save_in_keychain && !formData.password && (
                  <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={10} />
                    {t("newConnection.passwordMissing")}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className={LabelClass}>
              {driver === "sqlite" ? t("newConnection.filePath") : t("newConnection.dbName")}
            </label>
            <input
              value={formData.database}
              onChange={(e) => updateField("database", e.target.value)}
              className={InputClass}
              placeholder={
                driver === "sqlite"
                  ? t("newConnection.filePathPlaceholder")
                  : t("newConnection.dbNamePlaceholder")
              }
            />
          </div>

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
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className={LabelClass}>{t("newConnection.sshHost")}</label>
                      <input
                        value={formData.ssh_host || ""}
                        onChange={(e) =>
                          updateField("ssh_host", e.target.value)
                        }
                        className={InputClass}
                        placeholder="ssh.example.com"
                      />
                    </div>
                    <div>
                      <label className={LabelClass}>{t("newConnection.sshPort")}</label>
                      <input
                        type="number"
                        value={formData.ssh_port || 22}
                        onChange={(e) =>
                          updateField("ssh_port", Number(e.target.value))
                        }
                        className={InputClass}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={LabelClass}>{t("newConnection.sshUser")}</label>
                      <input
                        value={formData.ssh_user || ""}
                        onChange={(e) =>
                          updateField("ssh_user", e.target.value)
                        }
                        className={InputClass}
                        placeholder="root"
                      />
                    </div>
                    <div>
                      <label className={LabelClass}>{t("newConnection.sshPassword")}</label>
                      <input
                        type="password"
                        value={formData.ssh_password || ""}
                        onChange={(e) =>
                          updateField("ssh_password", e.target.value)
                        }
                        className={clsx(
                          InputClass,
                          formData.save_in_keychain &&
                            !formData.ssh_password &&
                            "border-amber-500/50",
                        )}
                        placeholder={t("newConnection.sshPasswordPlaceholder")}
                      />
                      {formData.save_in_keychain && !formData.ssh_password && (
                        <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
                          <AlertCircle size={10} />
                          {t("newConnection.sshPasswordMissing")}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className={LabelClass}>
                      {t("newConnection.sshKeyFile")}
                    </label>
                    <input
                      value={formData.ssh_key_file || ""}
                      onChange={(e) =>
                        updateField("ssh_key_file", e.target.value)
                      }
                      className={InputClass}
                      placeholder={t("newConnection.sshKeyFilePlaceholder")}
                    />
                  </div>
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
    </div>
  );
};
