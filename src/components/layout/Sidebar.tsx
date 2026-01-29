import React, { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { McpModal } from "../modals/McpModal";
import {
  Database,
  Terminal,
  Settings,
  Table as TableIcon,
  Loader2,
  Copy,
  Hash,
  PlaySquare,
  FileText,
  Plus,
  ChevronRight,
  ChevronDown,
  FileCode,
  Play,
  Edit,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  Key,
  Columns,
  List,
  Link as LinkIcon,
  Folder,
  Cpu,
} from "lucide-react";
import clsx from "clsx";
import { ask, message } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useDatabase } from "../../hooks/useDatabase";
import { useSavedQueries } from "../../hooks/useSavedQueries";
import type { SavedQuery } from "../../contexts/SavedQueriesContext";
import { ContextMenu } from "../ui/ContextMenu";
import { SchemaModal } from "../ui/SchemaModal";
import { CreateTableModal } from "../ui/CreateTableModal";
import { QueryModal } from "../ui/QueryModal";
import { ModifyColumnModal } from "../ui/ModifyColumnModal";
import { CreateIndexModal } from "../ui/CreateIndexModal";
import { CreateForeignKeyModal } from "../ui/CreateForeignKeyModal";

interface TableColumn {
  name: string;
  data_type: string;
  is_pk: boolean;
  is_nullable: boolean;
  is_auto_increment: boolean;
}

interface ForeignKey {
  name: string;
  column_name: string;
  ref_table: string;
  ref_column: string;
}

interface Index {
  name: string;
  column_name: string;
  is_unique: boolean;
  is_primary: boolean;
}

interface AccordionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

const NavItem = ({
  to,
  icon: Icon,
  label,
  isConnected,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  isConnected?: boolean;
}) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      clsx(
        "flex items-center justify-center w-12 h-12 rounded-lg transition-colors mb-2 relative group",
        isActive
          ? "bg-blue-600 text-white"
          : "text-slate-400 hover:bg-slate-800 hover:text-slate-100",
      )
    }
  >
    <div className="relative">
      <Icon size={24} />
      {isConnected && (
        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-slate-900"></span>
      )}
    </div>
    <span className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
      {label}
    </span>
  </NavLink>
);

const Accordion = ({
  title,
  isOpen,
  onToggle,
  children,
  actions,
}: AccordionProps) => (
  <div className="flex flex-col mb-2">
    <div className="flex items-center justify-between px-2 py-1 group/acc">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors select-none flex-1"
      >
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>{title}</span>
      </button>
      {actions}
    </div>
    {isOpen && <div>{children}</div>}
  </div>
);

const SidebarColumnItem = ({
  column,
  tableName,
  connectionId,
  driver,
  onRefresh,
  onEdit,
}: {
  column: TableColumn;
  tableName: string;
  connectionId: string;
  driver: string;
  onRefresh: () => void;
  onEdit: (column: TableColumn) => void;
}) => {
  const { t } = useTranslation();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleDelete = async () => {
    const confirmed = await ask(
      t("sidebar.deleteColumnConfirm", {
        column: column.name,
        table: tableName,
      }),
      { title: t("sidebar.deleteColumn"), kind: "warning" },
    );

    if (confirmed) {
      try {
        const q = driver === "mysql" || driver === "mariadb" ? "`" : '"';
        const query = `ALTER TABLE ${q}${tableName}${q} DROP COLUMN ${q}${column.name}${q}`;

        await invoke("execute_query", {
          connectionId,
          query,
        });

        onRefresh();
      } catch (e) {
        console.error(e);
        await message(t("sidebar.failDeleteColumn") + e, {
          title: t("common.error"),
          kind: "error",
        });
      }
    }
  };

  return (
    <>
      <div
        className="flex items-center gap-2 px-3 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 cursor-pointer group font-mono"
        onContextMenu={handleContextMenu}
        onDoubleClick={() => onEdit(column)}
      >
        {column.is_pk ? (
          <Key size={12} className="text-yellow-500 shrink-0" />
        ) : (
          <Columns size={12} className="text-slate-600 shrink-0" />
        )}
        <span
          className={clsx(
            "truncate",
            column.is_pk && "font-bold text-yellow-500/80",
          )}
        >
          {column.name}
        </span>
        <span className="text-slate-600 text-[10px] ml-auto">
          {column.data_type}
        </span>
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: t("sidebar.modifyColumn"),
              icon: Edit,
              action: () => onEdit(column),
            },
            {
              label: t("sidebar.copyName"),
              icon: Copy,
              action: () => navigator.clipboard.writeText(column.name),
            },
            {
              label: t("sidebar.deleteColumn"),
              icon: Trash2,
              danger: true,
              action: handleDelete,
            },
          ]}
        />
      )}
    </>
  );
};

const SidebarTableItem = ({
  table,
  activeTable,
  onTableClick,
  onContextMenu,
  connectionId,
  driver,
  onAddColumn,
  onEditColumn,
  onAddIndex,
  onDropIndex,
  onAddForeignKey,
  onDropForeignKey,
  schemaVersion,
}: {
  table: { name: string };
  activeTable: string | null;
  onTableClick: (name: string) => void;
  onContextMenu: (
    e: React.MouseEvent,
    type: string,
    id: string,
    label: string,
    data?: ContextMenuData,
  ) => void;
  connectionId: string;
  driver: string;
  onAddColumn: (tableName: string) => void;
  onEditColumn: (tableName: string, col: TableColumn) => void;
  onAddIndex: (tableName: string) => void;
  onDropIndex: (tableName: string, indexName: string) => void;
  onAddForeignKey: (tableName: string) => void;
  onDropForeignKey: (tableName: string, fkName: string) => void;
  schemaVersion: number;
}) => {
  const { t } = useTranslation();
  // Prevent unused variable warning
  void onAddColumn;
  void onAddIndex;
  void onDropIndex;
  void onAddForeignKey;
  void onDropForeignKey;

  const [isExpanded, setIsExpanded] = useState(false);
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [foreignKeys, setForeignKeys] = useState<ForeignKey[]>([]);
  const [indexes, setIndexes] = useState<Index[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshMetadata = React.useCallback(async () => {
    if (!connectionId) return;
    setIsLoading(true);
    try {
      // Parallel fetch for speed
      const [cols, fks, idxs] = await Promise.all([
        invoke<TableColumn[]>("get_columns", {
          connectionId,
          tableName: table.name,
        }),
        invoke<ForeignKey[]>("get_foreign_keys", {
          connectionId,
          tableName: table.name,
        }),
        invoke<Index[]>("get_indexes", { connectionId, tableName: table.name }),
      ]);

      setColumns(cols);
      setForeignKeys(fks);
      setIndexes(idxs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [connectionId, table.name]);

  useEffect(() => {
    if (isExpanded) {
      refreshMetadata();
    }
  }, [isExpanded, schemaVersion, refreshMetadata]); // Re-fetch when schema version bumps

  // Sub-expansion states
  const [expandColumns, setExpandColumns] = useState(true);
  const [expandKeys, setExpandKeys] = useState(false);
  const [expandIndexes, setExpandIndexes] = useState(false);

  const handleExpand = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }

    setIsExpanded(true);
    refreshMetadata();
  };

  const showContextMenu = (e: React.MouseEvent, type: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, type, name, name, { tableName: table.name });
  };

  // Group indexes by name since API returns one row per column
  const groupedIndexes = React.useMemo(() => {
    const groups: Record<string, Index & { columns: string[] }> = {};
    indexes.forEach((idx) => {
      if (!groups[idx.name]) {
        groups[idx.name] = { ...idx, columns: [] };
      }
      groups[idx.name].columns.push(idx.column_name);
    });
    return Object.values(groups);
  }, [indexes]);

  // Separate PKs from Indexes for "keys" folder?
  // DataGrip puts PK and Unique constraints in "keys".
  // Indexes (non-unique or explicit indexes) in "indexes".
  // Currently `get_indexes` returns all indexes including PK/Unique backing indexes.

  const keys = groupedIndexes.filter((i) => i.is_primary || i.is_unique);
  // DataGrip typically shows ALL indexes in "Indexes" folder, including those backing PKs/Unique constraints.
  // So "pureIndexes" should actually be ALL indexes.
  // However, duplicates might be confusing. The user screenshot shows overlap.
  // Let's use `groupedIndexes` for indexes list, but maybe we can differentiate icon.
  const indexesList = groupedIndexes;

  return (
    <div className="flex flex-col">
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("application/reactflow", table.name);
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={() => onTableClick(table.name)}
        onContextMenu={(e) => showContextMenu(e, "table", table.name)}
        className={clsx(
          "flex items-center gap-1 pl-1 pr-3 py-1.5 text-sm cursor-pointer group select-none transition-colors border-l-2",
          activeTable === table.name
            ? "bg-blue-900/40 text-blue-200 border-blue-500"
            : "text-slate-300 hover:bg-slate-800 border-transparent hover:text-white",
        )}
      >
        <button
          onClick={handleExpand}
          className="p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-white transition-colors"
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <TableIcon
          size={14}
          className={
            activeTable === table.name
              ? "text-blue-400"
              : "text-slate-500 group-hover:text-blue-400"
          }
        />
        <span className="truncate flex-1">{table.name}</span>
      </div>
      {isExpanded && (
        <div className="ml-[22px] border-l border-slate-800">
          {isLoading ? (
            <div className="flex items-center gap-2 p-2 text-xs text-slate-500">
              <Loader2 size={12} className="animate-spin" />
              {t("sidebar.loadingSchema")}
            </div>
          ) : (
            <>
              {/* Columns Folder */}
              <div className="flex flex-col">
                <div
                  className="flex items-center gap-2 px-2 py-1 text-xs text-slate-500 hover:text-slate-300 cursor-pointer select-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandColumns(!expandColumns);
                  }}
                  onContextMenu={(e) => {
                    e.stopPropagation();
                    e.preventDefault(); /* Columns folder context menu? Maybe Add Column */
                  }}
                >
                  <Folder size={12} className="text-blue-400/70" />
                  <span>{t("sidebar.columns")}</span>
                  <span className="ml-auto text-[10px] opacity-50">
                    {columns.length}
                  </span>
                </div>
                {expandColumns && (
                  <div className="ml-4 border-l border-slate-800/50">
                    {columns.map((col) => (
                      <SidebarColumnItem
                        key={col.name}
                        column={col}
                        tableName={table.name}
                        connectionId={connectionId}
                        driver={driver}
                        onRefresh={refreshMetadata}
                        onEdit={(c) => onEditColumn(table.name, c)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Keys Folder (PK/Unique) */}
              {keys.length > 0 && (
                <div className="flex flex-col">
                  <div
                    className="flex items-center gap-2 px-2 py-1 text-xs text-slate-500 hover:text-slate-300 cursor-pointer select-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandKeys(!expandKeys);
                    }}
                  >
                    <Folder size={12} className="text-yellow-500/70" />
                    <span>{t("sidebar.keys")}</span>
                    <span className="ml-auto text-[10px] opacity-50">
                      {keys.length}
                    </span>
                  </div>
                  {expandKeys && (
                    <div className="ml-4 border-l border-slate-800/50">
                      {keys.map((k) => (
                        <div
                          key={k.name}
                          className="flex items-center gap-2 px-3 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 cursor-pointer group font-mono"
                          title={k.columns.join(", ")}
                          onContextMenu={(e) => {
                            // Keys are typically deleted as Indexes or Constraints
                            // If it's a unique/primary index, deleting the index removes the constraint.
                            // Or dropping PK constraint.
                            // Let's treat them as indexes for now for deletion if name matches index name.
                            showContextMenu(e, "index", k.name);
                          }}
                        >
                          <Key
                            size={12}
                            className={
                              k.is_primary
                                ? "text-yellow-500"
                                : "text-slate-400"
                            }
                          />
                          <span className="truncate">{k.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Foreign Keys Folder */}
              <div className="flex flex-col">
                <div
                  className="flex items-center gap-2 px-2 py-1 text-xs text-slate-500 hover:text-slate-300 cursor-pointer select-none"
                  onClick={(e) => {
                    e.stopPropagation();
                  }} // Toggle logic if needed, currently always visible if empty or not? Let's just allow click to toggle? No state for FK folder?
                  // Actually we are missing state for FK/Index folders expansion if we want them collapsible.
                  // Let's assume they are always expanded OR reuse others.
                  // Let's add state if we want them collapsible.
                  // For now, let's just make them context menu targets.
                  onContextMenu={(e) =>
                    showContextMenu(e, "folder_fks", "foreign keys")
                  }
                >
                  <Folder size={12} className="text-purple-400/70" />
                  <span>{t("sidebar.foreignKeys")}</span>
                  <span className="ml-auto text-[10px] opacity-50">
                    {foreignKeys.length}
                  </span>
                </div>
                <div className="ml-4 border-l border-slate-800/50">
                  {foreignKeys.map((fk) => (
                    <div
                      key={fk.name}
                      className="flex items-center gap-2 px-3 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 cursor-pointer group font-mono"
                      title={`${fk.column_name} -> ${fk.ref_table}.${fk.ref_column}`}
                      onContextMenu={(e) =>
                        showContextMenu(e, "foreign_key", fk.name)
                      }
                    >
                      <LinkIcon size={12} className="text-purple-400" />
                      <span className="truncate">{fk.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Indexes Folder */}
              <div className="flex flex-col">
                <div
                  className="flex items-center gap-2 px-2 py-1 text-xs text-slate-500 hover:text-slate-300 cursor-pointer select-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandIndexes(!expandIndexes);
                  }}
                  onContextMenu={(e) =>
                    showContextMenu(e, "folder_indexes", "indexes")
                  }
                >
                  <Folder size={12} className="text-green-400/70" />
                  <span>{t("sidebar.indexes")}</span>
                  <span className="ml-auto text-[10px] opacity-50">
                    {indexesList.length}
                  </span>
                </div>
                {expandIndexes && (
                  <div className="ml-4 border-l border-slate-800/50">
                    {indexesList.map((idx) => (
                      <div
                        key={idx.name}
                        className="flex items-center gap-2 px-3 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 cursor-pointer group font-mono"
                        title={idx.columns.join(", ")}
                        onContextMenu={(e) =>
                          showContextMenu(e, "index", idx.name)
                        }
                      >
                        <List
                          size={12}
                          className={
                            idx.is_unique ? "text-blue-400" : "text-green-400"
                          }
                        />
                        <span className="truncate flex-1">
                          {idx.name}{" "}
                          <span className="text-slate-600">
                            ({idx.columns.join(", ")})
                          </span>
                        </span>
                        {idx.is_unique && (
                          <span className="text-[9px] text-slate-500 border border-slate-700 px-1 rounded bg-slate-900/50">
                            UNIQUE
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

type ContextMenuData = SavedQuery | { tableName: string };

export const Sidebar = () => {
  const { t } = useTranslation();
  const {
    activeConnectionId,
    activeDriver,
    activeTable,
    setActiveTable,
    tables,
    isLoadingTables,
    refreshTables,
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

  const [queriesOpen, setQueriesOpen] = useState(false);
  const [tablesOpen, setTablesOpen] = useState(true);
  const [queryModal, setQueryModal] = useState<{
    isOpen: boolean;
    query?: SavedQuery;
  }>({ isOpen: false });
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);
  const [isMcpModalOpen, setIsMcpModalOpen] = useState(false);

  const getQuote = () =>
    activeDriver === "mysql" || activeDriver === "mariadb" ? "`" : '"';

  const runQuery = (sql: string, queryName?: string, tableName?: string) => {
    navigate("/editor", {
      state: { initialQuery: sql, queryName, tableName },
    });
  };

  const handleTableClick = (tableName: string) => {
    setActiveTable(tableName);
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

  return (
    <div className="flex h-full">
      {/* Primary Navigation Bar (Narrow) */}
      <aside className="w-16 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-4 z-20">
        <div className="mb-8 " title="tabularis">
          <img
            src="/logo.png"
            alt="tabularis"
            className="w-12 h-12 p-2 bg-[#010101] rounded-2xl mx-auto mb-4 shadow-lg shadow-blue-500/30"
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
            className="flex items-center justify-center w-12 h-12 rounded-lg transition-colors mb-2 relative group text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <div className="relative">
              <Cpu size={24} />
            </div>
            <span className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
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
          <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
            <div className="p-4 border-b border-slate-800 font-semibold text-sm text-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Database size={16} className="text-blue-400" />
                <span>{t("sidebar.explorer")}</span>
              </div>
              <button
                onClick={() => setIsExplorerCollapsed(true)}
                className="text-slate-500 hover:text-slate-300 transition-colors p-1 hover:bg-slate-800 rounded"
                title="Collapse Explorer"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {isLoadingTables ? (
                <div className="flex items-center justify-center h-20 text-slate-500 gap-2">
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
                      <div className="text-center p-2 text-xs text-slate-600 italic">
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
                            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer group transition-colors"
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsCreateTableModalOpen(true);
                        }}
                        className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-white transition-colors"
                        title="Create New Table"
                      >
                        <Plus size={14} />
                      </button>
                    }
                  >
                    {tables.length === 0 ? (
                      <div className="text-center p-2 text-xs text-slate-600 italic">
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
          <div className="w-12 bg-slate-950 border-r border-slate-800 flex flex-col items-center py-4">
            <button
              onClick={() => setIsExplorerCollapsed(false)}
              className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg p-2 transition-colors group relative"
              title={t("sidebar.expandExplorer")}
            >
              <PanelLeft size={20} />
              <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
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
                    label: t("sidebar.selectTop100"),
                    icon: PlaySquare,
                    action: () => {
                      const q = getQuote();
                      runQuery(
                        `SELECT * FROM ${q}${contextMenu.id}${q} LIMIT 100`,
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
                          await message(t("sidebar.failDeleteTable") + e, {
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
                        // We need table name here. But contextMenu only has id (index name).
                        // Hack: Pass table name in label or data?
                        // Let's pass table name in `data` as a custom object { tableName: string }
                        // Or parse it if we encoded it.
                        // Let's update `showContextMenu` to pass tableName in `data`.
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
                            const q =
                              activeDriver === "mysql" ||
                              activeDriver === "mariadb"
                                ? `DROP INDEX \`${contextMenu.id}\` ON \`${t_name}\``
                                : `DROP INDEX "${contextMenu.id}"`;
                            await invoke("execute_query", {
                              connectionId: activeConnectionId,
                              query: q,
                            }).catch(console.error);
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
                          label: t("sidebar.deleteIndex"), // Wait, folder?
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
                            label: t("sidebar.deleteFk"), // Wait, folder?
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
    </div>
  );
};
