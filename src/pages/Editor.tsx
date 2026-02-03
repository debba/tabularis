import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AiQueryModal } from "../components/ui/AiQueryModal";
import { AiExplainModal } from "../components/ui/AiExplainModal";
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
  Sparkles,
  BookOpen,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { TableToolbar } from "../components/ui/TableToolbar";
import { DataGrid } from "../components/ui/DataGrid";
import { NewRowModal } from "../components/ui/NewRowModal";
import { QuerySelectionModal } from "../components/ui/QuerySelectionModal";
import { QueryModal } from "../components/ui/QueryModal";
import { QueryParamsModal } from "../components/modals/QueryParamsModal";
import { VisualQueryBuilder } from "../components/ui/VisualQueryBuilder";
import { ContextMenu } from "../components/ui/ContextMenu";
import { ExportProgressModal, type ExportStatus } from "../components/ui/ExportProgressModal";
import { splitQueries, extractTableName } from "../utils/sql";
import { extractQueryParams, interpolateQueryParams } from "../utils/queryParameters";
import { formatDuration } from "../utils/formatTime";
import { SqlEditorWrapper } from "../components/ui/SqlEditorWrapper";
import { registerSqlAutocomplete } from "../utils/autocomplete";
import { type OnMount, type Monaco } from "@monaco-editor/react";
import { save, message } from "@tauri-apps/plugin-dialog";
import { useDatabase } from "../hooks/useDatabase";
import { useSavedQueries } from "../hooks/useSavedQueries";
import { useSettings } from "../hooks/useSettings";
import { useEditor } from "../hooks/useEditor";
import type { QueryResult, Tab } from "../types/editor";
import clsx from "clsx";

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

interface ExportProgress {
    rows_processed: number;
}

export const Editor = () => {
  const { t } = useTranslation();
  const { activeConnectionId, tables } = useDatabase();
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

  const [exportState, setExportState] = useState<{
    isExporting: boolean; // Keep for backward compat or refactor logic
    isOpen: boolean;
    status: ExportStatus;
    rowsProcessed: number;
    fileName: string;
    errorMessage?: string;
  }>({
    isExporting: false,
    isOpen: false,
    status: "exporting",
    rowsProcessed: 0,
    fileName: "",
  });

  useEffect(() => {
    const unlisten = listen<ExportProgress>("export_progress", (event) => {
       setExportState(prev => ({ ...prev, rowsProcessed: event.payload.rows_processed }));
    });
    return () => {
        unlisten.then(f => f());
    };
  }, []);

  const handleTabContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setTabContextMenu({ x: e.clientX, y: e.clientY, tabId });
  };

  const handleConvertToConsole = useCallback((tabId: string) => {
      const tab = tabsRef.current.find(t => t.id === tabId);
      if (!tab) return;

      let query = tab.query;
      
      // Reconstruct query for table tabs (respecting active filters)
      if (tab.type === "table" && tab.activeTable) {
          const filter = tab.filterClause ? `WHERE ${tab.filterClause}` : "";
          const sort = tab.sortClause ? `ORDER BY ${tab.sortClause}` : "";
          
          let baseQuery = `SELECT * FROM ${tab.activeTable} ${filter} ${sort}`;
          
          if (tab.limitClause && tab.limitClause > 0) {
              baseQuery = `${baseQuery} LIMIT ${tab.limitClause}`;
          }
          
          query = baseQuery;
      }
      
      addTab({
          type: 'console',
          title: `Console - ${tab.title}`,
          query: query,
          connectionId: tab.connectionId
      });
  }, [addTab]);

  const [saveQueryModal, setSaveQueryModal] = useState<{
    isOpen: boolean;
    sql: string;
  }>({ isOpen: false, sql: "" });

  const [queryParamsModal, setQueryParamsModal] = useState<{
    isOpen: boolean;
    sql: string;
    parameters: string[];
    pendingPageNum: number;
    pendingTabId?: string;
    mode: "run" | "save";
  }>({ isOpen: false, sql: "", parameters: [], pendingPageNum: 1, mode: "save" });

  const [showNewRowModal, setShowNewRowModal] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [editorHeight, setEditorHeight] = useState(300);
  const [isResultsCollapsed, setIsResultsCollapsed] = useState(false);
  const isDragging = useRef(false);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const [monacoInstance, setMonacoInstance] = useState<Monaco | null>(null);

  const [selectableQueries, setSelectableQueries] = useState<string[]>([]);
  const [isQuerySelectionModalOpen, setIsQuerySelectionModalOpen] =
    useState(false);
  const [isRunDropdownOpen, setIsRunDropdownOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isAiExplainModalOpen, setIsAiExplainModalOpen] = useState(false);
  const [isEditingPage, setIsEditingPage] = useState(false);
  const [tempPage, setTempPage] = useState("1");
  const [applyToAll, setApplyToAll] = useState(false);

  const activeTabType = activeTab?.type;
  const activeTabQuery = activeTab?.query;
  const isTableTab = activeTab?.type === "table";
  const isEditorOpen =
    !isTableTab &&
    (activeTab?.isEditorOpen ?? activeTab?.type !== "table");

  // Define updateActiveTab first to be used in handleQueryChange
  const updateActiveTab = useCallback(
    (partial: Partial<Tab>) => {
      if (activeTabId) updateTab(activeTabId, partial);
    },
    [activeTabId, updateTab],
  );

  // Placeholder Logic - memoized to avoid recalculation on every render

  const placeholders = useMemo(() => ({
    column: activeTab?.result?.columns?.[0] || 'id',
    sort: activeTab?.result?.columns?.[0] || 'created_at'
  }), [activeTab?.result?.columns]);

  const dropdownQueries = useMemo(() => {
    if (activeTabType === "query_builder" && activeTabQuery) {
      return [activeTabQuery];
    }
    return selectableQueries;
  }, [activeTabType, activeTabQuery, selectableQueries]);

  const tabsRef = useRef<Tab[]>([]);
  const activeTabIdRef = useRef<string | null>(null);
  const processingRef = useRef<string | null>(null);
  const pendingExecutionsRef = useRef<Record<string, { sql: string, page: number }>>({});

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
    async (
      sql?: string,
      pageNum: number = 1,
      tabId?: string,
      paramsOverride?: Record<string, string>,
      filterOverride?: string,
      sortOverride?: string,
      limitOverride?: number,
      preservePendingChanges?: { pendingChanges?: Record<string, { pkOriginalValue: unknown; changes: Record<string, unknown> }>; pendingDeletions?: Record<string, unknown> }
    ) => {
      const targetTabId = tabId || activeTabIdRef.current;
      if (!activeConnectionId || !targetTabId) return;

      const targetTab = tabsRef.current.find((t) => t.id === targetTabId);
      if (!targetTab) return;

      let textToRun = sql?.trim() || targetTab?.query;

      // For Table Tabs, reconstruct query if filter/sort are present
      if (targetTab?.type === "table" && targetTab.activeTable) {
          // Use overrides if provided, otherwise use tab values
          const filterClause = filterOverride !== undefined ? filterOverride : targetTab.filterClause;
          const sortClause = sortOverride !== undefined ? sortOverride : targetTab.sortClause;
          const limitClause = limitOverride !== undefined ? limitOverride : targetTab.limitClause;

          const filter = filterClause ? `WHERE ${filterClause}` : "";
          const sort = sortClause ? `ORDER BY ${sortClause}` : "";

          const baseQuery = `SELECT * FROM ${targetTab.activeTable} ${filter} ${sort}`;

          if (limitClause && limitClause > 0) {
              // Wrap in subquery to apply "Total Limit" while allowing pagination (Page Size) via backend
              textToRun = `SELECT * FROM (${baseQuery} LIMIT ${limitClause}) AS limited_subset`;
          } else {
              textToRun = baseQuery;
          }
      }

      if (!textToRun || !textToRun.trim()) return;

      // Check for parameters
      const params = extractQueryParams(textToRun);
      if (params.length > 0) {
          const storedParams = paramsOverride || targetTab.queryParams || {};
          const missingParams = params.filter(p => 
              storedParams[p] === undefined || storedParams[p].trim() === ""
          );
          
          // If we have missing params
          if (missingParams.length > 0) {
              setQueryParamsModal({
                  isOpen: true,
                  sql: textToRun,
                  parameters: params,
                  pendingPageNum: pageNum,
                  pendingTabId: targetTabId,
                  mode: "run"
              });
              return;
          }
          
          // Interpolate parameters before execution
          textToRun = interpolateQueryParams(textToRun, storedParams);
      }

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
        // Clear pending changes and selection when running a new query (unless preserving)
        pendingChanges: preservePendingChanges?.pendingChanges,
        pendingDeletions: preservePendingChanges?.pendingDeletions,
        selectedRows: [],
      });

      try {
        const start = performance.now();
        // Use settings.resultPageSize for Page Size (pagination), ignoring the "Total Limit" input which is handled in SQL
        // Fallback to 100 if settings not loaded yet
        const pageSize = (settings.resultPageSize && settings.resultPageSize > 0) ? settings.resultPageSize : 100;

        const res = await invoke<QueryResult>("execute_query", {
          connectionId: activeConnectionId,
          query: textToRun,
          limit: pageSize,
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
    [activeConnectionId, updateTab, settings.resultPageSize, fetchPkColumn, t],
  );

  const handleRunButton = useCallback(() => {
    if (!activeTab) return;

    // Table Tab: run query with filter/sort/limit from activeTab
    if (activeTab.type === "table") {
      runQuery(undefined, 1);
      return;
    }

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
    const currentTab = tabsRef.current.find(t => t.id === activeTabIdRef.current);
    if (currentTab?.activeTable && activeConnectionId)
      runQuery(currentTab.query, currentTab.page);
  }, [activeConnectionId, runQuery]);

  const handleToolbarUpdate = useCallback((filter: string, sort: string, limit: number | undefined) => {
    if (!activeTabIdRef.current) return;

    updateTab(activeTabIdRef.current, {
        filterClause: filter,
        sortClause: sort,
        limitClause: limit
    });

    // Pass values directly to runQuery to avoid race conditions with ref updates
    runQuery(undefined, 1, undefined, undefined, filter, sort, limit);
  }, [updateTab, runQuery]);

  const handleSort = useCallback((colName: string) => {
    if (!activeTab) return;

    const currentSort = activeTab.sortClause || "";
    const parts = currentSort.trim().split(/\s+/);

    let newSort = "";

    // Check if we are currently sorting by this column
    if (parts[0] === colName && parts.length <= 2) {
        // Toggle logic
        const currentDir = parts[1]?.toUpperCase();

        if (!currentDir || currentDir === 'ASC') {
            // ASC -> DESC
            newSort = `${colName} DESC`;
        } else {
             // DESC -> None (Clear)
             newSort = "";
        }
    } else {
        // New column -> ASC
        newSort = `${colName} ASC`;
    }

    handleToolbarUpdate(activeTab.filterClause || "", newSort, activeTab.limitClause);
  }, [activeTab, handleToolbarUpdate]);

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

    // Filter pending changes by selected rows IF there is a selection AND applyToAll is false
    const hasSelection = !applyToAll && selectedRows && selectedRows.length > 0;
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
            // Apply filter if selection exists (and applyToAll is false)
            if (hasSelection && !selectedPkSet.has(pkKey)) continue;

            const { pkOriginalValue, changes } = rowData;
            for (const [colName, newVal] of Object.entries(changes)) {
                updates.push({ pkVal: pkOriginalValue, colName, newVal });
            }
        }
    }

    if (pendingDeletions) {
        for (const [pkKey, pkVal] of Object.entries(pendingDeletions)) {
             // Apply filter if selection exists (and applyToAll is false)
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

        // Partial cleanup - remove only processed changes
        updates.forEach(u => delete newPendingChanges[String(u.pkVal)]);
        deletions.forEach(d => delete newPendingDeletions[String(d)]);

        // Cleanup empty change objects
        Object.keys(newPendingChanges).forEach(key => {
            if (Object.keys(newPendingChanges[key]?.changes || {}).length === 0) delete newPendingChanges[key];
        });

        const remainingChanges = Object.keys(newPendingChanges).length > 0 ? newPendingChanges : undefined;
        const remainingDeletions = Object.keys(newPendingDeletions).length > 0 ? newPendingDeletions : undefined;

        // Refresh query preserving remaining pending changes
        runQuery(
            activeTab.query,
            activeTab.page,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            { pendingChanges: remainingChanges, pendingDeletions: remainingDeletions }
        );
    } catch (e) {
        console.error("Batch update failed", e);
        updateActiveTab({ isLoading: false });
        await message(t('dataGrid.updateFailed') + String(e), { title: t('common.error'), kind: 'error' });
    }
  }, [activeTab, activeConnectionId, updateActiveTab, runQuery, t, applyToAll]);

  const handleParamsSubmit = useCallback((values: Record<string, string>) => {
    const { pendingTabId, mode, sql, pendingPageNum } = queryParamsModal;
    if (!pendingTabId) return;

    // Update tab with new params (merge with existing)
    const currentTab = tabsRef.current.find(t => t.id === pendingTabId);
    const newParams = { ...(currentTab?.queryParams || {}), ...values };
    
    updateTab(pendingTabId, { queryParams: newParams });
    
    // Close modal
    setQueryParamsModal(prev => ({ ...prev, isOpen: false }));

    // If mode was run, execute query immediately
    if (mode === "run") {
        runQuery(sql, pendingPageNum, pendingTabId, newParams);
    }
  }, [queryParamsModal, updateTab, runQuery]);

  const handleEditParams = useCallback(() => {
    if (!activeTab || !activeTab.query) return;
    
    const params = extractQueryParams(activeTab.query);
    if (params.length === 0) return;

    setQueryParamsModal({
        isOpen: true,
        sql: activeTab.query,
        parameters: params,
        pendingPageNum: 1,
        pendingTabId: activeTab.id,
        mode: "save"
    });
  }, [activeTab]);

  const handleRollbackChanges = useCallback(() => {
    if (!activeTab) return;
    const { selectedRows, result, pkColumn, pendingChanges, pendingDeletions } = activeTab;

    // If applyToAll is true OR no selection, rollback everything
    if (applyToAll || !selectedRows || selectedRows.length === 0) {
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

  }, [activeTab, updateActiveTab, applyToAll]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    setMonacoInstance(monaco);
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
    if (monacoInstance && activeConnectionId) {
      const disposable = registerSqlAutocomplete(
        monacoInstance,
        activeConnectionId,
        tables
      );
      return () => disposable.dispose();
    }
  }, [monacoInstance, activeConnectionId, tables]);

  useEffect(() => {
    const state = location.state as EditorState;
    if (activeConnectionId) {
      if (state?.initialQuery) {
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

      if (tabId) {
        // Queue execution
        pendingExecutionsRef.current[tabId] = { sql: sql || "", page: 1 };

        // Try immediate execution if tab exists (reused)
        const existingTab = tabsRef.current.find((t) => t.id === tabId);
        if (existingTab) {
          runQuery(sql, 1, tabId);
          delete pendingExecutionsRef.current[tabId];
        }
      }

      navigate(location.pathname, { replace: true, state: {} });
      setTimeout(() => {
        processingRef.current = null;
      }, 500);
    }
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

  // Process pending executions when tabs are created/updated
  useEffect(() => {
    Object.keys(pendingExecutionsRef.current).forEach((tabId) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (tab) {
        const { sql, page } = pendingExecutionsRef.current[tabId];
        runQuery(sql, page, tabId);
        delete pendingExecutionsRef.current[tabId];
      }
    });
  }, [tabs, runQuery]);

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

  const cancelExport = useCallback(async () => {
      if (!activeConnectionId) return;
      try {
          await invoke("cancel_export", { connectionId: activeConnectionId });
          setExportState(prev => ({ ...prev, isOpen: false, isExporting: false }));
      } catch (e) {
          console.error("Failed to cancel export", e);
      }
  }, [activeConnectionId]);

  const closeExportModal = useCallback(() => {
      setExportState(prev => ({ ...prev, isOpen: false, isExporting: false }));
  }, []);

  const handleExportCommon = async (format: "csv" | "json") => {
    if (!activeTab || !activeConnectionId) return;

    let query = activeTab.query;

    // For Table Tabs, reconstruct query (ignoring Page Size limit, but respecting User Limit)
    if (activeTab.type === "table" && activeTab.activeTable) {
        const filter = activeTab.filterClause ? `WHERE ${activeTab.filterClause}` : "";
        const sort = activeTab.sortClause ? `ORDER BY ${activeTab.sortClause}` : "";
        
        // Base query
        let baseQuery = `SELECT * FROM ${activeTab.activeTable} ${filter} ${sort}`;
        
        // Apply user manual limit if present
        if (activeTab.limitClause && activeTab.limitClause > 0) {
            baseQuery = `${baseQuery} LIMIT ${activeTab.limitClause}`;
        }
        
        query = baseQuery;
    }

    if (!query || !query.trim()) return;

    try {
        const filePath = await save({
            filters: [{ name: format.toUpperCase(), extensions: [format] }],
            defaultPath: `result_${Date.now()}.${format}`,
        });

        if (!filePath) return;

        setExportState({
            isOpen: true,
            isExporting: true,
            status: "exporting",
            rowsProcessed: 0,
            fileName: filePath.split(/[/\\]/).pop() || filePath, // Show only filename
        });
        setExportMenuOpen(false);

        await invoke("export_query_to_file", {
            connectionId: activeConnectionId,
            query,
            filePath,
            format
        });
        
        // Success: update modal state instead of showing toast
        setExportState(prev => ({ ...prev, isExporting: false, status: "completed" }));
    } catch (e) {
        // Error: update modal state
        setExportState(prev => ({ 
            ...prev, 
            isExporting: false, 
            status: "error", 
            errorMessage: String(e) 
        }));
    }
  };

  const handleExportCSV = () => handleExportCommon("csv");
  const handleExportJSON = () => handleExportCommon("json");

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
      <div className="flex flex-col h-full bg-base items-center justify-center text-muted">
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
    <div className="flex flex-col h-full bg-base">
      {/* Tab Bar */}
      <div className="flex items-center bg-elevated border-b border-default h-9 shrink-0">
        <div className="flex flex-1 overflow-x-auto no-scrollbar h-full">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              onContextMenu={(e) => handleTabContextMenu(e, tab.id)}
              className={clsx(
                "flex items-center gap-2 px-3 h-full border-r border-default cursor-pointer min-w-[140px] max-w-[220px] text-xs transition-all group relative select-none",
                activeTabId === tab.id
                  ? "bg-base text-primary font-medium"
                  : "text-muted hover:bg-surface-secondary hover:text-secondary",
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
                  "p-0.5 rounded-sm hover:bg-surface-secondary transition-opacity shrink-0",
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
          className="flex items-center justify-center w-9 h-full text-muted hover:text-white hover:bg-surface-secondary border-l border-default transition-colors shrink-0"
          title={t("editor.newConsole")}
        >
          <Plus size={16} />
        </button>
        <button
          onClick={() => addTab({ type: "query_builder" })}
          className="flex items-center justify-center w-9 h-full text-purple-500 hover:text-white hover:bg-surface-secondary border-l border-default transition-colors shrink-0"
          title={t("editor.newVisualQuery")}
        >
          <Network size={16} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center p-2 border-b border-default bg-elevated gap-2 h-[50px]">
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
                    <div className="absolute top-full left-0 mt-1 w-80 bg-surface-secondary border border-strong rounded shadow-xl z-50 flex flex-col py-1 max-h-80 overflow-y-auto">
                      {dropdownQueries.length === 0 ? (
                        <div className="px-4 py-2 text-xs text-muted italic">
                          {t("editor.noValidQueries")}
                        </div>
                      ) : (
                        dropdownQueries.map((q, i) => (
                          <div
                            key={i}
                            className="flex items-center border-b border-strong/50 last:border-0 hover:bg-surface-tertiary/50 transition-colors group"
                          >
                            <button
                              onClick={() => {
                                runQuery(q, 1);
                                setIsRunDropdownOpen(false);
                              }}
                              className="text-left px-4 py-2 text-xs font-mono text-secondary hover:text-white flex-1 truncate"
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
                              className="p-2 text-muted hover:text-white hover:bg-surface transition-colors mr-1 rounded shrink-0 opacity-0 group-hover:opacity-100"
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

        {/* Params Button */}
        {!isTableTab && (
          <button
              onClick={handleEditParams}
              disabled={!activeTab?.query || extractQueryParams(activeTab.query).length === 0}
              className="flex items-center gap-2 px-3 py-1.5 bg-surface-secondary hover:bg-surface text-primary rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed border border-strong"
              title={t("editor.queryParameters")}
          >
              <span className="font-mono text-xs font-bold border border-muted text-secondary rounded px-1.5 py-0.5">P</span>
              {t("editor.parameters")}
          </button>
        )}

        {/* AI Assist Button */}
        {!isTableTab && activeTab.type !== "query_builder" && settings.aiEnabled && (
           <div className="flex items-center gap-1 ml-2">
             <button
               onClick={() => setIsAiModalOpen(true)}
               disabled={!activeConnectionId}
               className="flex items-center gap-2 px-3 py-1.5 bg-purple-900/40 hover:bg-purple-900/60 text-purple-200 border border-purple-500/30 rounded text-sm font-medium transition-colors disabled:opacity-50"
               title="Generate SQL with AI"
             >
               <Sparkles size={16} />
               <span className="hidden sm:inline">AI Assist</span>
             </button>
             <button
               onClick={() => setIsAiExplainModalOpen(true)}
               disabled={!activeConnectionId || !activeTab.query?.trim()}
               className="flex items-center gap-2 px-3 py-1.5 bg-blue-900/40 hover:bg-blue-900/60 text-blue-200 border border-blue-500/30 rounded text-sm font-medium transition-colors disabled:opacity-50"
               title="Explain this Query"
             >
               <BookOpen size={16} />
               <span className="hidden sm:inline">Explain</span>
             </button>
           </div>
        )}

        <div className="relative ml-auto">
          <button
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            disabled={!activeTab.result || activeTab.result.rows.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-surface-secondary hover:bg-surface text-primary rounded text-sm font-medium disabled:opacity-50 border border-strong"
          >
            <Download size={16} /> {t("editor.export")}
          </button>
          {exportMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setExportMenuOpen(false)}
              />
              <div className="absolute top-full left-0 mt-1 w-40 bg-surface-secondary border border-strong rounded shadow-xl z-50 flex flex-col py-1">
                <button
                  onClick={handleExportCSV}
                  className="text-left px-4 py-2 text-sm text-secondary hover:bg-surface"
                >
                  CSV (.csv)
                </button>
                <button
                  onClick={handleExportJSON}
                  className="text-left px-4 py-2 text-sm text-secondary hover:bg-surface"
                >
                  JSON (.json)
                </button>
              </div>
            </>
          )}
        </div>
        <span className="text-xs text-muted ml-2">
          {activeConnectionId ? t("editor.connected") : t("editor.disconnected")}
        </span>
      </div>

      {/* Render all non-table tabs to prevent Monaco remounting */}
      {tabs.map((tab) => {
        if (tab.type === "table") return null;
        
        const isActive = tab.id === activeTabId;
        const isVisible = isActive && !isTableTab && isEditorOpen;
        
        return (
          <div
            key={tab.id}
            style={{
              height: isResultsCollapsed ? "calc(100vh - 109px)" : editorHeight,
              display: isVisible ? "block" : "none",
            }}
            className="relative"
          >
            {tab.type === "query_builder" ? (
              <VisualQueryBuilder />
            ) : (
              <SqlEditorWrapper
                height="100%"
                initialValue={tab.query}
                onChange={(val) => {
                  if (isActive) updateTab(tab.id, { query: val });
                }}
                onRun={handleRunButton}
                onMount={isActive ? handleEditorMount : undefined}
                editorKey={tab.id}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  padding: { top: 16 },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  wordWrap: "on",
                }}
              />
            )}
          </div>
        );
      })}

      {/* Resize Bar & Results Panel */}
      {isTableTab || !isResultsCollapsed ? (
        <>
          {isTableTab ? (
             <TableToolbar
                initialFilter={activeTab?.filterClause}
                initialSort={activeTab?.sortClause}
                initialLimit={activeTab?.limitClause}
                placeholderColumn={placeholders.column}
                placeholderSort={placeholders.sort}
                defaultLimit={settings.resultPageSize || 100}
                onUpdate={handleToolbarUpdate}
             />
          ) : (
            <div
              onMouseDown={isEditorOpen ? startResize : undefined}
              className={clsx(
                "h-6 bg-elevated border-y border-default flex items-center px-2 relative",
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
                  className="text-muted hover:text-secondary transition-colors p-1 hover:bg-surface-secondary rounded flex items-center gap-1 text-xs"
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
                  className="text-muted hover:text-secondary transition-colors p-1 hover:bg-surface-secondary rounded"
                  title="Hide Results Panel (Maximize Editor)"
                >
                  <ChevronDown size={16} />
                </button>
              )}
            </div>
          )}

          {/* Results Panel */}
          <div className="flex-1 overflow-hidden bg-elevated flex flex-col min-h-0">
            {activeTab.isLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-muted">
                <div className="w-12 h-12 border-4 border-surface-secondary border-t-blue-500 rounded-full animate-spin mb-4"></div>
                <p className="text-sm">{t("editor.executingQuery")}</p>
              </div>
            ) : activeTab.error ? (
              <div className="p-4 text-red-400 font-mono text-sm bg-red-900/10 h-full overflow-auto whitespace-pre-wrap">
                Error: {activeTab.error}
              </div>
            ) : activeTab.result ? (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="p-2 bg-elevated text-xs text-secondary border-b border-default flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-4">
                    <span>
                      {t("editor.rowsRetrieved", { count: activeTab.result.rows.length })}{" "}
                      {activeTab.executionTime !== null && (
                        <span className="text-muted ml-2 font-mono">
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
                    <div className="flex items-center gap-1 bg-surface-secondary rounded border border-strong">
                      <button
                        disabled={
                          activeTab.result.pagination.page === 1 ||
                          activeTab.isLoading
                        }
                        onClick={() => runQuery(activeTab.query, 1)}
                        className="p-1 hover:bg-surface-tertiary text-secondary hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
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
                        className="p-1 hover:bg-surface-tertiary text-secondary hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border-l border-strong"
                        title="Previous Page"
                      >
                        <ChevronLeft size={14} />
                      </button>

                      <div
                        className="px-3 text-secondary text-xs font-medium cursor-pointer hover:bg-surface-tertiary transition-colors min-w-[80px] text-center py-1"
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
                        className="p-1 hover:bg-surface-tertiary text-secondary hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border-l border-strong"
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
                        className="p-1 hover:bg-surface-tertiary text-secondary hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border-l border-strong"
                        title="Last Page"
                      >
                        <ChevronsRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Data Manipulation Toolbar (Below Header) */}
                {activeTab.activeTable && activeTab.pkColumn && (
                    <div className="p-1 px-2 bg-elevated border-b border-default flex items-center gap-2">
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setShowNewRowModal(true)}
                                className="flex items-center justify-center w-7 h-7 text-secondary hover:text-green-400 hover:bg-surface-secondary rounded transition-colors"
                                title={t("editor.newRow")}
                            >
                                <Plus size={16} />
                            </button>
                            <button
                                onClick={handleDeleteRows}
                                disabled={!activeTab.selectedRows || activeTab.selectedRows.length === 0}
                                className="flex items-center justify-center w-7 h-7 text-secondary hover:text-red-400 hover:bg-surface-secondary rounded transition-colors disabled:opacity-30"
                                title={t("dataGrid.deleteRow")}
                            >
                                <Minus size={16} />
                            </button>
                        </div>

                        {/* Separator */}
                        {(hasPendingChanges) && (
                            <div className="w-[1px] h-4 bg-surface-secondary mx-1"></div>
                        )}
                        
                        {hasPendingChanges && (
                            <div className="flex items-center gap-1 ml-2 border border-blue-900 bg-blue-900/20 rounded px-1 py-0.5">
                                <label className="flex items-center gap-1.5 px-2 py-1 cursor-pointer select-none group">
                                    <input
                                        type="checkbox"
                                        checked={applyToAll}
                                        onChange={(e) => setApplyToAll(e.target.checked)}
                                        className="w-3.5 h-3.5 cursor-pointer accent-blue-500"
                                    />
                                    <span className="text-[10px] text-secondary group-hover:text-primary transition-colors">
                                        {t("editor.applyToAll")}
                                    </span>
                                </label>
                                <div className="w-[1px] h-4 bg-blue-900/50 mx-0.5"></div>
                                <button
                                    onClick={handleSubmitChanges}
                                    disabled={!applyToAll && !selectionHasPending}
                                    className="flex items-center gap-1.5 px-2 h-7 text-green-400 hover:bg-green-900/20 hover:text-green-300 rounded text-xs font-medium border border-transparent hover:border-green-900/50 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent disabled:cursor-not-allowed"
                                    title={t("editor.submitChanges")}
                                >
                                    <Check size={14} />
                                    <span>Submit</span>
                                </button>
                                <button
                                    onClick={handleRollbackChanges}
                                    disabled={!applyToAll && !selectionHasPending}
                                    className="flex items-center gap-1.5 px-2 h-7 text-secondary hover:bg-surface-secondary hover:text-primary rounded text-xs font-medium border border-transparent hover:border-strong transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent disabled:cursor-not-allowed"
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
                    key={`${activeTab.id}-${activeTab.sortClause || 'none'}-${activeTab.filterClause || 'none'}-${activeTab.result.rows.length}`}
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
                    sortClause={activeTab.sortClause}
                    onSort={activeTab.type === 'table' ? handleSort : undefined}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-surface-tertiary text-sm">
                {t("editor.executePrompt")}
              </div>
            )}
          </div>
        </>
      ) : (
        // Show Results Button (when collapsed)
        <div className="h-10 bg-elevated border-t border-default flex items-center justify-end px-2">
          <button
            onClick={() => setIsResultsCollapsed(false)}
            className="text-muted hover:text-secondary transition-colors p-1 hover:bg-surface-secondary rounded"
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
      <AiQueryModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onInsert={(q) => {
            updateActiveTab({ query: q });
            runQuery(q, 1);
        }}
      />
      <AiExplainModal
        isOpen={isAiExplainModalOpen}
        onClose={() => setIsAiExplainModalOpen(false)}
        query={activeTab.query}
      />
      {tabContextMenu && (
        <ContextMenu
          x={tabContextMenu.x}
          y={tabContextMenu.y}
          onClose={() => setTabContextMenu(null)}
          items={[
            ...(tabs.find(t => t.id === tabContextMenu.tabId)?.type !== 'console' ? [{
                label: t("editor.convertToConsole"),
                icon: FileCode,
                action: () => handleConvertToConsole(tabContextMenu.tabId),
            }] : []),
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
      <ExportProgressModal 
        isOpen={exportState.isOpen} 
        status={exportState.status}
        rowsProcessed={exportState.rowsProcessed} 
        fileName={exportState.fileName}
        errorMessage={exportState.errorMessage}
        onCancel={cancelExport} 
        onClose={closeExportModal}
      />
      <QueryParamsModal 
        isOpen={queryParamsModal.isOpen}
        onClose={() => setQueryParamsModal(prev => ({ ...prev, isOpen: false }))}
        onSubmit={handleParamsSubmit}
        parameters={queryParamsModal.parameters}
        initialValues={
             tabsRef.current.find(t => t.id === queryParamsModal.pendingTabId)?.queryParams || {}
        }
        mode={queryParamsModal.mode}
      />
    </div>
  );
};
