import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Play,
  Plus,
  Minus,
  Download,
  Square,
  ChevronDown,
  ChevronUp,
  Save,
  X,
  Database,
  Table as TableIcon,
  FileCode,
  Network,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowLeftToLine,
  ArrowRightToLine,
  XCircle,
  Trash2,
  Check,
  Undo2,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { DataGrid } from "../components/ui/DataGrid";
import { NewRowModal } from "../components/ui/NewRowModal";
import { QuerySelectionModal } from "../components/ui/QuerySelectionModal";
import { QueryModal } from "../components/ui/QueryModal";
import { VisualQueryBuilder } from "../components/ui/VisualQueryBuilder";
import { ContextMenu } from "../components/ui/ContextMenu";
import { splitQueries, extractTableName } from "../utils/sql";
import MonacoEditor, { type OnMount } from "@monaco-editor/react";
import { save, message } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useDatabase } from "../hooks/useDatabase";
import { useSavedQueries } from "../hooks/useSavedQueries";
import { useSettings } from "../hooks/useSettings";
import { useEditor } from "../hooks/useEditor";
import type { QueryResult, Tab } from "../types/editor";
import clsx from "clsx";

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${(ms / 1000).toFixed(2)} s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes} min ${remainingSeconds} s`;
};

interface TableColumn {
  name: string;
  data_type: string;
  is_pk: boolean;
  is_nullable: boolean;
}

interface EditorState {
    initialQuery?: string;
    tableName?: string;
    queryName?: string;
}

export const Editor = () => {
  const { t } = useTranslation();
  const { activeConnectionId } = useDatabase();
  const { settings } = useSettings();
  const { saveQuery } = useSavedQueries();
  const {
    tabs,
    activeTab,
    activeTabId,
    updateTab,
    addTab,
    setActiveTabId,
    closeTab,
    closeAllTabs,
    closeOtherTabs,
    closeTabsToLeft,
    closeTabsToRight,
  } = useEditor();
  const location = useLocation();
  const navigate = useNavigate();

  const [tabContextMenu, setTabContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
  } | null>(null);

  const handleTabContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setTabContextMenu({ x: e.clientX, y: e.clientY, tabId });
  };

  const [saveQueryModal, setSaveQueryModal] = useState<{
    isOpen: boolean;
    sql: string;
  }>({ isOpen: false, sql: "" });
  const [showNewRowModal, setShowNewRowModal] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [editorHeight, setEditorHeight] = useState(300);
  const [isResultsCollapsed, setIsResultsCollapsed] = useState(false);
  const isDragging = useRef(false);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const [selectableQueries, setSelectableQueries] = useState<string[]>([]);
  const [isQuerySelectionModalOpen, setIsQuerySelectionModalOpen] =
    useState(false);
  const [isRunDropdownOpen, setIsRunDropdownOpen] = useState(false);
  const [isEditingPage, setIsEditingPage] = useState(false);
  const [tempPage, setTempPage] = useState("1");

  const activeTabType = activeTab?.type;
  const activeTabQuery = activeTab?.query;
  const isTableTab = activeTab?.type === "table";
  const isEditorOpen =
    !isTableTab &&
    (activeTab?.isEditorOpen ?? activeTab?.type !== "table");

  // State for Table View Filter/Sort
  const [tableFilter, setTableFilter] = useState("");
  const [tableSort, setTableSort] = useState("");

  // Sync state with active tab
  useEffect(() => {
    if (activeTab?.type === "table") {
      setTableFilter(activeTab.filterClause || "");
      setTableSort(activeTab.sortClause || "");
    }
  }, [activeTab?.id, activeTab?.filterClause, activeTab?.sortClause, activeTab?.type]);

  const dropdownQueries = useMemo(() => {
    if (activeTabType === "query_builder" && activeTabQuery) {
      return [activeTabQuery];
    }
    return selectableQueries;
  }, [activeTabType, activeTabQuery, selectableQueries]);

  const tabsRef = useRef<Tab[]>([]);
  const activeTabIdRef = useRef<string | null>(null);
  const processingRef = useRef<string | null>(null);

  const selectionHasPending = useMemo(() => {
    if (!activeTab) return false;
    const { pendingChanges, pendingDeletions, selectedRows, result, pkColumn } = activeTab;
    const hasGlobalPending = (pendingChanges && Object.keys(pendingChanges).length > 0) ||
                             (pendingDeletions && Object.keys(pendingDeletions).length > 0);

    if (!selectedRows || selectedRows.length === 0) return hasGlobalPending;

    if (!result || !pkColumn) return false;
    const pkIndex = result.columns.indexOf(pkColumn);
    if (pkIndex === -1) return false;

    return selectedRows.some(rowIndex => {
        const row = result.rows[rowIndex];
        if (!row) return false;
        const pkVal = String(row[pkIndex]);
        return (pendingChanges && pendingChanges[pkVal]) || (pendingDeletions && pendingDeletions[pkVal]);
    });
  }, [activeTab]);

  const hasPendingChanges = useMemo(() => {
    return (activeTab?.pendingChanges && Object.keys(activeTab.pendingChanges).length > 0) || 
           (activeTab?.pendingDeletions && Object.keys(activeTab.pendingDeletions).length > 0);
  }, [activeTab?.pendingChanges, activeTab?.pendingDeletions]);

  useEffect(() => {
    tabsRef.current = tabs;
    activeTabIdRef.current = activeTabId;
  }, [tabs, activeTabId]);

  const updateActiveTab = useCallback(
    (partial: Partial<Tab>) => {
      if (activeTabId) updateTab(activeTabId, partial);
    },
    [activeTabId, updateTab],
  );

  const fetchPkColumn = useCallback(
    async (table: string, tabId?: string) => {
      if (!activeConnectionId) return;
      try {
        const cols = await invoke<TableColumn[]>("get_columns", {
          connectionId: activeConnectionId,
          tableName: table,
        });
        const pk = cols.find((c) => c.is_pk);
        const targetId = tabId || activeTabId;
        if (targetId) updateTab(targetId, { pkColumn: pk ? pk.name : null });
      } catch (e) {
        console.error("Failed to fetch PK:", e);
        // Even if PK fetch fails, set pkColumn to null to unblock the UI
        const targetId = tabId || activeTabId;
        if (targetId) updateTab(targetId, { pkColumn: null });
      }
    },
    [activeConnectionId, activeTabId, updateTab],
  );

  const stopQuery = useCallback(async () => {
    if (!activeConnectionId) return;
    try {
      await invoke("cancel_query", { connectionId: activeConnectionId });
      updateActiveTab({ isLoading: false });
    } catch (e) {
      console.error("Failed to stop:", e);
    }
  }, [activeConnectionId, updateActiveTab]);

  const runQuery = useCallback(
    async (sql?: string, pageNum: number = 1, tabId?: string) => {
      const targetTabId = tabId || activeTabIdRef.current;
      if (!activeConnectionId || !targetTabId) return;

      const targetTab = tabsRef.current.find((t) => t.id === targetTabId);
      
      let textToRun = sql?.trim() || targetTab?.query;
      
      // For Table Tabs, reconstruct query if filter/sort are present
      if (targetTab?.type === "table" && targetTab.activeTable) {
          const filter = targetTab.filterClause ? `WHERE ${targetTab.filterClause}` : "";
          const sort = targetTab.sortClause ? `ORDER BY ${targetTab.sortClause}` : "";
          // Reconstruct base query: SELECT * FROM table ...
          // Note: LIMIT/OFFSET are handled by backend/pagination params, 
          // but we need to ensure the base query respects the filters.
          // The current query might already have them if it was saved? 
          // No, let's assume for Table view we always construct from activeTable + state.
          textToRun = `SELECT * FROM ${targetTab.activeTable} ${filter} ${sort}`;
      }

      if (!textToRun || !textToRun.trim()) return;

      // Log query from Visual Query Builder
      if (targetTab?.type === "query_builder") {
        console.log("🔍 Visual Query Builder - Executing Query:");
        console.log(textToRun);
        console.log("─".repeat(80));
      }

      // Automatically open results panel when running a query
      setIsResultsCollapsed(false);

      updateTab(targetTabId, {
        isLoading: true,
        error: "",
        result: null,
        executionTime: null,
        page: pageNum,
        // Clear pending changes and selection when running a new query
        pendingChanges: undefined,
        pendingDeletions: undefined,
        selectedRows: [],
      });

      try {
        const start = performance.now();
        const res = await invoke<QueryResult>("execute_query", {
          connectionId: activeConnectionId,
          query: textToRun,
          limit: settings.queryLimit > 0 ? settings.queryLimit : null,
          page: pageNum,
        });
        const end = performance.now();
        
        // Fetch PK column if this is a table tab OR if the query references a table
        const currentTab = tabsRef.current.find((t) => t.id === targetTabId);
        let tableName = currentTab?.activeTable;
        
        // If not a table tab, try to extract table name from the query
        if (!tableName && textToRun) {
          tableName = extractTableName(textToRun) || undefined;
        }
        
        if (tableName) {
          // Wait for PK column to be fetched before showing results
          await fetchPkColumn(tableName, targetTabId);
        } else {
          // No table, explicitly set pkColumn to null (read-only mode)
          updateTab(targetTabId, { pkColumn: null });
        }
        
        updateTab(targetTabId, {
          result: res,
          executionTime: end - start,
          isLoading: false,
        });
      } catch (err) {
        updateTab(targetTabId, {
          error: typeof err === "string" ? err : t("editor.queryFailed"),
          isLoading: false,
        });
      }
    },
    [activeConnectionId, updateTab, settings.queryLimit, fetchPkColumn, t],
  );

  const handleRunButton = useCallback(() => {
    if (!activeTab) return;

    // Visual Query Builder: run the generated SQL directly
    if (activeTab.type === "query_builder") {
      if (activeTab.query && activeTab.query.trim()) {
        runQuery(activeTab.query, 1);
      }
      return;
    }

    // Monaco Editor: handle selection and multi-query
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const selection = editor.getSelection();
    const selectedText = selection
      ? editor.getModel()?.getValueInRange(selection)
      : undefined;

    if (selectedText && selection && !selection.isEmpty()) {
      runQuery(selectedText, 1);
      return;
    }

    const fullText = editor.getValue();
    if (!fullText.trim()) return;

    const queries = splitQueries(fullText);
    if (queries.length <= 1) runQuery(queries[0] || fullText, 1);
    else {
      setSelectableQueries(queries);
      setIsQuerySelectionModalOpen(true);
    }
  }, [activeTab, runQuery]);

  const handleRefresh = useCallback(() => {
    if (activeTab?.activeTable && activeConnectionId)
      runQuery(activeTab.query, activeTab.page);
  }, [activeTab, activeConnectionId, runQuery]);

  const handlePendingChange = useCallback((pkVal: unknown, colName: string, value: unknown) => {
    if (!activeTabIdRef.current) return;
    const tabId = activeTabIdRef.current;
    
    const currentTab = tabsRef.current.find(t => t.id === tabId);
    if (!currentTab) return;

    const pkKey = String(pkVal);
    const currentPending = currentTab.pendingChanges || {};
    const rowEntry = currentPending[pkKey] || { pkOriginalValue: pkVal, changes: {} };
    
    // Create new changes object
    const newChanges = { ...rowEntry.changes };
    
    if (value === undefined) {
        // Remove change
        delete newChanges[colName];
    } else {
        // Update change
        newChanges[colName] = value;
    }

    const newPending = { ...currentPending };

    // If no changes left for this row, remove the row entry
    if (Object.keys(newChanges).length === 0) {
        delete newPending[pkKey];
    } else {
        newPending[pkKey] = {
            ...rowEntry,
            changes: newChanges
        };
    }
    
    updateTab(tabId, { pendingChanges: newPending });
  }, [updateTab]);

  const handleSelectionChange = useCallback((indices: Set<number>) => {
    if (!activeTabIdRef.current) return;
    updateTab(activeTabIdRef.current, { selectedRows: Array.from(indices) });
  }, [updateTab]);

  const handleDeleteRows = useCallback(() => {
    if (!activeTab || !activeTab.result || !activeTab.pkColumn || !activeTab.selectedRows || activeTab.selectedRows.length === 0) return;
    
    const pkIndex = activeTab.result.columns.indexOf(activeTab.pkColumn);
    if (pkIndex === -1) return;

    const currentPendingDeletions = activeTab.pendingDeletions || {};
    const newPendingDeletions = { ...currentPendingDeletions };

    activeTab.selectedRows.forEach(rowIndex => {
        const row = activeTab.result!.rows[rowIndex];
        if (row) {
            const pkVal = row[pkIndex];
            newPendingDeletions[String(pkVal)] = pkVal;
        }
    });

    updateActiveTab({ pendingDeletions: newPendingDeletions, selectedRows: [] });
  }, [activeTab, updateActiveTab]);

  const handleSubmitChanges = useCallback(async () => {
    if (!activeTab || !activeTab.activeTable || !activeTab.pkColumn || !activeConnectionId) return;
    
    const { pendingChanges, pendingDeletions, activeTable, pkColumn, selectedRows } = activeTab;
    const updates: { pkVal: unknown; colName: string; newVal: unknown }[] = [];
    const deletions: unknown[] = [];

    // Filter pending changes by selected rows IF there is a selection
    const hasSelection = selectedRows && selectedRows.length > 0;
    const selectedPkSet = new Set<string>();
    
    if (hasSelection && activeTab.result) {
        const pkIndex = activeTab.result.columns.indexOf(pkColumn);
        if (pkIndex !== -1) {
            selectedRows.forEach(rowIndex => {
                const row = activeTab.result!.rows[rowIndex];
                if (row) selectedPkSet.add(String(row[pkIndex]));
            });
        }
    }

    if (pendingChanges) {
        for (const [pkKey, rowData] of Object.entries(pendingChanges)) {
            // Apply filter if selection exists
            if (hasSelection && !selectedPkSet.has(pkKey)) continue;

            const { pkOriginalValue, changes } = rowData;
            for (const [colName, newVal] of Object.entries(changes)) {
                updates.push({ pkVal: pkOriginalValue, colName, newVal });
            }
        }
    }

    if (pendingDeletions) {
        for (const [pkKey, pkVal] of Object.entries(pendingDeletions)) {
             // Apply filter if selection exists
             if (hasSelection && !selectedPkSet.has(pkKey)) continue;
             deletions.push(pkVal);
        }
    }

    if (updates.length === 0 && deletions.length === 0) return;

    updateActiveTab({ isLoading: true });

    try {
        const promises = [];
        
        // Deletions
        if (deletions.length > 0) {
            promises.push(...deletions.map(pkVal => invoke('delete_record', {
                connectionId: activeConnectionId,
                table: activeTable,
                pkCol: pkColumn,
                pkVal
            })));
        }

        // Updates
        if (updates.length > 0) {
            promises.push(...updates.map(u => invoke('update_record', {
                connectionId: activeConnectionId,
                table: activeTable,
                pkCol: pkColumn,
                pkVal: u.pkVal,
                colName: u.colName,
                newVal: u.newVal
            })));
        }

        await Promise.all(promises);
        
        // Remove processed changes from state
        const newPendingChanges = { ...(pendingChanges || {}) };
        const newPendingDeletions = { ...(pendingDeletions || {}) };

        // If we processed everything, clear all. If partial, clear only processed.
        if (!hasSelection) {
             updateActiveTab({ pendingChanges: undefined, pendingDeletions: undefined, isLoading: false });
        } else {
             // Partial cleanup
             updates.forEach(u => delete newPendingChanges[String(u.pkVal)]);
             deletions.forEach(d => delete newPendingDeletions[String(d)]);
             
             // Cleanup empty change objects
             Object.keys(newPendingChanges).forEach(key => {
                 // @ts-ignore
                 if (Object.keys(newPendingChanges[key]?.changes || {}).length === 0) delete newPendingChanges[key];
             });

             updateActiveTab({ 
                 pendingChanges: Object.keys(newPendingChanges).length > 0 ? newPendingChanges : undefined, 
                 pendingDeletions: Object.keys(newPendingDeletions).length > 0 ? newPendingDeletions : undefined, 
                 isLoading: false 
             });
        }
        
        runQuery(activeTab.query, activeTab.page);
    } catch (e) {
        console.error("Batch update failed", e);
        updateActiveTab({ isLoading: false });
        await message(t('dataGrid.updateFailed') + String(e), { title: t('common.error'), kind: 'error' });
    }
  }, [activeTab, activeConnectionId, updateActiveTab, runQuery, t]);

  const handleRollbackChanges = useCallback(() => {
    if (!activeTab) return;
    const { selectedRows, result, pkColumn, pendingChanges, pendingDeletions } = activeTab;
    
    // If no selection, rollback everything
    if (!selectedRows || selectedRows.length === 0) {
        updateActiveTab({ pendingChanges: undefined, pendingDeletions: undefined });
        return;
    }

    // Filter rollback by selection
    const selectedPkSet = new Set<string>();
    if (result && pkColumn) {
        const pkIndex = result.columns.indexOf(pkColumn);
        if (pkIndex !== -1) {
            selectedRows.forEach(rowIndex => {
                const row = result.rows[rowIndex];
                if (row) selectedPkSet.add(String(row[pkIndex]));
            });
        }
    }

    const newPendingChanges = { ...(pendingChanges || {}) };
    const newPendingDeletions = { ...(pendingDeletions || {}) };

    selectedPkSet.forEach(pk => {
        delete newPendingChanges[pk];
        delete newPendingDeletions[pk];
    });

    updateActiveTab({ 
        pendingChanges: Object.keys(newPendingChanges).length > 0 ? newPendingChanges : undefined, 
        pendingDeletions: Object.keys(newPendingDeletions).length > 0 ? newPendingDeletions : undefined
    });

  }, [activeTab, updateActiveTab]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.addAction({
      id: "run-selection",
      label: "Execute Selection",
      contextMenuGroupId: "navigation",
      contextMenuOrder: 1.5,
      run: (ed) => {
        const selection = ed.getSelection();
        const selectedText = ed.getModel()?.getValueInRange(selection!);
        runQuery(
          selectedText && !selection?.isEmpty() ? selectedText : ed.getValue(),
          1,
        );
      },
    });
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      handleRunButton,
    );
  };

  useEffect(() => {
    const state = location.state as EditorState;
    if (activeConnectionId && state?.initialQuery) {
      const queryKey = `${state.initialQuery}-${state.tableName}-${state.queryName}`;
      if (processingRef.current === queryKey) return;
      processingRef.current = queryKey;

      const { initialQuery: sql, tableName: table, queryName } = state;
      const tabId = addTab({
        type: table ? "table" : "console",
        title: queryName || table || (table ? table : t("sidebar.newConsole")),
        query: sql,
        activeTable: table,
      });

      if (tabId) runQuery(sql, 1, tabId);

      navigate(location.pathname, { replace: true, state: {} });
      setTimeout(() => {
        processingRef.current = null;
      }, 500);
    }
  }, [
    location.state,
    location.pathname,
    activeConnectionId,
    addTab,
    navigate,
    runQuery,
    t,
  ]);

  const startResize = () => {
    isDragging.current = true;
    const handleResize = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newHeight = e.clientY - 50;
      if (newHeight > 100 && newHeight < window.innerHeight - 150)
        setEditorHeight(newHeight);
    };
    const stopResize = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", handleResize);
      document.removeEventListener("mouseup", stopResize);
    };
    document.addEventListener("mousemove", handleResize);
    document.addEventListener("mouseup", stopResize);
  };

  const handleExportCSV = async () => {
    if (!activeTab?.result) return;
    const result = activeTab.result;
    try {
      const filePath = await save({
        filters: [{ name: "CSV", extensions: ["csv"] }],
        defaultPath: `result_${Date.now()}.csv`,
      });
      if (!filePath) return;
      const headers = result.columns.join(",");
      const rows = result.rows
        .map((row) =>
          row
            .map((cell) => {
              if (cell === null) return "NULL";
              const str = String(cell);
              return str.includes(",") ||
                str.includes('"') ||
                str.includes("\n")
                ? `"${str.replace(/"/g, '""')}"`
                : str;
            })
            .join(","),
        )
        .join("\n");
      await writeTextFile(filePath, `${headers}\n${rows}`);
      setExportMenuOpen(false);
    } catch (e) {
      updateActiveTab({ error: "Export failed: " + String(e) });
    }
  };

  const handleExportJSON = async () => {
    if (!activeTab?.result) return;
    const result = activeTab.result;
    try {
      const filePath = await save({
        filters: [{ name: "JSON", extensions: ["json"] }],
        defaultPath: `result_${Date.now()}.json`,
      });
      if (!filePath) return;
      const data = result.rows.map((row) => {
        const obj: Record<string, unknown> = {};
        result.columns.forEach((col, i) => (obj[col] = row[i]));
        return obj;
      });
      await writeTextFile(filePath, JSON.stringify(data, null, 2));
      setExportMenuOpen(false);
    } catch (e) {
      updateActiveTab({ error: "Export failed: " + String(e) });
    }
  };

  const handleRunDropdownToggle = useCallback(() => {
    if (!isRunDropdownOpen) {
      // Monaco Editor: split queries from editor
      if (activeTab?.type !== "query_builder" && editorRef.current) {
        const text = editorRef.current.getValue();
        const queries = splitQueries(text);
        setSelectableQueries(queries);
      }
    }
    setIsRunDropdownOpen((prev) => !prev);
  }, [isRunDropdownOpen, activeTab]);

  if (!activeTab) {
    return (
      <div className="flex flex-col h-full bg-slate-950 items-center justify-center text-slate-500">
        <Database size={48} className="mb-4 opacity-20" />
        {activeConnectionId ? (
          <div className="text-center">
            <p className="mb-4">{t("editor.noTabs")}</p>
            <button
              onClick={() => addTab({ type: "console" })}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            >
              {t("editor.newConsole")}
            </button>
          </div>
        ) : (
          <p>{t("editor.noActiveSession")}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Tab Bar */}
      <div className="flex items-center bg-slate-900 border-b border-slate-800 h-9 shrink-0">
        <div className="flex flex-1 overflow-x-auto no-scrollbar h-full">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              onContextMenu={(e) => handleTabContextMenu(e, tab.id)}
              className={clsx(
                "flex items-center gap-2 px-3 h-full border-r border-slate-800 cursor-pointer min-w-[140px] max-w-[220px] text-xs transition-all group relative select-none",
                activeTabId === tab.id
                  ? "bg-slate-950 text-slate-100 font-medium"
                  : "text-slate-500 hover:bg-slate-800 hover:text-slate-300",
              )}
            >
              {activeTabId === tab.id && (
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-500" />
              )}
              {tab.type === "table" ? (
                <TableIcon size={12} className="text-blue-400 shrink-0" />
              ) : tab.type === "query_builder" ? (
                <Network size={12} className="text-purple-400 shrink-0" />
              ) : (
                <FileCode size={12} className="text-green-500 shrink-0" />
              )}
              <span className="truncate flex-1">{tab.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className={clsx(
                  "p-0.5 rounded-sm hover:bg-slate-700 transition-opacity shrink-0",
                  activeTabId === tab.id
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100",
                )}
              >
                <X size={12} />
              </button>
              {tab.isLoading && (
                <div className="absolute bottom-0 left-0 h-0.5 bg-blue-500 animate-pulse w-full" />
              )}
            </div>
          ))}
        </div>
        <button
          onClick={() => addTab({ type: "console" })}
          className="flex items-center justify-center w-9 h-full text-slate-500 hover:text-white hover:bg-slate-800 border-l border-slate-800 transition-colors shrink-0"
          title={t("editor.newConsole")}
        >
          <Plus size={16} />
        </button>
        <button
          onClick={() => addTab({ type: "query_builder" })}
          className="flex items-center justify-center w-9 h-full text-purple-500 hover:text-white hover:bg-slate-800 border-l border-slate-800 transition-colors shrink-0"
          title={t("editor.newVisualQuery")}
        >
          <Network size={16} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center p-2 border-b border-slate-800 bg-slate-900 gap-2 h-[50px]">
        {activeTab.isLoading ? (
          <button
            onClick={stopQuery}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded text-sm font-medium"
          >
            <Square size={16} fill="currentColor" /> {t("editor.stop")}
          </button>
        ) : (
          <div className="flex items-center rounded bg-green-700 relative">
            <button
              onClick={handleRunButton}
              disabled={!activeConnectionId}
              className={clsx(
                "flex items-center gap-2 px-3 py-1.5 text-white text-sm font-medium disabled:opacity-50 hover:bg-green-600",
                isTableTab ? "rounded" : "rounded-l"
              )}
            >
              <Play size={16} fill="currentColor" /> {t("editor.run")}
            </button>
            {!isTableTab && (
              <>
                <div className="h-5 w-[1px] bg-green-800"></div>
                <button
                  onClick={handleRunDropdownToggle}
                  disabled={!activeConnectionId}
                  className="px-1.5 py-1.5 text-white rounded-r hover:bg-green-600 disabled:opacity-50"
                >
                  <ChevronDown size={14} />
                </button>

                {isRunDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsRunDropdownOpen(false)}
                    />
                    <div className="absolute top-full left-0 mt-1 w-80 bg-slate-800 border border-slate-700 rounded shadow-xl z-50 flex flex-col py-1 max-h-80 overflow-y-auto">
                      {dropdownQueries.length === 0 ? (
                        <div className="px-4 py-2 text-xs text-slate-500 italic">
                          {t("editor.noValidQueries")}
                        </div>
                      ) : (
                        dropdownQueries.map((q, i) => (
                          <div
                            key={i}
                            className="flex items-center border-b border-slate-700/50 last:border-0 hover:bg-slate-700/50 transition-colors group"
                          >
                            <button
                              onClick={() => {
                                runQuery(q, 1);
                                setIsRunDropdownOpen(false);
                              }}
                              className="text-left px-4 py-2 text-xs font-mono text-slate-300 hover:text-white flex-1 truncate"
                              title={q}
                            >
                              {q}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsRunDropdownOpen(false);
                                setSaveQueryModal({ isOpen: true, sql: q });
                              }}
                              className="p-2 text-slate-500 hover:text-white hover:bg-slate-600 transition-colors mr-1 rounded shrink-0 opacity-0 group-hover:opacity-100"
                              title={t("editor.saveThisQuery")}
                            >
                              <Save size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        <div className="relative">
          <button
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            disabled={!activeTab.result || activeTab.result.rows.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-sm font-medium disabled:opacity-50 border border-slate-700"
          >
            <Download size={16} /> {t("editor.export")}
          </button>
          {exportMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setExportMenuOpen(false)}
              />
              <div className="absolute top-full left-0 mt-1 w-40 bg-slate-800 border border-slate-700 rounded shadow-xl z-50 flex flex-col py-1">
                <button
                  onClick={handleExportCSV}
                  className="text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
                >
                  CSV (.csv)
                </button>
                <button
                  onClick={handleExportJSON}
                  className="text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
                >
                  JSON (.json)
                </button>
              </div>
            </>
          )}
        </div>
        <span className="text-xs text-slate-500 ml-2">
          {activeConnectionId ? t("editor.connected") : t("editor.disconnected")}
        </span>
      </div>

      {!isTableTab && (
        <div
          style={{
            height: isResultsCollapsed ? "calc(100vh - 109px)" : editorHeight,
            display: isEditorOpen ? "block" : "none",
          }}
          className="relative"
        >
          {activeTab.type === "query_builder" ? (
            <VisualQueryBuilder />
          ) : (
            <MonacoEditor
              height="100%"
              defaultLanguage="sql"
              theme="vs-dark"
              value={activeTab.query}
              onChange={(val) => updateActiveTab({ query: val || "" })}
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                padding: { top: 16 },
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          )}
        </div>
      )}

      {/* Resize Bar & Results Panel */}
      {isTableTab || !isResultsCollapsed ? (
        <>
          {isTableTab ? (
             <div className="h-10 bg-slate-900 border-y border-slate-800 flex items-center px-2 gap-4">
                <div className="flex items-center gap-2 flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 focus-within:border-blue-500/50 transition-colors">
                    <Filter size={14} className="text-slate-500 shrink-0" />
                    <span className="text-xs text-blue-400 font-mono shrink-0">WHERE</span>
                    <input 
                        type="text" 
                        value={tableFilter}
                        onChange={(e) => setTableFilter(e.target.value)}
                        onBlur={() => updateActiveTab({ filterClause: tableFilter })}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                updateActiveTab({ filterClause: tableFilter });
                                // Small delay to ensure state update propagates before runQuery reads it
                                setTimeout(() => runQuery(undefined, 1), 0);
                            }
                        }}
                        className="bg-transparent border-none outline-none text-xs text-slate-300 w-full placeholder:text-slate-600 font-mono"
                        placeholder="id > 5 AND status = 'active'"
                    />
                </div>
                <div className="flex items-center gap-2 flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 focus-within:border-blue-500/50 transition-colors">
                    <ArrowUpDown size={14} className="text-slate-500 shrink-0" />
                    <span className="text-xs text-blue-400 font-mono shrink-0">ORDER BY</span>
                    <input 
                        type="text" 
                        value={tableSort}
                        onChange={(e) => setTableSort(e.target.value)}
                        onBlur={() => updateActiveTab({ sortClause: tableSort })}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                updateActiveTab({ sortClause: tableSort });
                                setTimeout(() => runQuery(undefined, 1), 0);
                            }
                        }}
                        className="bg-transparent border-none outline-none text-xs text-slate-300 w-full placeholder:text-slate-600 font-mono"
                        placeholder="created_at DESC"
                    />
                </div>
             </div>
          ) : (
            <div
              onMouseDown={isEditorOpen ? startResize : undefined}
              className={clsx(
                "h-6 bg-slate-900 border-y border-slate-800 flex items-center px-2 relative",
                isEditorOpen
                  ? "cursor-row-resize justify-between"
                  : "justify-between"
              )}
            >
              <div className="flex items-center">
                <button
                  onClick={() =>
                    updateActiveTab({ isEditorOpen: !isEditorOpen })
                  }
                  className="text-slate-500 hover:text-slate-300 transition-colors p-1 hover:bg-slate-800 rounded flex items-center gap-1 text-xs"
                  title={
                    isEditorOpen
                      ? "Maximize Results (Hide Editor)"
                      : "Show Editor"
                  }
                >
                  {isEditorOpen ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                  {!isEditorOpen && <span>Show Editor</span>}
                </button>
              </div>

              {isEditorOpen && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsResultsCollapsed(true);
                  }}
                  className="text-slate-500 hover:text-slate-300 transition-colors p-1 hover:bg-slate-800 rounded"
                  title="Hide Results Panel (Maximize Editor)"
                >
                  <ChevronDown size={16} />
                </button>
              )}
            </div>
          )}

          {/* Results Panel */}
          <div className="flex-1 overflow-hidden bg-slate-900 flex flex-col min-h-0">
            {activeTab.isLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <div className="w-12 h-12 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                <p className="text-sm">{t("editor.executingQuery")}</p>
              </div>
            ) : activeTab.error ? (
              <div className="p-4 text-red-400 font-mono text-sm bg-red-900/10 h-full overflow-auto whitespace-pre-wrap">
                Error: {activeTab.error}
              </div>
            ) : activeTab.result ? (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="p-2 bg-slate-900 text-xs text-slate-400 border-b border-slate-800 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-4">
                    <span>
                      {t("editor.rowsRetrieved", { count: activeTab.result.rows.length })}{" "}
                      {activeTab.executionTime !== null && (
                        <span className="text-slate-500 ml-2 font-mono">
                          ({formatDuration(activeTab.executionTime)})
                        </span>
                      )}
                    </span>

                    {activeTab.result.truncated &&
                      activeTab.result.pagination && (
                        <span className="px-2 py-0.5 bg-yellow-900/30 text-yellow-400 rounded text-[10px] font-semibold uppercase tracking-wide border border-yellow-500/30">
                          {t("editor.autoPaginated")}
                        </span>
                      )}
                  </div>

                  {/* Pagination Controls */}
                  {activeTab.result.pagination && (
                    <div className="flex items-center gap-1 bg-slate-800 rounded border border-slate-700">
                      <button
                        disabled={
                          activeTab.result.pagination.page === 1 ||
                          activeTab.isLoading
                        }
                        onClick={() => runQuery(activeTab.query, 1)}
                        className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        title="First Page"
                      >
                        <ChevronsLeft size={14} />
                      </button>
                      <button
                        disabled={
                          activeTab.result.pagination.page === 1 ||
                          activeTab.isLoading
                        }
                        onClick={() =>
                          runQuery(
                            activeTab.query,
                            activeTab.result!.pagination!.page - 1,
                          )
                        }
                        className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border-l border-slate-700"
                        title="Previous Page"
                      >
                        <ChevronLeft size={14} />
                      </button>

                      <div
                        className="px-3 text-slate-300 text-xs font-medium cursor-pointer hover:bg-slate-700 transition-colors min-w-[80px] text-center py-1"
                        onClick={() => {
                          setIsEditingPage(true);
                          setTempPage(
                            String(activeTab.result!.pagination!.page),
                          );
                        }}
                        title={t("editor.jumpToPage")}
                      >
                        {isEditingPage ? (
                          <input
                            autoFocus
                            type="text"
                            className="w-full bg-transparent text-center focus:outline-none text-white p-0 m-0 border-none h-full"
                            value={tempPage}
                            onChange={(e) => setTempPage(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const newPage = parseInt(tempPage);
                                const maxPage = Math.ceil(
                                  activeTab.result!.pagination!.total_rows /
                                    activeTab.result!.pagination!.page_size,
                                );
                                if (
                                  !isNaN(newPage) &&
                                  newPage >= 1 &&
                                  newPage <= maxPage
                                ) {
                                  runQuery(activeTab.query, newPage);
                                }
                                setIsEditingPage(false);
                              } else if (e.key === "Escape") {
                                setIsEditingPage(false);
                              }
                              e.stopPropagation();
                            }}
                            onBlur={() => setIsEditingPage(false)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <>
                            {t("editor.pageOf", { 
                                current: activeTab.result.pagination.page, 
                                total: Math.ceil(
                                    activeTab.result.pagination.total_rows /
                                      activeTab.result.pagination.page_size,
                                  )
                            })}
                          </>
                        )}
                      </div>

                      <button
                        disabled={
                          activeTab.result.pagination.page *
                            activeTab.result.pagination.page_size >=
                            activeTab.result.pagination.total_rows ||
                          activeTab.isLoading
                        }
                        onClick={() =>
                          runQuery(
                            activeTab.query,
                            activeTab.result!.pagination!.page + 1,
                          )
                        }
                        className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border-l border-slate-700"
                        title="Next Page"
                      >
                        <ChevronRight size={14} />
                      </button>
                      <button
                        disabled={
                          activeTab.result.pagination.page *
                            activeTab.result.pagination.page_size >=
                            activeTab.result.pagination.total_rows ||
                          activeTab.isLoading
                        }
                        onClick={() =>
                          runQuery(
                            activeTab.query,
                            Math.ceil(
                              activeTab.result!.pagination!.total_rows /
                                activeTab.result!.pagination!.page_size,
                            ),
                          )
                        }
                        className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border-l border-slate-700"
                        title="Last Page"
                      >
                        <ChevronsRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Data Manipulation Toolbar (Below Header) */}
                {activeTab.activeTable && activeTab.pkColumn && (
                    <div className="p-1 px-2 bg-slate-900 border-b border-slate-800 flex items-center gap-2">
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setShowNewRowModal(true)}
                                className="flex items-center justify-center w-7 h-7 text-slate-400 hover:text-green-400 hover:bg-slate-800 rounded transition-colors"
                                title={t("editor.newRow")}
                            >
                                <Plus size={16} />
                            </button>
                            <button
                                onClick={handleDeleteRows}
                                disabled={!activeTab.selectedRows || activeTab.selectedRows.length === 0}
                                className="flex items-center justify-center w-7 h-7 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors disabled:opacity-30"
                                title={t("dataGrid.deleteRow")}
                            >
                                <Minus size={16} />
                            </button>
                        </div>

                        {/* Separator */}
                        {(hasPendingChanges) && (
                            <div className="w-[1px] h-4 bg-slate-800 mx-1"></div>
                        )}
                        
                        {hasPendingChanges && (
                            <div className="flex items-center gap-1 ml-2 border border-blue-900 bg-blue-900/20 rounded px-1 py-0.5">
                                <button 
                                    onClick={handleSubmitChanges}
                                    disabled={!selectionHasPending}
                                    className="flex items-center gap-1.5 px-2 h-7 text-green-400 hover:bg-green-900/20 hover:text-green-300 rounded text-xs font-medium border border-transparent hover:border-green-900/50 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent disabled:cursor-not-allowed"
                                    title={t("editor.submitChanges")}
                                >
                                    <Check size={14} />
                                    <span>Submit</span>
                                </button>
                                <button 
                                    onClick={handleRollbackChanges}
                                    disabled={!selectionHasPending}
                                    className="flex items-center gap-1.5 px-2 h-7 text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded text-xs font-medium border border-transparent hover:border-slate-700 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent disabled:cursor-not-allowed"
                                    title={t("editor.rollbackChanges")}
                                >
                                    <Undo2 size={14} />
                                    <span>Rollback</span>
                                </button>
                                <span className="text-[10px] text-blue-400 bg-blue-900/20 border border-blue-900/30 px-2 py-0.5 rounded-full font-medium select-none ml-2">
                                    {(Object.keys(activeTab.pendingChanges || {}).length) + (Object.keys(activeTab.pendingDeletions || {}).length)} pending
                                </span>
                            </div>
                        )}

                    </div>
                )}

                <div className="flex-1 min-h-0 overflow-hidden">
                  <DataGrid
                    key={`${activeTab.id}-${activeTab.result.rows.length}-${JSON.stringify(activeTab.result.rows[0])}`}
                    columns={activeTab.result.columns}
                    data={activeTab.result.rows}
                    tableName={activeTab.activeTable}
                    pkColumn={activeTab.pkColumn}
                    connectionId={activeConnectionId}
                    onRefresh={handleRefresh}
                    pendingChanges={activeTab.pendingChanges}
                    pendingDeletions={activeTab.pendingDeletions}
                    onPendingChange={handlePendingChange}
                    selectedRows={new Set(activeTab.selectedRows || [])}
                    onSelectionChange={handleSelectionChange}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-600 text-sm">
                {t("editor.executePrompt")}
              </div>
            )}
          </div>
        </>
      ) : (
        // Show Results Button (when collapsed)
        <div className="h-10 bg-slate-900 border-t border-slate-800 flex items-center justify-end px-2">
          <button
            onClick={() => setIsResultsCollapsed(false)}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1 hover:bg-slate-800 rounded"
            title="Show Results Panel"
          >
            <ChevronUp size={16} />
          </button>
        </div>
      )}

      {activeTab.activeTable && (
        <NewRowModal
          isOpen={showNewRowModal}
          onClose={() => setShowNewRowModal(false)}
          tableName={activeTab.activeTable}
          onSaveSuccess={handleRefresh}
        />
      )}
      <QuerySelectionModal
        isOpen={isQuerySelectionModalOpen}
        queries={selectableQueries}
        onSelect={(q) => {
          runQuery(q, 1);
          setIsQuerySelectionModalOpen(false);
        }}
        onClose={() => setIsQuerySelectionModalOpen(false)}
      />
      {saveQueryModal.isOpen && (
        <QueryModal
          isOpen={saveQueryModal.isOpen}
          onClose={() =>
            setSaveQueryModal({ ...saveQueryModal, isOpen: false })
          }
          onSave={async (name, sql) => await saveQuery(name, sql)}
          initialSql={saveQueryModal.sql}
          title={t("editor.saveQuery")}
        />
      )}
      {tabContextMenu && (
        <ContextMenu
          x={tabContextMenu.x}
          y={tabContextMenu.y}
          onClose={() => setTabContextMenu(null)}
          items={[
            {
              label: t("editor.closeTab"),
              icon: X,
              action: () => closeTab(tabContextMenu.tabId),
            },
            {
              label: t("editor.closeOthers"),
              icon: XCircle,
              action: () => closeOtherTabs(tabContextMenu.tabId),
            },
            {
              label: t("editor.closeRight"),
              icon: ArrowRightToLine,
              action: () => closeTabsToRight(tabContextMenu.tabId),
            },
            {
              label: t("editor.closeLeft"),
              icon: ArrowLeftToLine,
              action: () => closeTabsToLeft(tabContextMenu.tabId),
            },
            {
              label: t("editor.closeAll"),
              icon: Trash2,
              danger: true,
              action: () => closeAllTabs(),
            },
          ]}
        />
      )}
    </div>
  );
};
