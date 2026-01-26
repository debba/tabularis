import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Play, Loader2, Plus, Download } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useDatabase } from '../contexts/DatabaseContext';
import { DataGrid } from '../components/ui/DataGrid';
import { NewRowModal } from '../components/ui/NewRowModal';
import MonacoEditor, { type OnMount } from '@monaco-editor/react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

interface QueryResult {
  columns: string[];
  rows: any[][];
  affected_rows: number;
}

interface TableColumn {
  name: string;
  data_type: string;
  is_pk: boolean;
  is_nullable: boolean;
}

export const Editor = () => {
  const { activeConnectionId } = useDatabase();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Context info for editing/deleting
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [pkColumn, setPkColumn] = useState<string | null>(null);
  const [showNewRowModal, setShowNewRowModal] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  
  // Split pane state
  const [editorHeight, setEditorHeight] = useState(300);
  const isDragging = useRef(false);

  // Handle auto-query from sidebar navigation
  useEffect(() => {
    if (activeConnectionId && location.state?.initialQuery) {
      const sql = location.state.initialQuery;
      const table = location.state.tableName;
      
      console.log('Auto-running query:', sql);
      setQuery(sql);
      runQuery(sql);
      
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

  const runQuery = async (sql: string = query) => {
    if (!activeConnectionId) {
      setError('No active connection selected.');
      return;
    }
    if (!sql.trim()) return;
    
    setIsLoading(true);
    setError('');
    setResult(null);

    // If user runs a custom query, we might lose context of "Active Table" unless we parse SQL.
    // For safety, if query changed from initial, clear active table context unless we are sure.
    // Ideally we parse, but for now let's assume if it matches initial it's safe.
    if (sql !== location.state?.initialQuery) {
        // Reset active table context on custom query run to avoid deleting wrong rows
        setActiveTable(null);
        setPkColumn(null);
    }

    try {
      console.log('Executing:', sql);
      const res = await invoke<QueryResult>('execute_query', {
        connectionId: activeConnectionId,
        query: sql
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
  
  const handleRefresh = () => {
      if (activeTable && activeConnectionId) {
          // Re-run the last query (assuming it was select *)
          // Or re-run current query text
          runQuery(query);
      }
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      runQuery(editor.getValue());
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
        <button
          onClick={() => runQuery()}
          disabled={isLoading || !activeConnectionId}
          className="flex items-center gap-2 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Run Query (Ctrl+Enter)"
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
          Run
        </button>

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
             <div className="p-2 bg-slate-900 text-xs text-slate-400 border-b border-slate-800 flex justify-between shrink-0">
               <span>{result.rows.length} rows retrieved</span>
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
    </div>
  );
};
