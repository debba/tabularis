import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Play,
  Plus,
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
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DataGrid } from "../components/ui/DataGrid";
import { NewRowModal } from "../components/ui/NewRowModal";
import { QuerySelectionModal } from "../components/ui/QuerySelectionModal";
import { QueryModal } from "../components/ui/QueryModal";
import { VisualQueryBuilder } from "../components/ui/VisualQueryBuilder";
import { splitQueries } from "../utils/sql";
import MonacoEditor, { type OnMount } from "@monaco-editor/react";
import { save } from "@tauri-apps/plugin-dialog";
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

export const Editor = () => {
  const { activeConnectionId, activeDatabaseName } = useDatabase();
  const { settings } = useSettings();
  const { saveQuery } = useSavedQueries();
  const { tabs, activeTab, activeTabId, updateTab, addTab, setActiveTabId, closeTab } = useEditor();
  const location = useLocation();
  const navigate = useNavigate();

  const [saveQueryModal, setSaveQueryModal] = useState<{ isOpen: boolean; sql: string }>({ isOpen: false, sql: "" });
  const [showNewRowModal, setShowNewRowModal] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [editorHeight, setEditorHeight] = useState(300);
  const [isResultsCollapsed, setIsResultsCollapsed] = useState(false);
  const isDragging = useRef(false);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const [selectableQueries, setSelectableQueries] = useState<string[]>([]);
  const [isQuerySelectionModalOpen, setIsQuerySelectionModalOpen] = useState(false);
  const [isRunDropdownOpen, setIsRunDropdownOpen] = useState(false);
  
  const tabsRef = useRef<Tab[]>([]);
  const activeTabIdRef = useRef<string | null>(null);
  const processingRef = useRef<string | null>(null);

  useEffect(() => {
    tabsRef.current = tabs;
    activeTabIdRef.current = activeTabId;
  }, [tabs, activeTabId]);

  useEffect(() => {
    const updateTitle = async () => {
      try {
        const win = getCurrentWindow();
        if (activeDatabaseName) await win.setTitle(`debba.sql - ${activeDatabaseName}`);
        else await win.setTitle("debba.sql");
      } catch (e) {
        console.error("Failed to update window title", e);
      }
    };
    updateTitle();
  }, [activeDatabaseName]);

  const updateActiveTab = useCallback((partial: Partial<Tab>) => {
    if (activeTabId) updateTab(activeTabId, partial);
  }, [activeTabId, updateTab]);

  const fetchPkColumn = useCallback(async (table: string, tabId?: string) => {
    if (!activeConnectionId) return;
    try {
      const cols = await invoke<TableColumn[]>("get_columns", { connectionId: activeConnectionId, tableName: table });
      const pk = cols.find((c) => c.is_pk);
      const targetId = tabId || activeTabId;
      if (targetId) updateTab(targetId, { pkColumn: pk ? pk.name : null });
    } catch (e) {
      console.error("Failed to fetch PK:", e);
    }
  }, [activeConnectionId, activeTabId, updateTab]);

  const stopQuery = useCallback(async () => {
    if (!activeConnectionId) return;
    try {
      await invoke("cancel_query", { connectionId: activeConnectionId });
      updateActiveTab({ isLoading: false });
    } catch (e) {
      console.error("Failed to stop:", e);
    }
  }, [activeConnectionId, updateActiveTab]);

  const runQuery = useCallback(async (sql?: string, pageNum: number = 1, tabId?: string) => {
    const targetTabId = tabId || activeTabIdRef.current;
    if (!activeConnectionId || !targetTabId) return;
    
    const targetTab = tabsRef.current.find(t => t.id === targetTabId);
    const textToRun = sql?.trim() || targetTab?.query;
    if (!textToRun || !textToRun.trim()) return;

    updateTab(targetTabId, { isLoading: true, error: "", result: null, executionTime: null, page: pageNum });

    try {
      const start = performance.now();
      const res = await invoke<QueryResult>("execute_query", {
        connectionId: activeConnectionId,
        query: textToRun,
        limit: settings.queryLimit > 0 ? settings.queryLimit : null,
        page: pageNum,
      });
      const end = performance.now();
      updateTab(targetTabId, { result: res, executionTime: end - start, isLoading: false });
      
      const tableName = targetTab?.activeTable || (sql?.toLowerCase().includes("from") ? null : null); // Simple heuristics
      if (tableName) fetchPkColumn(tableName, targetTabId);
    } catch (err) {
      updateTab(targetTabId, { error: typeof err === "string" ? err : "Query failed.", isLoading: false });
    }
  }, [activeConnectionId, updateTab, settings.queryLimit, fetchPkColumn]);

  const handleRunButton = useCallback(() => {
    if (!activeTab) return;

    // Visual Query Builder: run the generated SQL directly
    if (activeTab.type === 'query_builder') {
      if (activeTab.query && activeTab.query.trim()) {
        runQuery(activeTab.query, 1);
      }
      return;
    }

    // Monaco Editor: handle selection and multi-query
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const selection = editor.getSelection();
    const selectedText = selection ? editor.getModel()?.getValueInRange(selection) : undefined;

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
    if (activeTab?.activeTable && activeConnectionId) runQuery(activeTab.query, activeTab.page);
  }, [activeTab, activeConnectionId, runQuery]);

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
        runQuery(selectedText && !selection?.isEmpty() ? selectedText : ed.getValue(), 1);
      },
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, handleRunButton);
  };

  useEffect(() => {
    const state = location.state as any;
    if (activeConnectionId && state?.initialQuery) {
      const queryKey = `${state.initialQuery}-${state.tableName}`;
      if (processingRef.current === queryKey) return;
      processingRef.current = queryKey;

      const { initialQuery: sql, tableName: table } = state;
      const tabId = addTab({ type: table ? 'table' : 'console', title: table, query: sql, activeTable: table });
      
      if (tabId) runQuery(sql, 1, tabId);
      
      navigate(location.pathname, { replace: true, state: {} });
      setTimeout(() => { processingRef.current = null; }, 500);
    }
  }, [location.state, location.pathname, activeConnectionId, addTab, navigate, runQuery]);

  const startResize = () => {
    isDragging.current = true;
    const handleResize = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newHeight = e.clientY - 50;
      if (newHeight > 100 && newHeight < window.innerHeight - 150) setEditorHeight(newHeight);
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
      const filePath = await save({ filters: [{ name: "CSV", extensions: ["csv"] }], defaultPath: `result_${Date.now()}.csv` });
      if (!filePath) return;
      const headers = result.columns.join(",");
      const rows = result.rows.map((row: any[]) => row.map((cell: any) => {
        if (cell === null) return "NULL";
        const str = String(cell);
        return (str.includes(",") || str.includes('"') || str.includes("\n")) ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(",")).join("\n");
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
      const filePath = await save({ filters: [{ name: "JSON", extensions: ["json"] }], defaultPath: `result_${Date.now()}.json` });
      if (!filePath) return;
      const data = result.rows.map((row: any[]) => {
        const obj: any = {};
        result.columns.forEach((col, i) => obj[col] = row[i]);
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
        // Visual Query Builder: use the generated query
        if (activeTab?.type === 'query_builder') {
            const queries = activeTab.query ? [activeTab.query] : [];
            setSelectableQueries(queries);
        } 
        // Monaco Editor: split queries from editor
        else if (editorRef.current) {
            const text = editorRef.current.getValue();
            const queries = splitQueries(text);
            setSelectableQueries(queries);
        }
    }
    setIsRunDropdownOpen(prev => !prev);
  }, [isRunDropdownOpen, activeTab]);

  if (!activeTab) {
    return (
      <div className="flex flex-col h-full bg-slate-950 items-center justify-center text-slate-500">
        <Database size={48} className="mb-4 opacity-20" />
        {activeConnectionId ? (
          <div className="text-center">
            <p className="mb-4">No open tabs for this connection.</p>
            <button onClick={() => addTab({ type: 'console' })} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors">New Console</button>
          </div>
        ) : <p>No active session. Please select a connection.</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Tab Bar */}
      <div className="flex items-center bg-slate-900 border-b border-slate-800 h-9 shrink-0">
        <div className="flex flex-1 overflow-x-auto no-scrollbar h-full">
          {tabs.map((tab) => (
            <div key={tab.id} onClick={() => setActiveTabId(tab.id)} className={clsx("flex items-center gap-2 px-3 h-full border-r border-slate-800 cursor-pointer min-w-[140px] max-w-[220px] text-xs transition-all group relative select-none", activeTabId === tab.id ? "bg-slate-950 text-slate-100 font-medium" : "text-slate-500 hover:bg-slate-800 hover:text-slate-300")}>
              {activeTabId === tab.id && <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-500" />}
              {tab.type === 'table' ? <TableIcon size={12} className="text-blue-400 shrink-0" /> : tab.type === 'query_builder' ? <Network size={12} className="text-purple-400 shrink-0" /> : <FileCode size={12} className="text-green-500 shrink-0" />}
              <span className="truncate flex-1">{tab.title}</span>
              <button onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }} className={clsx("p-0.5 rounded-sm hover:bg-slate-700 transition-opacity shrink-0", activeTabId === tab.id ? "opacity-100" : "opacity-0 group-hover:opacity-100")}><X size={12} /></button>
              {tab.isLoading && <div className="absolute bottom-0 left-0 h-0.5 bg-blue-500 animate-pulse w-full" />}
            </div>
          ))}
        </div>
        <button onClick={() => addTab({ type: 'console' })} className="flex items-center justify-center w-9 h-full text-slate-500 hover:text-white hover:bg-slate-800 border-l border-slate-800 transition-colors shrink-0" title="New Console"><Plus size={16} /></button>
        <button onClick={() => addTab({ type: 'query_builder' })} className="flex items-center justify-center w-9 h-full text-purple-500 hover:text-white hover:bg-slate-800 border-l border-slate-800 transition-colors shrink-0" title="New Visual Query"><Network size={16} /></button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center p-2 border-b border-slate-800 bg-slate-900 gap-2 h-[50px]">
        {activeTab.isLoading ? (
          <button onClick={stopQuery} className="flex items-center gap-2 px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded text-sm font-medium"><Square size={16} fill="currentColor" /> Stop</button>
        ) : (
          <div className="flex items-center rounded bg-green-700 relative">
            <button onClick={handleRunButton} disabled={!activeConnectionId} className="flex items-center gap-2 px-3 py-1.5 text-white rounded-l text-sm font-medium disabled:opacity-50 hover:bg-green-600"><Play size={16} fill="currentColor" /> Run</button>
            <div className="h-5 w-[1px] bg-green-800"></div>
            <button onClick={handleRunDropdownToggle} disabled={!activeConnectionId} className="px-1.5 py-1.5 text-white rounded-r hover:bg-green-600 disabled:opacity-50"><ChevronDown size={14} /></button>
            
            {isRunDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsRunDropdownOpen(false)} />
                <div className="absolute top-full left-0 mt-1 w-80 bg-slate-800 border border-slate-700 rounded shadow-xl z-50 flex flex-col py-1 max-h-80 overflow-y-auto">
                  {selectableQueries.length === 0 ? (
                    <div className="px-4 py-2 text-xs text-slate-500 italic">No valid queries found</div>
                  ) : (
                    selectableQueries.map((q, i) => (
                      <div key={i} className="flex items-center border-b border-slate-700/50 last:border-0 hover:bg-slate-700/50 transition-colors group">
                        <button onClick={() => { runQuery(q, 1); setIsRunDropdownOpen(false); }} className="text-left px-4 py-2 text-xs font-mono text-slate-300 hover:text-white flex-1 truncate" title={q}>{q}</button>
                        <button onClick={(e) => { e.stopPropagation(); setIsRunDropdownOpen(false); setSaveQueryModal({ isOpen: true, sql: q }); }} className="p-2 text-slate-500 hover:text-white hover:bg-slate-600 transition-colors mr-1 rounded shrink-0 opacity-0 group-hover:opacity-100" title="Save this query"><Save size={14} /></button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <div className="relative">
          <button onClick={() => setExportMenuOpen(!exportMenuOpen)} disabled={!activeTab.result || activeTab.result.rows.length === 0} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-sm font-medium disabled:opacity-50 border border-slate-700"><Download size={16} /> Export</button>
          {exportMenuOpen && (
            <>
                <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} />
                <div className="absolute top-full left-0 mt-1 w-40 bg-slate-800 border border-slate-700 rounded shadow-xl z-50 flex flex-col py-1">
                    <button onClick={handleExportCSV} className="text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">CSV (.csv)</button>
                    <button onClick={handleExportJSON} className="text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">JSON (.json)</button>
                </div>
            </>
          )}
        </div>
        <span className="text-xs text-slate-500 ml-2">{activeConnectionId ? "Connected" : "Disconnected"}</span>
        {activeTab.activeTable && activeTab.pkColumn && <div className="ml-auto flex items-center gap-3"><button onClick={() => setShowNewRowModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium"><Plus size={16} /> New Row</button><span className="text-xs text-blue-400 border border-blue-900 bg-blue-900/20 px-2 py-0.5 rounded shrink-0">Editing: {activeTab.activeTable}</span></div>}
      </div>

      <div style={{ height: isResultsCollapsed ? 'calc(100vh - 109px)' : editorHeight }} className="relative">
        {activeTab.type === 'query_builder' ? (
          <VisualQueryBuilder />
        ) : (
          <MonacoEditor height="100%" defaultLanguage="sql" theme="vs-dark" value={activeTab.query} onChange={(val) => updateActiveTab({ query: val || "" })} onMount={handleEditorMount} options={{ minimap: { enabled: false }, fontSize: 14, padding: { top: 16 }, scrollBeyondLastLine: false, automaticLayout: true }} />
        )}
      </div>
      
      {/* Resize Bar & Results Panel */}
      {!isResultsCollapsed ? (
        <>
          <div onMouseDown={startResize} className="h-2 bg-slate-900 border-y border-slate-800 cursor-row-resize hover:bg-blue-600/50 transition-colors flex items-center justify-center group">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsResultsCollapsed(true);
              }}
              className="px-3 py-0.5 bg-slate-800 rounded-full border border-slate-700 hover:border-slate-600 transition-colors flex items-center gap-1.5"
              title="Hide Results Panel"
            >
              <ChevronDown size={14} />
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Hide Results</span>
            </button>
          </div>

          {/* Results Panel */}
          <div className="flex-1 overflow-hidden bg-slate-900 flex flex-col min-h-0">
            {activeTab.error ? <div className="p-4 text-red-400 font-mono text-sm bg-red-900/10 h-full overflow-auto whitespace-pre-wrap">Error: {activeTab.error}</div> : activeTab.result ? (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="p-2 bg-slate-900 text-xs text-slate-400 border-b border-slate-800 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-4"><span>{activeTab.result.rows.length} rows retrieved {activeTab.executionTime !== null && <span className="text-slate-500 ml-2 font-mono">({formatDuration(activeTab.executionTime)})</span>}</span></div>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden"><DataGrid columns={activeTab.result.columns} data={activeTab.result.rows} tableName={activeTab.activeTable} pkColumn={activeTab.pkColumn} connectionId={activeConnectionId} onRefresh={handleRefresh} /></div>
              </div>
            ) : <div className="flex items-center justify-center h-full text-slate-600 text-sm">Execute a query to see results</div>}
          </div>
        </>
      ) : (
        // Show Results Button (when collapsed)
        <div className="h-8 bg-slate-900 border-t border-slate-800 flex items-center justify-center">
          <button
            onClick={() => setIsResultsCollapsed(false)}
            className="px-3 py-1 bg-slate-800 rounded-full border border-slate-700 hover:border-slate-600 transition-colors flex items-center gap-1.5"
            title="Show Results Panel"
          >
            <ChevronUp size={14} />
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Show Results</span>
          </button>
        </div>
      )}

      {activeTab.activeTable && <NewRowModal isOpen={showNewRowModal} onClose={() => setShowNewRowModal(false)} tableName={activeTab.activeTable} onSaveSuccess={handleRefresh} />}
      <QuerySelectionModal isOpen={isQuerySelectionModalOpen} queries={selectableQueries} onSelect={(q) => { runQuery(q, 1); setIsQuerySelectionModalOpen(false); }} onClose={() => setIsQuerySelectionModalOpen(false)} />
      {saveQueryModal.isOpen && <QueryModal isOpen={saveQueryModal.isOpen} onClose={() => setSaveQueryModal({ ...saveQueryModal, isOpen: false })} onSave={async (name, sql) => await saveQuery(name, sql)} initialSql={saveQueryModal.sql} title="Save Query" />}
    </div>
  );
};
