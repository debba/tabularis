import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { quoteIdentifier, quoteTableRef } from "../../utils/identifiers";
import { invoke } from "@tauri-apps/api/core";
import { DISCORD_URL } from "../../config/links";
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
  ChevronRight,
  Settings2,
  Check,
  CheckSquare,
  Square,
} from "lucide-react";
import { DiscordIcon } from "../icons/DiscordIcon";
import { ask, message, open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useDatabase } from "../../hooks/useDatabase";
import { useTheme } from "../../hooks/useTheme";
import { useSavedQueries } from "../../hooks/useSavedQueries";
import type { SavedQuery } from "../../contexts/SavedQueriesContext";
import { ContextMenu } from "../ui/ContextMenu";
import { SchemaModal } from "../modals/SchemaModal";
import { CreateTableModal } from "../modals/CreateTableModal";
import { QueryModal } from "../modals/QueryModal";
import { ModifyColumnModal } from "../modals/ModifyColumnModal";
import { CreateIndexModal } from "../modals/CreateIndexModal";
import { CreateForeignKeyModal } from "../modals/CreateForeignKeyModal";
import { GenerateSQLModal } from "../modals/GenerateSQLModal";
import { McpModal } from "../modals/McpModal";
import { DumpDatabaseModal } from "../modals/DumpDatabaseModal";
import { ImportDatabaseModal } from "../modals/ImportDatabaseModal";
import { ViewEditorModal } from "../modals/ViewEditorModal";

// Sub-components
import { NavItem } from "./sidebar/NavItem";
import { Accordion } from "./sidebar/Accordion";
import { SidebarTableItem } from "./sidebar/SidebarTableItem";
import { SidebarViewItem } from "./sidebar/SidebarViewItem";
import { SidebarRoutineItem } from "./sidebar/SidebarRoutineItem";
import { SidebarSchemaItem } from "./sidebar/SidebarSchemaItem";

// Hooks & Types
import { useSidebarResize } from "../../hooks/useSidebarResize";
import type { TableColumn } from "../../types/schema";
import type { ContextMenuData } from "../../types/sidebar";
import type { RoutineInfo } from "../../contexts/DatabaseContext";
import { groupRoutinesByType } from "../../utils/routines";

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
    views,
    routines,
    isLoadingTables,
    refreshTables,
    refreshViews,
    refreshRoutines,
    activeConnectionName,
    activeDatabaseName,
    // Schema support (PostgreSQL)
    schemas,
    isLoadingSchemas,
    schemaDataMap,
    activeSchema,
    loadSchemaData,
    refreshSchemaData,
    selectedSchemas,
    setSelectedSchemas,
    needsSchemaSelection,
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
  const [schemaModal, setSchemaModal] = useState<{ tableName: string; schema?: string } | null>(null);
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
  const [viewsOpen, setViewsOpen] = useState(true);
  const [routinesOpen, setRoutinesOpen] = useState(false);
  const [functionsOpen, setFunctionsOpen] = useState(true);
  const [proceduresOpen, setProceduresOpen] = useState(true);
  const [activeView, setActiveView] = useState<string | null>(null);
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
  const [isSchemaFilterOpen, setIsSchemaFilterOpen] = useState(false);
  const [pendingSchemaSelection, setPendingSchemaSelection] = useState<Set<string>>(new Set());
  const [viewEditorModal, setViewEditorModal] = useState<{
    isOpen: boolean;
    viewName?: string;
    isNewView?: boolean;
  }>({ isOpen: false });

  // Resize Hook
  const { sidebarWidth, startResize } = useSidebarResize();

  const groupedRoutines = routines ? groupRoutinesByType(routines) : { procedures: [], functions: [] };

  const runQuery = (sql: string, queryName?: string, tableName?: string, preventAutoRun: boolean = false, schema?: string) => {
    navigate("/editor", {
      state: { initialQuery: sql, queryName, tableName, preventAutoRun, schema },
    });
  };

  const handleTableClick = (tableName: string, schema?: string) => {
    setActiveTable(tableName, schema);
  };

  const handleOpenTable = (tableName: string, schema?: string) => {
    if (schema) {
      setActiveTable(tableName, schema);
    }
    const quotedTable = quoteTableRef(tableName, activeDriver, schema);
    navigate("/editor", {
      state: {
        initialQuery: `SELECT * FROM ${quotedTable}`,
        tableName: tableName,
        schema,
      },
    });
  };

  const handleViewClick = (viewName: string) => {
    setActiveView(viewName);
  };

  const handleOpenView = (viewName: string, schema?: string) => {
    const quotedView = quoteTableRef(viewName, activeDriver, schema);
    navigate("/editor", {
      state: {
        initialQuery: `SELECT * FROM ${quotedView}`,
        tableName: viewName,
        schema,
      },
    });
  };

  const handleRoutineDoubleClick = async (routine: RoutineInfo, schema?: string) => {
    try {
      const definition = await invoke<string>("get_routine_definition", {
        connectionId: activeConnectionId,
        routineName: routine.name,
        routineType: routine.routine_type,
        ...(schema ? { schema } : {}),
      });
      runQuery(definition, `${routine.name} Definition`, undefined, true);
    } catch (e) {
      console.error(e);
      await message(
        t("sidebar.failGetRoutineDefinition") + String(e),
        {
          kind: "error",
        }
      );
    }
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
      filters: [{ name: "SQL / Zip File", extensions: ["sql", "zip"] }],
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
                      onClick={() =>
                        setIsActionsDropdownOpen(!isActionsDropdownOpen)
                      }
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
                            <Upload
                              size={16}
                              className="text-green-400 shrink-0"
                            />
                            <span>{t("dump.importDatabase")}</span>
                          </button>
                          <button
                            onClick={() => {
                              setIsDumpModalOpen(true);
                              setIsActionsDropdownOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-secondary hover:bg-surface-secondary hover:text-primary transition-colors text-left whitespace-nowrap"
                          >
                            <Download
                              size={16}
                              className="text-blue-400 shrink-0"
                            />
                            <span>{t("dump.dumpDatabase")}</span>
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await invoke("open_er_diagram_window", {
                                  connectionId: activeConnectionId || "",
                                  connectionName:
                                    activeConnectionName || "Unknown",
                                  databaseName: activeDatabaseName || "Unknown",
                                  ...(activeSchema ? { schema: activeSchema } : {}),
                                });
                              } catch (e) {
                                console.error(
                                  "Failed to open ER Diagram window:",
                                  e,
                                );
                              }
                              setIsActionsDropdownOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-secondary hover:bg-surface-secondary hover:text-primary transition-colors text-left whitespace-nowrap"
                          >
                            <Network
                              size={16}
                              className="rotate-90 text-orange-400 shrink-0"
                            />
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
                            ...(activeSchema ? { schema: activeSchema } : {}),
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
              {(isLoadingTables || isLoadingSchemas) ? (
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

                  {/* PostgreSQL: Schema tree layout */}
                  {activeDriver === "postgres" && schemas.length > 0 ? (
                    <div>
                      {needsSchemaSelection ? (
                        /* Schema picker (first connect, no saved preference) */
                        <div className="px-3 py-2">
                          <div className="text-xs font-semibold uppercase text-muted tracking-wider mb-2">
                            {t("sidebar.schemas")}
                          </div>
                          <div className="text-xs text-secondary mb-2">
                            {t("sidebar.selectSchemasHint")}
                          </div>
                          <div className="border border-default rounded-lg overflow-hidden mb-2">
                            <div className="max-h-[200px] overflow-y-auto py-1">
                              {schemas.map((schemaName) => {
                                const isSelected = pendingSchemaSelection.has(schemaName);
                                return (
                                  <div
                                    key={schemaName}
                                    onClick={() => {
                                      const next = new Set(pendingSchemaSelection);
                                      if (isSelected) {
                                        next.delete(schemaName);
                                      } else {
                                        next.add(schemaName);
                                      }
                                      setPendingSchemaSelection(next);
                                    }}
                                    className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${
                                      isSelected
                                        ? "text-primary hover:bg-surface-secondary"
                                        : "text-muted hover:bg-surface-secondary"
                                    }`}
                                  >
                                    <div
                                      className={`w-4 h-4 flex items-center justify-center shrink-0 ${
                                        isSelected ? "text-blue-500" : "text-muted"
                                      }`}
                                    >
                                      {isSelected ? (
                                        <CheckSquare size={14} />
                                      ) : (
                                        <Square size={14} />
                                      )}
                                    </div>
                                    <span className="text-sm truncate select-none">
                                      {schemaName}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                if (pendingSchemaSelection.size === schemas.length) {
                                  setPendingSchemaSelection(new Set());
                                } else {
                                  setPendingSchemaSelection(new Set(schemas));
                                }
                              }}
                              className="text-xs text-blue-500 hover:underline"
                            >
                              {pendingSchemaSelection.size === schemas.length
                                ? t("sidebar.deselectAll")
                                : t("sidebar.selectAll")}
                            </button>
                            <button
                              onClick={() => {
                                if (pendingSchemaSelection.size > 0) {
                                  setSelectedSchemas(Array.from(pendingSchemaSelection));
                                  setPendingSchemaSelection(new Set());
                                }
                              }}
                              disabled={pendingSchemaSelection.size === 0}
                              className={`ml-auto flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors ${
                                pendingSchemaSelection.size > 0
                                  ? "bg-blue-500 text-white hover:bg-blue-600"
                                  : "bg-surface-secondary text-muted cursor-not-allowed"
                              }`}
                            >
                              <Check size={12} />
                              {t("sidebar.confirmSelection")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Schema selection header */}
                          <div className="flex items-center justify-between px-3 py-1.5">
                            <span className="text-xs font-semibold uppercase text-muted tracking-wider">
                              {t("sidebar.schemas")} ({selectedSchemas.length}/{schemas.length})
                            </span>
                            <div className="relative">
                              <button
                                onClick={() => {
                                  setPendingSchemaSelection(new Set(selectedSchemas));
                                  setIsSchemaFilterOpen(!isSchemaFilterOpen);
                                }}
                                className={`p-1 rounded transition-colors ${
                                  selectedSchemas.length < schemas.length
                                    ? "text-blue-400 hover:text-blue-300 bg-blue-500/10"
                                    : "text-muted hover:text-secondary hover:bg-surface-secondary"
                                }`}
                                title={t("sidebar.editSchemas")}
                              >
                                <Settings2 size={14} />
                              </button>
                              {isSchemaFilterOpen && (
                                <>
                                  <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setIsSchemaFilterOpen(false)}
                                  />
                                  <div className="absolute right-0 top-8 bg-elevated border border-default rounded-lg shadow-lg z-50 py-2 min-w-[200px] max-h-[300px] flex flex-col">
                                    <div className="flex items-center justify-between px-3 pb-2 border-b border-default">
                                      <span className="text-xs font-semibold text-secondary">
                                        {t("sidebar.editSchemas")}
                                      </span>
                                      <button
                                        onClick={() => {
                                          if (pendingSchemaSelection.size === schemas.length) {
                                            setPendingSchemaSelection(new Set());
                                          } else {
                                            setPendingSchemaSelection(new Set(schemas));
                                          }
                                        }}
                                        className="text-xs text-blue-500 hover:underline"
                                      >
                                        {pendingSchemaSelection.size === schemas.length
                                          ? t("sidebar.deselectAll")
                                          : t("sidebar.selectAll")}
                                      </button>
                                    </div>
                                    <div className="overflow-y-auto py-1">
                                      {schemas.map((schemaName) => {
                                        const isSelected = pendingSchemaSelection.has(schemaName);
                                        return (
                                          <div
                                            key={schemaName}
                                            onClick={() => {
                                              const next = new Set(pendingSchemaSelection);
                                              if (isSelected) {
                                                next.delete(schemaName);
                                              } else {
                                                next.add(schemaName);
                                              }
                                              setPendingSchemaSelection(next);
                                            }}
                                            className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${
                                              isSelected
                                                ? "text-primary hover:bg-surface-secondary"
                                                : "text-muted hover:bg-surface-secondary"
                                            }`}
                                          >
                                            <div
                                              className={`w-4 h-4 flex items-center justify-center shrink-0 ${
                                                isSelected ? "text-blue-500" : "text-muted"
                                              }`}
                                            >
                                              {isSelected ? (
                                                <CheckSquare size={14} />
                                              ) : (
                                                <Square size={14} />
                                              )}
                                            </div>
                                            <span className="text-sm truncate select-none">
                                              {schemaName}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="px-3 pt-2 border-t border-default">
                                      <button
                                        onClick={() => {
                                          if (pendingSchemaSelection.size > 0) {
                                            setSelectedSchemas(Array.from(pendingSchemaSelection));
                                          }
                                          setIsSchemaFilterOpen(false);
                                        }}
                                        disabled={pendingSchemaSelection.size === 0}
                                        className={`w-full flex items-center justify-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors ${
                                          pendingSchemaSelection.size > 0
                                            ? "bg-blue-500 text-white hover:bg-blue-600"
                                            : "bg-surface-secondary text-muted cursor-not-allowed"
                                        }`}
                                      >
                                        <Check size={12} />
                                        {t("sidebar.confirmSelection")}
                                      </button>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                          {selectedSchemas.map((schemaName) => (
                        <SidebarSchemaItem
                          key={schemaName}
                          schemaName={schemaName}
                          schemaData={schemaDataMap[schemaName]}
                          activeTable={activeTable}
                          activeSchema={activeSchema}
                          connectionId={activeConnectionId!}
                          driver={activeDriver!}
                          schemaVersion={schemaVersion}
                          onLoadSchema={loadSchemaData}
                          onRefreshSchema={refreshSchemaData}
                          onTableClick={(name, schema) => handleTableClick(name, schema)}
                          onTableDoubleClick={(name, schema) => handleOpenTable(name, schema)}
                          onViewClick={handleViewClick}
                          onViewDoubleClick={(name, schema) => handleOpenView(name, schema)}
                          onRoutineDoubleClick={(routine, schema) => handleRoutineDoubleClick(routine, schema)}
                          onContextMenu={handleContextMenu}
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
                          onDropIndex={async (_t_name, name) => {
                            if (
                              await ask(
                                t("sidebar.deleteIndexConfirm", { name }),
                                {
                                  title: t("sidebar.deleteIndex"),
                                  kind: "warning",
                                },
                              )
                            ) {
                              const q = `DROP INDEX ${quoteTableRef(name, activeDriver, schemaName)}`;
                              await invoke("execute_query", {
                                connectionId: activeConnectionId,
                                query: q,
                                ...(schemaName ? { schema: schemaName } : {}),
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
                              const q = `ALTER TABLE ${quoteTableRef(t_name, activeDriver, schemaName)} DROP CONSTRAINT ${quoteIdentifier(
                                name,
                                activeDriver,
                              )}`;
                              await invoke("execute_query", {
                                connectionId: activeConnectionId,
                                query: q,
                                ...(schemaName ? { schema: schemaName } : {}),
                              }).catch(console.error);
                              setSchemaVersion((v) => v + 1);
                            }
                          }}
                          onCreateTable={() => setIsCreateTableModalOpen(true)}
                          onCreateView={() =>
                            setViewEditorModal({
                              isOpen: true,
                              isNewView: true,
                            })
                          }
                        />
                      ))}
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* MySQL/SQLite: Flat layout */}
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
                                        ? `DROP INDEX ${quoteIdentifier(name, activeDriver)} ON ${quoteTableRef(
                                            t_name,
                                            activeDriver,
                                          )}`
                                        : `DROP INDEX ${quoteIdentifier(name, activeDriver)}`;
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
                                        ? `ALTER TABLE ${quoteTableRef(t_name, activeDriver)} DROP FOREIGN KEY ${quoteIdentifier(
                                            name,
                                            activeDriver,
                                          )}`
                                        : `ALTER TABLE ${quoteTableRef(t_name, activeDriver)} DROP CONSTRAINT ${quoteIdentifier(
                                            name,
                                            activeDriver,
                                          )}`;
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

                      {/* Views */}
                      <Accordion
                        title={`${t("sidebar.views")} (${views.length})`}
                        isOpen={viewsOpen}
                        onToggle={() => setViewsOpen(!viewsOpen)}
                        actions={
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (refreshViews) refreshViews();
                              }}
                              className="p-1 rounded hover:bg-surface-secondary text-muted hover:text-primary transition-colors"
                              title={t("sidebar.refreshViews") || "Refresh Views"}
                            >
                              <RefreshCw size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewEditorModal({
                                  isOpen: true,
                                  isNewView: true,
                                });
                              }}
                              className="p-1 rounded hover:bg-surface-secondary text-muted hover:text-primary transition-colors"
                              title={t("sidebar.createView") || "Create New View"}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        }
                      >
                        {views.length === 0 ? (
                          <div className="text-center p-2 text-xs text-muted italic">
                            {t("sidebar.noViews")}
                          </div>
                        ) : (
                          <div>
                            {views.map((view) => (
                              <SidebarViewItem
                                key={view.name}
                                view={view}
                                activeView={activeView}
                                onViewClick={handleViewClick}
                                onViewDoubleClick={handleOpenView}
                                onContextMenu={handleContextMenu}
                                connectionId={activeConnectionId!}
                                driver={activeDriver!}
                              />
                            ))}
                          </div>
                        )}
                      </Accordion>

                      {/* Routines */}
                      {activeDriver !== "sqlite" && (
                        <Accordion
                          title={`${t("sidebar.routines")} (${routines.length})`}
                          isOpen={routinesOpen}
                          onToggle={() => setRoutinesOpen(!routinesOpen)}
                          actions={
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (refreshRoutines) refreshRoutines();
                                }}
                                className="p-1 rounded hover:bg-surface-secondary text-muted hover:text-primary transition-colors"
                                title={t("sidebar.refreshRoutines") || "Refresh Routines"}
                              >
                                <RefreshCw size={14} />
                              </button>
                            </div>
                          }
                        >
                          {routines.length === 0 ? (
                            <div className="text-center p-2 text-xs text-muted italic">
                              {t("sidebar.noRoutines")}
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              {/* Functions */}
                              {groupedRoutines.functions.length > 0 && (
                                <div className="mb-2">
                                  <button
                                    onClick={() => setFunctionsOpen(!functionsOpen)}
                                    className="flex items-center gap-1 px-2 py-1 w-full text-left text-xs font-semibold text-muted uppercase tracking-wider hover:text-secondary transition-colors"
                                  >
                                    {functionsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                    <span>{t("sidebar.functions")}</span>
                                    <span className="ml-auto text-[10px] opacity-50">{groupedRoutines.functions.length}</span>
                                  </button>

                                  {functionsOpen && groupedRoutines.functions.map((routine) => (
                                    <SidebarRoutineItem
                                      key={routine.name}
                                      routine={routine}
                                      connectionId={activeConnectionId!}
                                      onContextMenu={handleContextMenu}
                                      onDoubleClick={handleRoutineDoubleClick}
                                    />
                                  ))}
                                </div>
                              )}

                              {/* Procedures */}
                              {groupedRoutines.procedures.length > 0 && (
                                <div>
                                  <button
                                    onClick={() => setProceduresOpen(!proceduresOpen)}
                                    className="flex items-center gap-1 px-2 py-1 w-full text-left text-xs font-semibold text-muted uppercase tracking-wider hover:text-secondary transition-colors"
                                  >
                                    {proceduresOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                    <span>{t("sidebar.procedures")}</span>
                                    <span className="ml-auto text-[10px] opacity-50">{groupedRoutines.procedures.length}</span>
                                  </button>

                                  {proceduresOpen && groupedRoutines.procedures.map((routine) => (
                                    <SidebarRoutineItem
                                      key={routine.name}
                                      routine={routine}
                                      connectionId={activeConnectionId!}
                                      onContextMenu={handleContextMenu}
                                      onDoubleClick={handleRoutineDoubleClick}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </Accordion>
                      )}
                    </>
                  )}
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
              ? (() => {
                  const ctxSchema = contextMenu.data && "schema" in contextMenu.data ? contextMenu.data.schema : undefined;
                  return [
                  {
                    label: t("sidebar.showData"),
                    icon: PlaySquare,
                    action: () => {
                      const quotedTable = quoteTableRef(contextMenu.id, activeDriver, ctxSchema);
                      runQuery(
                        `SELECT * FROM ${quotedTable}`,
                        undefined,
                        contextMenu.id,
                        false,
                        ctxSchema,
                      );
                    },
                  },
                  {
                    label: t("sidebar.countRows"),
                    icon: Hash,
                    action: () => {
                      const quotedTable = quoteTableRef(contextMenu.id, activeDriver, ctxSchema);
                      // Don't pass tableName for aggregate queries - let extractTableName handle it
                      runQuery(
                        `SELECT COUNT(*) as count FROM ${quotedTable}`,
                        undefined,
                        undefined,
                        false,
                        ctxSchema,
                      );
                    },
                  },
                  {
                    label: t("sidebar.viewSchema"),
                    icon: FileText,
                    action: () => setSchemaModal({ tableName: contextMenu.id, schema: ctxSchema }),
                  },
                  {
                    label: t("sidebar.viewERDiagram"),
                    icon: Network,
                    action: async () => {
                      try {
                        await invoke("open_er_diagram_window", {
                          connectionId: activeConnectionId || "",
                          connectionName: activeConnectionName || "Unknown",
                          databaseName: activeDatabaseName || "Unknown",
                          focusTable: contextMenu.id,
                          ...(ctxSchema ? { schema: ctxSchema } : {}),
                        });
                      } catch (e) {
                        console.error("Failed to open ER Diagram window:", e);
                      }
                    },
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
                      const quotedTable = quoteTableRef(contextMenu.id, activeDriver, ctxSchema);
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
                            query: `DROP TABLE ${quotedTable}`,
                            ...(ctxSchema ? { schema: ctxSchema } : {}),
                          });
                          if (refreshTables) refreshTables();
                        } catch (e) {
                          console.error(e);
                          await message(
                            t("sidebar.failDeleteTable") + String(e),
                            {
                              kind: "error",
                            },
                          );
                        }
                      }
                    },
                  },
                ];
                })()
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
                          const ctxSchema =
                            "schema" in contextMenu.data ? contextMenu.data.schema : undefined;
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
                                  ? `DROP INDEX ${quoteIdentifier(contextMenu.id, activeDriver)} ON ${quoteTableRef(
                                      t_name,
                                      activeDriver,
                                      ctxSchema,
                                    )}`
                                  : `DROP INDEX ${quoteTableRef(contextMenu.id, activeDriver, ctxSchema)}`;

                              await invoke("execute_query", {
                                connectionId: activeConnectionId,
                                query: q,
                                ...(ctxSchema ? { schema: ctxSchema } : {}),
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
                          const ctxSchema =
                            "schema" in contextMenu.data ? contextMenu.data.schema : undefined;
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
                                ? `ALTER TABLE ${quoteTableRef(t_name, activeDriver, ctxSchema)} DROP FOREIGN KEY ${quoteIdentifier(
                                    contextMenu.id,
                                    activeDriver,
                                  )}`
                                : `ALTER TABLE ${quoteTableRef(t_name, activeDriver, ctxSchema)} DROP CONSTRAINT ${quoteIdentifier(
                                    contextMenu.id,
                                    activeDriver,
                                  )}`;
                            await invoke("execute_query", {
                              connectionId: activeConnectionId,
                              query: q,
                              ...(ctxSchema ? { schema: ctxSchema } : {}),
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
                      : contextMenu.type === "view"
                        ? (() => {
                            const viewCtxSchema = contextMenu.data && "schema" in contextMenu.data ? contextMenu.data.schema : undefined;
                            return [
                            {
                              label: t("sidebar.showData"),
                              icon: PlaySquare,
                              action: () => {
                                const quotedView = quoteTableRef(contextMenu.id, activeDriver, viewCtxSchema);
                                runQuery(
                                  `SELECT * FROM ${quotedView}`,
                                  undefined,
                                  contextMenu.id,
                                );
                              },
                            },
                            {
                              label: t("sidebar.countRows"),
                              icon: Hash,
                              action: () => {
                                const quotedView = quoteTableRef(contextMenu.id, activeDriver, viewCtxSchema);
                                runQuery(
                                  `SELECT COUNT(*) as count FROM ${quotedView}`,
                                );
                              },
                            },
                            {
                              label: t("sidebar.editView"),
                              icon: Edit,
                              action: () => {
                                setViewEditorModal({
                                  isOpen: true,
                                  viewName: contextMenu.id,
                                  isNewView: false,
                                });
                              },
                            },
                            {
                              label: t("sidebar.copyName"),
                              icon: Copy,
                              action: () =>
                                navigator.clipboard.writeText(contextMenu.id),
                            },
                            {
                              label: t("sidebar.dropView"),
                              icon: Trash2,
                              danger: true,
                              action: async () => {
                                if (
                                  await ask(
                                    t("sidebar.dropViewConfirm", {
                                      view: contextMenu.id,
                                    }),
                                    {
                                      title: t("sidebar.dropView"),
                                      kind: "warning",
                                    },
                                  )
                                ) {
                                  try {
                                    await invoke("drop_view", {
                                      connectionId: activeConnectionId,
                                      viewName: contextMenu.id,
                                      ...(activeSchema ? { schema: activeSchema } : {}),
                                    });
                                    if (refreshViews) refreshViews();
                                  } catch (e) {
                                    console.error(e);
                                    await message(
                                      t("sidebar.failDropView") + String(e),
                                      {
                                        kind: "error",
                                      },
                                    );
                                  }
                                }
                              },
                            },
                          ];
                          })()
                        : contextMenu.type === "routine"
                          ? [
                              {
                                label: t("sidebar.viewDefinition"),
                                icon: FileText,
                                action: async () => {
                                  try {
                                    const routineType = (contextMenu.data && 'routine_type' in contextMenu.data) 
                                      ? (contextMenu.data).routine_type 
                                      : "PROCEDURE";
                                      
                                    const definition = await invoke<string>("get_routine_definition", {
                                      connectionId: activeConnectionId,
                                      routineName: contextMenu.id,
                                      routineType: routineType,
                                      ...(activeSchema ? { schema: activeSchema } : {}),
                                    });
                                    // Show definition in modal or editor?
                                    // For now, let's open in editor as comment or just text
                                    runQuery(definition, `${contextMenu.id} Definition`, undefined, true);
                                  } catch (e) {
                                    console.error(e);
                                    await message(
                                      t("sidebar.failGetRoutineDefinition") + String(e),
                                      {
                                        kind: "error",
                                      }
                                    );
                                  }
                                },
                              },
                              {
                                label: t("sidebar.copyName"),
                                icon: Copy,
                                action: () =>
                                  navigator.clipboard.writeText(contextMenu.id),
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

      {schemaModal && (
        <SchemaModal
          isOpen={true}
          tableName={schemaModal.tableName}
          schema={schemaModal.schema}
          onClose={() => setSchemaModal(null)}
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

      {viewEditorModal.isOpen && activeConnectionId && (
        <ViewEditorModal
          isOpen={viewEditorModal.isOpen}
          onClose={() => setViewEditorModal({ isOpen: false })}
          connectionId={activeConnectionId}
          viewName={viewEditorModal.viewName}
          isNewView={viewEditorModal.isNewView}
          onSuccess={() => {
            if (refreshViews) refreshViews();
          }}
        />
      )}
    </div>
  );
};
