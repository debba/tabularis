import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import {
  Database,
  Terminal,
  Settings,
  Plus,
  FileCode,
  Play,
  Edit,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  Cpu,
  Network,
  PlaySquare,
  Hash,
  FileText,
  Copy,
  Loader2,
  Download,
  Upload,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { ask, message, open } from "@tauri-apps/plugin-dialog";
import { useDatabase } from "../../hooks/useDatabase";
import { useTheme } from "../../hooks/useTheme";
import { useSavedQueries } from "../../hooks/useSavedQueries";
import type { SavedQuery } from "../../contexts/SavedQueriesContext";
import { ContextMenu } from "../ui/ContextMenu";
import { SchemaModal } from "../ui/SchemaModal";
import { CreateTableModal } from "../ui/CreateTableModal";
import { QueryModal } from "../ui/QueryModal";
import { ModifyColumnModal } from "../ui/ModifyColumnModal";
import { CreateIndexModal } from "../ui/CreateIndexModal";
import { CreateForeignKeyModal } from "../ui/CreateForeignKeyModal";
import { GenerateSQLModal } from "../ui/GenerateSQLModal";
import { McpModal } from "../modals/McpModal";
import { DumpDatabaseModal } from "../modals/DumpDatabaseModal";
import { ImportDatabaseModal } from "../modals/ImportDatabaseModal";

// Sub-components
import { NavItem } from "./sidebar/NavItem";
import { Accordion } from "./sidebar/Accordion";
import { SidebarTableItem } from "./sidebar/SidebarTableItem";

// Hooks & Types
import { useSidebarResize } from "../../hooks/useSidebarResize";
import type { TableColumn } from "../../types/schema";
import type { ContextMenuData } from "../../types/sidebar";

export const Sidebar = () => {
  const { t } = useTranslation();
  const { currentTheme } = useTheme();
  const isDarkTheme = !currentTheme?.id?.includes("-light");
  const {
    activeConnectionId,
    activeDriver,
    activeTable,
    setActiveTable,
    tables,
    isLoadingTables,
    refreshTables,
    activeConnectionName,
    activeDatabaseName,
  } = useDatabase();
  const { queries, deleteQuery, updateQuery } = useSavedQueries();
  const navigate = useNavigate();
  const location = useLocation();
  const [schemaVersion, setSchemaVersion] = useState(0);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: string;
    id: string;
    label: string;
    data?: ContextMenuData;
  } | null>(null);
  const [schemaModalTable, setSchemaModalTable] = useState<string | null>(null);
  const [isCreateTableModalOpen, setIsCreateTableModalOpen] = useState(false);
  const [modifyColumnModal, setModifyColumnModal] = useState<{
    isOpen: boolean;
    tableName: string;
    column: TableColumn | null;
  }>({ isOpen: false, tableName: "", column: null });

  const [createIndexModal, setCreateIndexModal] = useState<{
    isOpen: boolean;
    tableName: string;
  }>({ isOpen: false, tableName: "" });
  const [createForeignKeyModal, setCreateForeignKeyModal] = useState<{
    isOpen: boolean;
    tableName: string;
  }>({ isOpen: false, tableName: "" });
  const [generateSQLModal, setGenerateSQLModal] = useState<string | null>(null);

  const [queriesOpen, setQueriesOpen] = useState(false);
  const [tablesOpen, setTablesOpen] = useState(true);
  const [queryModal, setQueryModal] = useState<{
    isOpen: boolean;
    query?: SavedQuery;
  }>({ isOpen: false });
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);
  const [isMcpModalOpen, setIsMcpModalOpen] = useState(false);
  const [isDumpModalOpen, setIsDumpModalOpen] = useState(false);
  const [importModal, setImportModal] = useState<{
    isOpen: boolean;
    filePath: string;
  }>({ isOpen: false, filePath: "" });
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);

  // Resize Hook
  const { sidebarWidth, startResize } = useSidebarResize();

  const getQuote = () =>
    activeDriver === "mysql" || activeDriver === "mariadb" ? "`" : '"';

  const runQuery = (sql: string, queryName?: string, tableName?: string) => {
    navigate("/editor", {
      state: { initialQuery: sql, queryName, tableName },
    });
  };

  const handleTableClick = (tableName: string) => {
    setActiveTable(tableName);
  };

  const handleOpenTable = (tableName: string) => {
    const q = getQuote();
    navigate("/editor", {
      state: {
        initialQuery: `SELECT * FROM ${q}${tableName}${q}`,
        tableName: tableName,
      },
    });
  };

  const handleContextMenu = (
    e: React.MouseEvent,
    type: string,
    id: string,
    label: string,
    data?: ContextMenuData,
  ) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type, id, label, data });
  };

  const handleImportDatabase = async () => {
    const file = await open({
      filters: [
        { name: "SQL / Zip File", extensions: ["sql", "zip"] },
      ],
    });
    if (file && typeof file === "string") {
      const confirmed = await ask(
        t("dump.confirmImport", { file: file.split(/[\\/]/).pop() }),
        {
          title: t("dump.importDatabase"),
          kind: "warning",
        },
      );

      if (!confirmed) return;

      setImportModal({ isOpen: true, filePath: file });
    }
  };

  return (
    <div className="flex h-full">
      {/* Primary Navigation Bar (Narrow) */}
      <aside className="w-16 bg-elevated border-r border-default flex flex-col items-center py-4 z-20">
        <div className="mb-8 " title="tabularis">
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
            icon={Database}
            label={t("sidebar.connections")}
            isConnected={!!activeConnectionId}
          />
          {activeConnectionId && (
            <NavItem
              to="/editor"
              icon={Terminal}
              label={t("sidebar.sqlEditor")}
            />
          )}
        </nav>

        <div className="mt-auto">
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

      {/* Secondary Sidebar (Schema Explorer) - Only visible when connected and not in settings or home */}
      {activeConnectionId &&
        location.pathname !== "/settings" &&
        location.pathname !== "/" &&
        !isExplorerCollapsed && (
          <aside
            className="bg-base border-r border-default flex flex-col relative shrink-0"
            style={{ width: sidebarWidth }}
          >
            {/* Resize Handle */}
            <div
              onMouseDown={startResize}
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 z-50 transition-colors"
            />

            <div className="p-4 border-b border-default font-semibold text-sm text-primary flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Database size={16} className="text-blue-400" />
                <span>{t("sidebar.explorer")}</span>
              </div>
              <div className="flex items-center gap-1">
                {/* Show dropdown button when sidebar is narrow */}
                {sidebarWidth < 200 ? (
                  <div className="relative">
                    <button
                      onClick={() => setIsActionsDropdownOpen(!isActionsDropdownOpen)}
                      className="text-muted hover:text-secondary transition-colors p-1 hover:bg-surface-secondary rounded"
                      title={t("sidebar.actions")}
                    >
                      <ChevronDown size={16} />
                    </button>
                    {isActionsDropdownOpen && (
                      <>
                        {/* Backdrop to close dropdown */}
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setIsActionsDropdownOpen(false)}
                        />
                        {/* Dropdown menu */}
                        <div className="absolute left-0 top-8 bg-elevated border border-default rounded-lg shadow-lg z-50 py-1 min-w-[200px]">
                          <button
                            onClick={() => {
                              handleImportDatabase();
                              setIsActionsDropdownOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-secondary hover:bg-surface-secondary hover:text-primary transition-colors text-left whitespace-nowrap"
                          >
                            <Upload size={16} className="text-green-400 shrink-0" />
                            <span>{t("dump.importDatabase")}</span>
                          </button>
                          <button
                            onClick={() => {
                              setIsDumpModalOpen(true);
                              setIsActionsDropdownOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-secondary hover:bg-surface-secondary hover:text-primary transition-colors text-left whitespace-nowrap"
                          >
                            <Download size={16} className="text-blue-400 shrink-0" />
                            <span>{t("dump.dumpDatabase")}</span>
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await invoke("open_er_diagram_window", {
                                  connectionId: activeConnectionId || "",
                                  connectionName: activeConnectionName || "Unknown",
                                  databaseName: activeDatabaseName || "Unknown",
                                });
                              } catch (e) {
                                console.error("Failed to open ER Diagram window:", e);
                              }
                              setIsActionsDropdownOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-secondary hover:bg-surface-secondary hover:text-primary transition-colors text-left whitespace-nowrap"
                          >
                            <Network size={16} className="rotate-90 text-orange-400 shrink-0" />
                            <span>View Schema Diagram</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Show inline icons when sidebar is wide enough */}
                    <button
                      onClick={handleImportDatabase}
                      className="text-muted hover:text-green-400 transition-colors p-1 hover:bg-surface-secondary rounded"
                      title={t("dump.importDatabase")}
                    >
                      <Upload size={16} />
                    </button>
                    <button
                      onClick={() => setIsDumpModalOpen(true)}
                      className="text-muted hover:text-blue-400 transition-colors p-1 hover:bg-surface-secondary rounded"
                      title={t("dump.dumpDatabase")}
                    >
                      <Download size={16} />
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await invoke("open_er_diagram_window", {
                            connectionId: activeConnectionId || "",
                            connectionName: activeConnectionName || "Unknown",
                            databaseName: activeDatabaseName || "Unknown",
                          });
                        } catch (e) {
                          console.error("Failed to open ER Diagram window:", e);
                        }
                      }}
                      className="text-muted hover:text-orange-400 transition-colors p-1 hover:bg-surface-secondary rounded"
                      title="View Schema Diagram"
                    >
                      <Network size={16} className="rotate-90" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setIsExplorerCollapsed(true)}
                  className="text-muted hover:text-secondary transition-colors p-1 hover:bg-surface-secondary rounded"
                  title="Collapse Explorer"
                >
                  <PanelLeftClose size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {isLoadingTables ? (
                <div className="flex items-center justify-center h-20 text-muted gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">{t("sidebar.loadingSchema")}</span>
                </div>
              ) : (
                <>
                  {/* Saved Queries */}
                  <Accordion
                    title={`${t("sidebar.savedQueries")} (${queries.length})`}
                    isOpen={queriesOpen}
                    onToggle={() => setQueriesOpen(!queriesOpen)}
                  >
                    {queries.length === 0 ? (
                      <div className="text-center p-2 text-xs text-muted italic">
                        {t("sidebar.noSavedQueries")}
                      </div>
                    ) : (
                      <div>
                        {queries.map((q) => (
                          <div
                            key={q.id}
                            onClick={() => runQuery(q.sql, q.name)}
                            onContextMenu={(e) =>
                              handleContextMenu(e, "query", q.id, q.name, q)
                            }
                            className="flex items-center gap-2 px-3 py-1.5 text-sm text-secondary hover:bg-surface-secondary hover:text-primary cursor-pointer group transition-colors"
                            title={q.name}
                          >
                            <FileCode
                              size={14}
                              className="text-green-500 shrink-0"
                            />
                            <span className="truncate">{q.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Accordion>

                  {/* Tables */}
                  <Accordion
                    title={`${t("sidebar.tables")} (${tables.length})`}
                    isOpen={tablesOpen}
                    onToggle={() => setTablesOpen(!tablesOpen)}
                    actions={
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (refreshTables) refreshTables();
                          }}
                          className="p-1 rounded hover:bg-surface-secondary text-muted hover:text-primary transition-colors"
                          title={t("sidebar.refreshTables") || "Refresh Tables"}
                        >
                          <RefreshCw size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsCreateTableModalOpen(true);
                          }}
                          className="p-1 rounded hover:bg-surface-secondary text-muted hover:text-primary transition-colors"
                          title="Create New Table"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    }
                  >
                    {tables.length === 0 ? (
                      <div className="text-center p-2 text-xs text-muted italic">
                        {t("sidebar.noTables")}
                      </div>
                    ) : (
                      <div>
                        {tables.map((table) => (
                          <SidebarTableItem
                            key={table.name}
                            table={table}
                            activeTable={activeTable}
                            onTableClick={handleTableClick}
                            onTableDoubleClick={handleOpenTable}
                            onContextMenu={handleContextMenu}
                            connectionId={activeConnectionId!}
                            driver={activeDriver!}
                            onAddColumn={(t_name) =>
                              setModifyColumnModal({
                                isOpen: true,
                                tableName: t_name,
                                column: null,
                              })
                            }
                            onEditColumn={(t_name, c) =>
                              setModifyColumnModal({
                                isOpen: true,
                                tableName: t_name,
                                column: c,
                              })
                            }
                            onAddIndex={(t_name) =>
                              setCreateIndexModal({
                                isOpen: true,
                                tableName: t_name,
                              })
                            }
                            onDropIndex={async (t_name, name) => {
                              if (
                                await ask(
                                  t("sidebar.deleteIndexConfirm", { name }),
                                  {
                                    title: t("sidebar.deleteIndex"),
                                    kind: "warning",
                                  },
                                )
                              ) {
                                const q =
                                  activeDriver === "mysql" ||
                                  activeDriver === "mariadb"
                                    ? `DROP INDEX \`${name}\` ON \`${t_name}\``
                                    : `DROP INDEX "${name}"`;
                                await invoke("execute_query", {
                                  connectionId: activeConnectionId,
                                  query: q,
                                }).catch(console.error);
                                setSchemaVersion((v) => v + 1);
                              }
                            }}
                            onAddForeignKey={(t_name) =>
                              setCreateForeignKeyModal({
                                isOpen: true,
                                tableName: t_name,
                              })
                            }
                            onDropForeignKey={async (t_name, name) => {
                              if (
                                await ask(
                                  t("sidebar.deleteFkConfirm", { name }),
                                  {
                                    title: t("sidebar.deleteFk"),
                                    kind: "warning",
                                  },
                                )
                              ) {
                                if (activeDriver === "sqlite") {
                                  await message(t("sidebar.sqliteFkError"), {
                                    kind: "error",
                                  });
                                  return;
                                }
                                const q =
                                  activeDriver === "mysql" ||
                                  activeDriver === "mariadb"
                                    ? `ALTER TABLE \`${t_name}\` DROP FOREIGN KEY \`${name}\``
                                    : `ALTER TABLE "${t_name}" DROP CONSTRAINT "${name}"`;
                                await invoke("execute_query", {
                                  connectionId: activeConnectionId,
                                  query: q,
                                }).catch(console.error);
                                setSchemaVersion((v) => v + 1);
                              }
                            }}
                            schemaVersion={schemaVersion}
                          />
                        ))}
                      </div>
                    )}
                  </Accordion>
                </>
              )}
            </div>
          </aside>
        )}

      {/* Collapsed Explorer (Icon only) */}
      {activeConnectionId &&
        location.pathname !== "/settings" &&
        location.pathname !== "/" &&
        isExplorerCollapsed && (
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

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={
            contextMenu.type === "table"
              ? [
                  {
                    label: t("sidebar.showData"),
                    icon: PlaySquare,
                    action: () => {
                      const q = getQuote();
                      runQuery(
                        `SELECT * FROM ${q}${contextMenu.id}${q}`,
                        undefined,
                        contextMenu.id,
                      );
                    },
                  },
                  {
                    label: t("sidebar.countRows"),
                    icon: Hash,
                    action: () => {
                      const q = getQuote();
                      // Don't pass tableName for aggregate queries - let extractTableName handle it
                      runQuery(
                        `SELECT COUNT(*) as count FROM ${q}${contextMenu.id}${q}`,
                      );
                    },
                  },
                  {
                    label: t("sidebar.viewSchema"),
                    icon: FileText,
                    action: () => setSchemaModalTable(contextMenu.id),
                  },
                  {
                    label: t("sidebar.generateSQL"),
                    icon: FileCode,
                    action: () => setGenerateSQLModal(contextMenu.id),
                  },
                  {
                    label: t("sidebar.copyName"),
                    icon: Copy,
                    action: () => navigator.clipboard.writeText(contextMenu.id),
                  },
                  {
                    label: t("sidebar.addColumn"),
                    icon: Plus,
                    action: () =>
                      setModifyColumnModal({
                        isOpen: true,
                        tableName: contextMenu.id,
                        column: null,
                      }),
                  },
                  {
                    label: t("sidebar.deleteTable"),
                    icon: Trash2,
                    danger: true,
                    action: async () => {
                      const q = getQuote();
                      if (
                        await ask(
                          t("sidebar.deleteTableConfirm", {
                            table: contextMenu.id,
                          }),
                          { title: t("sidebar.deleteTable"), kind: "warning" },
                        )
                      ) {
                        try {
                          await invoke("execute_query", {
                            connectionId: activeConnectionId,
                            query: `DROP TABLE ${q}${contextMenu.id}${q}`,
                          });
                          if (refreshTables) refreshTables();
                        } catch (e) {
                          console.error(e);
                          await message(t("sidebar.failDeleteTable") + String(e), {
                            kind: "error",
                          });
                        }
                      }
                    },
                  },
                ]
              : contextMenu.type === "index"
                ? [
                    {
                      label: t("sidebar.copyName"),
                      icon: Copy,
                      action: () =>
                        navigator.clipboard.writeText(contextMenu.id),
                    },
                    {
                      label: t("sidebar.deleteIndex"),
                      icon: Trash2,
                      danger: true,
                      action: async () => {
                        if (
                          contextMenu.data &&
                          "tableName" in contextMenu.data
                        ) {
                          const t_name = contextMenu.data.tableName;
                          if (
                            await ask(
                              t("sidebar.deleteIndexConfirm", {
                                name: contextMenu.id,
                              }),
                              {
                                title: t("sidebar.deleteIndex"),
                                kind: "warning",
                              },
                            )
                          ) {
                            try {
                              const q =
                                activeDriver === "mysql" ||
                                activeDriver === "mariadb"
                                  ? `DROP INDEX \`${contextMenu.id}\` ON \`${t_name}\``
                                  : `DROP INDEX "${contextMenu.id}"`;

                              await invoke("execute_query", {
                                connectionId: activeConnectionId,
                                query: q,
                              });

                              setSchemaVersion((v) => v + 1);
                            } catch (e) {
                              await message(
                                t("sidebar.failDeleteIndex") + String(e),
                                {
                                  title: t("common.error"),
                                  kind: "error",
                                },
                              );
                            }
                          }
                        }
                      },
                    },
                  ]
                : contextMenu.type === "foreign_key"
                  ? [
                      {
                        label: t("sidebar.copyName"),
                        icon: Copy,
                        action: () =>
                          navigator.clipboard.writeText(contextMenu.id),
                      },
                      {
                        label: t("sidebar.deleteFk"),
                        icon: Trash2,
                        danger: true,
                        action: async () => {
                          if (
                            contextMenu.data &&
                            "tableName" in contextMenu.data
                          ) {
                            const t_name = contextMenu.data.tableName;
                            if (
                              await ask(
                                t("sidebar.deleteFkConfirm", {
                                  name: contextMenu.id,
                                }),
                                {
                                  title: t("sidebar.deleteFk"),
                                  kind: "warning",
                                },
                              )
                            ) {
                              if (activeDriver === "sqlite") {
                                await message(t("sidebar.sqliteFkError"), {
                                  kind: "error",
                                });
                                return;
                              }
                              const q =
                                activeDriver === "mysql" ||
                                activeDriver === "mariadb"
                                  ? `ALTER TABLE \`${t_name}\` DROP FOREIGN KEY \`${contextMenu.id}\``
                                  : `ALTER TABLE "${t_name}" DROP CONSTRAINT "${contextMenu.id}"`;
                              await invoke("execute_query", {
                                connectionId: activeConnectionId,
                                query: q,
                              }).catch(console.error);
                            }
                          }
                        },
                      },
                    ]
                  : contextMenu.type === "folder_indexes"
                    ? [
                        {
                          label: t("sidebar.addIndex"),
                          icon: Plus,
                          action: () => {
                            if (
                              contextMenu.data &&
                              "tableName" in contextMenu.data
                            ) {
                              setCreateIndexModal({
                                isOpen: true,
                                tableName: contextMenu.data.tableName,
                              });
                            }
                          },
                        },
                      ]
                    : contextMenu.type === "folder_fks"
                      ? [
                          {
                            label: t("sidebar.addFk"),
                            icon: Plus,
                            action: () => {
                              if (
                                contextMenu.data &&
                                "tableName" in contextMenu.data
                              ) {
                                setCreateForeignKeyModal({
                                  isOpen: true,
                                  tableName: contextMenu.data.tableName,
                                });
                              }
                            },
                          },
                        ]
                      : [
                          // Saved Query Actions (Default fallback)
                          {
                            label: t("sidebar.execute"),
                            icon: Play,
                            action: () => {
                              if (
                                contextMenu.data &&
                                "sql" in contextMenu.data
                              ) {
                                runQuery(
                                  contextMenu.data.sql,
                                  contextMenu.data.name,
                                );
                              }
                            },
                          },
                          {
                            label: t("sidebar.edit"),
                            icon: Edit,
                            action: () => {
                              if (
                                contextMenu.data &&
                                "sql" in contextMenu.data
                              ) {
                                setQueryModal({
                                  isOpen: true,
                                  query: contextMenu.data as SavedQuery,
                                });
                              }
                            },
                          },
                          {
                            label: t("sidebar.delete"),
                            icon: Trash2,
                            action: async () => {
                              const confirmed = await ask(
                                t("sidebar.confirmDeleteQuery", {
                                  name: contextMenu.label,
                                }),
                                {
                                  title: t("sidebar.confirmDeleteTitle"),
                                  kind: "warning",
                                },
                              );
                              if (confirmed) {
                                deleteQuery(contextMenu.id);
                              }
                            },
                          },
                        ]
          }
        />
      )}

      {schemaModalTable && (
        <SchemaModal
          isOpen={true}
          tableName={schemaModalTable}
          onClose={() => setSchemaModalTable(null)}
        />
      )}

      {isCreateTableModalOpen && (
        <CreateTableModal
          isOpen={isCreateTableModalOpen}
          onClose={() => setIsCreateTableModalOpen(false)}
          onSuccess={() => {
            if (refreshTables) refreshTables();
          }}
        />
      )}

      {queryModal.isOpen && (
        <QueryModal
          isOpen={queryModal.isOpen}
          onClose={() => setQueryModal({ isOpen: false })}
          title={queryModal.query ? "Edit Query" : "Save Query"}
          initialName={queryModal.query?.name}
          initialSql={queryModal.query?.sql}
          onSave={async (name: string, sql: string) => {
            if (queryModal.query) {
              await updateQuery(queryModal.query.id, name, sql);
            }
          }}
        />
      )}

      {modifyColumnModal.isOpen && activeConnectionId && (
        <ModifyColumnModal
          isOpen={modifyColumnModal.isOpen}
          onClose={() =>
            setModifyColumnModal({ ...modifyColumnModal, isOpen: false })
          }
          onSuccess={() => {
            setSchemaVersion((v) => v + 1);
          }}
          connectionId={activeConnectionId}
          tableName={modifyColumnModal.tableName}
          driver={activeDriver || "sqlite"}
          column={modifyColumnModal.column}
        />
      )}
      {createIndexModal.isOpen && activeConnectionId && (
        <CreateIndexModal
          isOpen={createIndexModal.isOpen}
          onClose={() =>
            setCreateIndexModal({ ...createIndexModal, isOpen: false })
          }
          onSuccess={() => {
            setSchemaVersion((v) => v + 1);
          }}
          connectionId={activeConnectionId}
          tableName={createIndexModal.tableName}
          driver={activeDriver || "sqlite"}
        />
      )}

      {createForeignKeyModal.isOpen && activeConnectionId && (
        <CreateForeignKeyModal
          isOpen={createForeignKeyModal.isOpen}
          onClose={() =>
            setCreateForeignKeyModal({
              ...createForeignKeyModal,
              isOpen: false,
            })
          }
          onSuccess={() => {
            setSchemaVersion((v) => v + 1);
          }}
          connectionId={activeConnectionId}
          tableName={createForeignKeyModal.tableName}
          driver={activeDriver || "sqlite"}
        />
      )}

      {isMcpModalOpen && (
        <McpModal
          isOpen={isMcpModalOpen}
          onClose={() => setIsMcpModalOpen(false)}
        />
      )}

      {generateSQLModal && (
        <GenerateSQLModal
          isOpen={true}
          tableName={generateSQLModal}
          onClose={() => setGenerateSQLModal(null)}
        />
      )}

      {isDumpModalOpen && activeConnectionId && (
        <DumpDatabaseModal
          isOpen={isDumpModalOpen}
          onClose={() => setIsDumpModalOpen(false)}
          connectionId={activeConnectionId}
          databaseName={activeDatabaseName || "Database"}
          tables={tables.map((t) => t.name)}
        />
      )}

      {importModal.isOpen && activeConnectionId && (
        <ImportDatabaseModal
          isOpen={importModal.isOpen}
          onClose={() => setImportModal({ isOpen: false, filePath: "" })}
          connectionId={activeConnectionId}
          databaseName={activeDatabaseName || "Database"}
          filePath={importModal.filePath}
          onSuccess={() => {
            if (refreshTables) refreshTables();
          }}
        />
      )}
    </div>
  );
};
