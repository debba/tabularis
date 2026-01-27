import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Play, Loader2, Plus, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Square } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useDatabase } from '../contexts/DatabaseContext';
import { useSettings } from '../contexts/SettingsContext';
import { DataGrid } from '../components/ui/DataGrid';
import { NewRowModal } from '../components/ui/NewRowModal';
import { QuerySelectionModal } from '../components/ui/QuerySelectionModal';
import { splitQueries } from '../utils/sql';
import MonacoEditor, { type OnMount } from '@monaco-editor/react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

interface Pagination {
  page: number;
  page_size: number;
  total_rows: number;
}

interface QueryResult {
  columns: string[];
  rows: any[][];
  affected_rows: number;
  truncated?: boolean;
  pagination?: Pagination;
}

interface TableColumn {
  name: string;
  data_type: string;
  is_pk: boolean;
  is_nullable: boolean;
}

export const Editor = () => {
  const { activeConnectionId } = useDatabase();
  const { settings } = useSettings();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [isEditingPage, setIsEditingPage] = useState(false);
  const [tempPage, setTempPage] = useState("1");
  
  // Context info for editing/deleting
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [pkColumn, setPkColumn] = useState<string | null>(null);
  const [showNewRowModal, setShowNewRowModal] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  
  // Split pane state
  const [editorHeight, setEditorHeight] = useState(300);
  const isDragging = useRef(false);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  // Query Selection State
  const [selectableQueries, setSelectableQueries] = useState<string[]>([]);
  const [isQuerySelectionModalOpen, setIsQuerySelectionModalOpen] = useState(false);

  // Handle auto-query from sidebar navigation
  useEffect(() => {
    if (activeConnectionId && location.state?.initialQuery) {
      const sql = location.state.initialQuery;
      const table = location.state.tableName;
      
      console.log('Auto-running query:', sql);
      setQuery(sql);
      runQuery(sql, 1);
      
      if (table) {
        setActiveTable(table);
        fetchPkColumn(table);
      } else {
        setActiveTable(null);
        setPkColumn(null);
      }
    }
  }, [location.state, activeConnectionId]);

  const fetchPkColumn = async (table: string) => {
    if (!activeConnectionId) return;
    try {
      const cols = await invoke<TableColumn[]>('get_columns', { 
        connectionId: activeConnectionId, 
        tableName: table 
      });
      const pk = cols.find(c => c.is_pk);
      setPkColumn(pk ? pk.name : null);
    } catch (e) {
      console.error('Failed to fetch PK:', e);
    }
  };

  const stopQuery = async () => {
    if (!activeConnectionId) return;
    try {
        await invoke('cancel_query', { connectionId: activeConnectionId });
    } catch (e) {
        console.error("Failed to stop:", e);
    }
  };

  const runQuery = async (sql: string = query, pageNum: number = 1) => {
    if (!activeConnectionId) {
      setError('No active connection selected.');
      return;
    }
    const textToRun = sql.trim() ? sql : query;
    if (!textToRun.trim()) return;
    
    setIsLoading(true);
    setError('');
    // Don't clear result immediately to prevent flickering during page change? 
    // Maybe better UX to clear or show loading overlay. Let's clear for now.
    setResult(null); 
    setPage(pageNum);

    // If user runs a custom query, we might lose context of "Active Table" unless we parse SQL.
    // For safety, if query changed from initial, clear active table context unless we are sure.
    // Ideally we parse, but for now let's assume if it matches initial it's safe.
    if (textToRun !== location.state?.initialQuery) {
        // Reset active table context on custom query run to avoid deleting wrong rows
        setActiveTable(null);
        setPkColumn(null);
    }

    try {
      console.log('Executing:', textToRun, 'Page:', pageNum);
      const res = await invoke<QueryResult>('execute_query', {
        connectionId: activeConnectionId,
        query: textToRun,
        limit: settings.queryLimit > 0 ? settings.queryLimit : null,
        page: pageNum
      });
      console.log('Result:', res);
      setResult(res);
    } catch (err: any) {
      console.error('Query error:', err);
      setError(typeof err === 'string' ? err : 'Query execution failed. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunButton = () => {
      if (!editorRef.current) return;
      const editor = editorRef.current;
      
      const selection = editor.getSelection();
      const selectedText = editor.getModel()?.getValueInRange(selection);
      
      // If there is an active selection (not empty), run it directly
      if (selectedText && !selection?.isEmpty()) {
          runQuery(selectedText, 1);
          return;
      }
      
      const fullText = editor.getValue();
      if (!fullText.trim()) return;

      const queries = splitQueries(fullText);
      if (queries.length <= 1) {
          // If 0 or 1 query, just run it (runQuery handles trimming/empty check)
          runQuery(queries[0] || fullText, 1); 
      } else {
          // Multiple queries: ask user
          setSelectableQueries(queries);
          setIsQuerySelectionModalOpen(true);
      }
  };
  
  const handleRefresh = () => {
      if (activeTable && activeConnectionId) {
          // Re-run the last query (assuming it was select *)
          // Or re-run current query text
          runQuery(query, page);
      }
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Add "Execute Selection" action to Context Menu
    editor.addAction({
      id: 'run-selection',
      label: 'Execute Selection',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: (ed) => {
        const selection = ed.getSelection();
        const selectedText = ed.getModel()?.getValueInRange(selection!);
        const textToRun = selectedText && !selection?.isEmpty() ? selectedText : ed.getValue();
        runQuery(textToRun, 1);
      }
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
       const selection = editor.getSelection();
       const selectedText = editor.getModel()?.getValueInRange(selection!);
       const textToRun = selectedText && !selection?.isEmpty() ? selectedText : editor.getValue();
       runQuery(textToRun, 1);
    });
  };

  // Resize logic
  const startResize = () => {
    isDragging.current = true;
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
  };

  const handleResize = (e: MouseEvent) => {
    if (!isDragging.current) return;
    const newHeight = e.clientY - 50; 
    if (newHeight > 100 && newHeight < window.innerHeight - 150) {
      setEditorHeight(newHeight);
    }
  };

  const stopResize = () => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
  };

  const handleExportCSV = async () => {
    if (!result) return;
    
    try {
        const filePath = await save({
            filters: [{ name: 'CSV', extensions: ['csv'] }],
            defaultPath: `query_result_${Date.now()}.csv`
        });
        
        if (!filePath) return;

        const headers = result.columns.join(',');
        const rows = result.rows.map(row => 
          row.map(cell => {
            if (cell === null) return 'NULL';
            const str = String(cell);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          }).join(',')
        ).join('\n');
        
        const csvContent = `${headers}\n${rows}`;
        
        await writeTextFile(filePath, csvContent);
        setExportMenuOpen(false);
    } catch (e: any) {
        console.error('Export failed:', e);
        setError('Failed to export CSV: ' + e);
    }
  };

  const handleExportJSON = async () => {
    if (!result) return;
    
    try {
        const filePath = await save({
            filters: [{ name: 'JSON', extensions: ['json'] }],
            defaultPath: `query_result_${Date.now()}.json`
        });

        if (!filePath) return;

        const data = result.rows.map(row => {
          const obj: Record<string, any> = {};
          result.columns.forEach((col, i) => {
            obj[col] = row[i];
          });
          return obj;
        });
        
        const jsonContent = JSON.stringify(data, null, 2);
        
        await writeTextFile(filePath, jsonContent);
        setExportMenuOpen(false);
    } catch (e: any) {
        console.error('Export failed:', e);
        setError('Failed to export JSON: ' + e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Toolbar */}
      <div className="flex items-center p-2 border-b border-slate-800 bg-slate-900 gap-2 h-[50px]">
        {isLoading ? (
          <button
            onClick={stopQuery}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded text-sm font-medium transition-colors"
            title="Stop Execution"
          >
            <Square size={16} fill="currentColor" />
            Stop
          </button>
        ) : (
          <button
            onClick={handleRunButton}
            disabled={!activeConnectionId}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Run Query (Ctrl+Enter). Select text to run partial query."
          >
            <Play size={16} fill="currentColor" />
            Run
          </button>
        )}

        {/* Export Dropdown */}
        <div className="relative">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              disabled={!result || result.rows.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-slate-700"
              title="Export Results"
            >
              <Download size={16} /> Export
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
                    className="text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                  >
                    CSV (.csv)
                  </button>
                  <button 
                    onClick={handleExportJSON}
                    className="text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                  >
                    JSON (.json)
                  </button>
                </div>
              </>
            )}
        </div>

        <span className="text-xs text-slate-500 ml-2">
          {activeConnectionId ? 'Connected' : 'No Active Connection'}
        </span>
        {activeTable && pkColumn && (
          <div className="ml-auto flex items-center gap-3">
             <button
               onClick={() => setShowNewRowModal(true)}
               className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium transition-colors"
             >
                <Plus size={16} /> New Row
             </button>
             <span className="text-xs text-blue-400 border border-blue-900 bg-blue-900/20 px-2 py-0.5 rounded">
                Editing: {activeTable} (PK: {pkColumn})
             </span>
          </div>
        )}
      </div>

      {/* Editor Area */}
      <div style={{ height: editorHeight }} className="relative">
        <MonacoEditor
          height="100%"
          defaultLanguage="sql"
          theme="vs-dark"
          value={query}
          onChange={(val) => setQuery(val || '')}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            padding: { top: 16 },
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </div>

      {/* Resizer Handle */}
      <div 
        onMouseDown={startResize}
        className="h-2 bg-slate-900 border-y border-slate-800 cursor-row-resize hover:bg-blue-600/50 transition-colors flex items-center justify-center group"
      >
        <div className="w-8 h-1 bg-slate-700 rounded-full group-hover:bg-white/50" />
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-hidden bg-slate-900 flex flex-col min-h-0">
        {error ? (
          <div className="p-4 text-red-400 font-mono text-sm bg-red-900/10 h-full overflow-auto whitespace-pre-wrap">
            Error: {error}
          </div>
        ) : result ? (
          <div className="flex-1 min-h-0 flex flex-col">
             <div className="p-2 bg-slate-900 text-xs text-slate-400 border-b border-slate-800 flex justify-between items-center shrink-0">
               <div className="flex items-center gap-4">
                 <span>{result.rows.length} rows retrieved</span>
                 {result.truncated && !result.pagination && (
                   <span className="text-yellow-500 bg-yellow-900/20 px-1.5 py-0.5 rounded border border-yellow-900/50">
                     Truncated (Limit: {settings.queryLimit})
                   </span>
                 )}
               </div>

               {/* Pagination Controls */}
               {result.pagination && result.pagination.total_rows > 0 && (
                 <div className="flex items-center gap-2">
                    <span className="mr-2">
                      {((result.pagination.page - 1) * result.pagination.page_size) + 1} - {Math.min(result.pagination.page * result.pagination.page_size, result.pagination.total_rows)} of {result.pagination.total_rows}
                    </span>
                    
                    <div className="flex items-center bg-slate-800 rounded border border-slate-700">
                      <button 
                        disabled={result.pagination.page <= 1 || isLoading}
                        onClick={() => runQuery(query, 1)}
                        className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        title="First Page"
                      >
                        <ChevronsLeft size={14} />
                      </button>
                      <button 
                        disabled={result.pagination.page <= 1 || isLoading}
                        onClick={() => runQuery(query, result.pagination!.page - 1)}
                        className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border-l border-slate-700"
                        title="Previous Page"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      
                      <div 
                        className="px-2 py-0.5 text-slate-300 font-mono border-l border-slate-700 min-w-[40px] text-center cursor-pointer hover:bg-slate-700 hover:text-white relative"
                        onClick={() => {
                          if (!isEditingPage) {
                            setIsEditingPage(true);
                            setTempPage(result.pagination!.page.toString());
                          }
                        }}
                      >
                        {isEditingPage ? (
                          <input 
                            autoFocus
                            type="text"
                            className="w-full bg-transparent text-center focus:outline-none text-white p-0 m-0 border-none h-full"
                            value={tempPage}
                            onChange={(e) => setTempPage(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const newPage = parseInt(tempPage);
                                const maxPage = Math.ceil(result.pagination!.total_rows / result.pagination!.page_size);
                                if (!isNaN(newPage) && newPage >= 1 && newPage <= maxPage) {
                                   runQuery(query, newPage);
                                }
                                setIsEditingPage(false);
                              } else if (e.key === 'Escape') {
                                setIsEditingPage(false);
                              }
                              e.stopPropagation();
                            }}
                            onBlur={() => setIsEditingPage(false)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          result.pagination.page
                        )}
                      </div>

                      <button 
                        disabled={result.pagination.page * result.pagination.page_size >= result.pagination.total_rows || isLoading}
                        onClick={() => runQuery(query, result.pagination!.page + 1)}
                        className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border-l border-slate-700"
                        title="Next Page"
                      >
                        <ChevronRight size={14} />
                      </button>
                      <button 
                        disabled={result.pagination.page * result.pagination.page_size >= result.pagination.total_rows || isLoading}
                        onClick={() => runQuery(query, Math.ceil(result.pagination!.total_rows / result.pagination!.page_size))}
                        className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border-l border-slate-700"
                        title="Last Page"
                      >
                        <ChevronsRight size={14} />
                      </button>
                    </div>
                 </div>
               )}
             </div>
             <div className="flex-1 min-h-0 overflow-hidden">
               <DataGrid 
                 columns={result.columns} 
                 data={result.rows} 
                 tableName={activeTable}
                 pkColumn={pkColumn}
                 connectionId={activeConnectionId}
                 onRefresh={handleRefresh}
               />
             </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-600 text-sm">
            Execute a query to see results
          </div>
        )}
      </div>
      {activeTable && (
        <NewRowModal
          isOpen={showNewRowModal}
          onClose={() => setShowNewRowModal(false)}
          tableName={activeTable}
          onSaveSuccess={() => {
              handleRefresh();
          }}
        />
      )}

      <QuerySelectionModal
        isOpen={isQuerySelectionModalOpen}
        queries={selectableQueries}
        onSelect={(selectedQuery) => {
            runQuery(selectedQuery, 1);
            setIsQuerySelectionModalOpen(false);
        }}
        onClose={() => setIsQuerySelectionModalOpen(false)}
      />
    </div>
  );
};
