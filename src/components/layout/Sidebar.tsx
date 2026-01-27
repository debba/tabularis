import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Database, Terminal, Settings, Table as TableIcon, Loader2, Copy, Hash, PlaySquare, FileText, Plus, ChevronRight, ChevronDown, FileCode, Play, Edit, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { ask } from '@tauri-apps/plugin-dialog';
import { useDatabase } from '../../hooks/useDatabase';
import { useSavedQueries } from '../../hooks/useSavedQueries';
import type { SavedQuery } from '../../contexts/SavedQueriesContext';
import { ContextMenu } from '../ui/ContextMenu';
import { SchemaModal } from '../ui/SchemaModal';
import { CreateTableModal } from '../ui/CreateTableModal';
import { QueryModal } from '../ui/QueryModal';

interface AccordionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

const NavItem = ({ to, icon: Icon, label, isConnected }: { to: string; icon: React.ElementType; label: string; isConnected?: boolean }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      clsx(
        'flex items-center justify-center w-12 h-12 rounded-lg transition-colors mb-2 relative group',
        isActive
          ? 'bg-blue-600 text-white'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
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

const Accordion = ({ title, isOpen, onToggle, children, actions }: AccordionProps) => (

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

export const Sidebar = () => {
  const { activeConnectionId, activeDriver, activeTable, setActiveTable, tables, isLoadingTables, refreshTables } = useDatabase();
  const { queries, deleteQuery, updateQuery } = useSavedQueries();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'table' | 'query'; id: string; label: string; data?: SavedQuery } | null>(null);
  const [schemaModalTable, setSchemaModalTable] = useState<string | null>(null);
  const [isCreateTableModalOpen, setIsCreateTableModalOpen] = useState(false);
  
  const [queriesOpen, setQueriesOpen] = useState(false);
  const [tablesOpen, setTablesOpen] = useState(true);
  const [queryModal, setQueryModal] = useState<{ isOpen: boolean; query?: SavedQuery }>({ isOpen: false });

  const getQuote = () => (activeDriver === 'mysql' || activeDriver === 'mariadb') ? '`' : '"';

  const runQuery = (sql: string) => {
    navigate('/editor', {
      state: { initialQuery: sql }
    });
  };

  const handleTableClick = (tableName: string) => {
    setActiveTable(tableName);
    const q = getQuote();
    navigate('/editor', {
      state: { 
        initialQuery: `SELECT * FROM ${q}${tableName}${q} LIMIT 100`,
        tableName: tableName
      }
    });
  };

  const handleContextMenu = (e: React.MouseEvent, type: 'table' | 'query', id: string, label: string, data?: SavedQuery) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type, id, label, data });
  };

  return (
    <div className="flex h-full">
      {/* Primary Navigation Bar (Narrow) */}
      <aside className="w-16 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-4 z-20">
        <div className="mb-8" title="debba.sql">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-lg shadow-blue-900/20 border border-blue-500/30">
            ds
          </div>
        </div>
        
        <nav className="flex-1 w-full flex flex-col items-center">
          <NavItem to="/" icon={Database} label="Connections" isConnected={!!activeConnectionId} />
          {activeConnectionId && (
            <NavItem to="/editor" icon={Terminal} label="SQL Editor" />
          )}
        </nav>

        <div className="mt-auto">
          <NavItem to="/settings" icon={Settings} label="Settings" />
        </div>
      </aside>

      {/* Secondary Sidebar (Schema Explorer) - Only visible when connected and not in settings or home */}
      {activeConnectionId && location.pathname !== '/settings' && location.pathname !== '/' && (
        <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800 font-semibold text-sm text-slate-200 flex items-center gap-2">
            <Database size={16} className="text-blue-400"/>
            <span>Explorer</span>
          </div>
          
          <div className="flex-1 overflow-y-auto py-2">
            {isLoadingTables ? (
              <div className="flex items-center justify-center h-20 text-slate-500 gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Loading schema...</span>
              </div>
            ) : (
              <>
                {/* Saved Queries */}
                <Accordion 
                    title={`Saved Queries (${queries.length})`}
                    isOpen={queriesOpen} 
                    onToggle={() => setQueriesOpen(!queriesOpen)}
                >
                    {queries.length === 0 ? (
                        <div className="text-center p-2 text-xs text-slate-600 italic">No saved queries</div>
                    ) : (
                        <div>
                            {queries.map(q => (
                                <div 
                                    key={q.id}
                                    onClick={() => runQuery(q.sql)}
                                    onContextMenu={(e) => handleContextMenu(e, 'query', q.id, q.name, q)}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer group transition-colors"
                                    title={q.name}
                                >
                                    <FileCode size={14} className="text-green-500 shrink-0" />
                                    <span className="truncate">{q.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Accordion>

                {/* Tables */}
                <Accordion 
                    title={`Tables (${tables.length})`}
                    isOpen={tablesOpen}
                    onToggle={() => setTablesOpen(!tablesOpen)}
                    actions={
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsCreateTableModalOpen(true); }}
                            className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-white transition-colors"
                            title="Create New Table"
                        >
                            <Plus size={14} />
                        </button>
                    }
                >
                    {tables.length === 0 ? (
                        <div className="text-center p-2 text-xs text-slate-600 italic">No tables found</div>
                    ) : (
                        <div>
                            {tables.map(table => (
                                <div 
                                    key={table.name}
                                    onClick={() => handleTableClick(table.name)}
                                    onContextMenu={(e) => handleContextMenu(e, 'table', table.name, table.name)}
                                    className={clsx(
                                        "flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer group select-none transition-colors border-l-2",
                                        activeTable === table.name 
                                        ? "bg-blue-900/40 text-blue-200 border-blue-500" 
                                        : "text-slate-300 hover:bg-slate-800 border-transparent hover:text-white"
                                    )}
                                >
                                    <TableIcon size={14} className={activeTable === table.name ? "text-blue-400" : "text-slate-500 group-hover:text-blue-400"} />
                                    <span className="truncate">{table.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Accordion>
              </>
            )}
          </div>
        </aside>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={
            contextMenu.type === 'table' ? [
                {
                    label: 'Select Top 100',
                    icon: PlaySquare,
                    action: () => {
                        const q = getQuote();
                        runQuery(`SELECT * FROM ${q}${contextMenu.id}${q} LIMIT 100`);
                    }
                },
                {
                    label: 'Count Rows',
                    icon: Hash,
                    action: () => {
                        const q = getQuote();
                        runQuery(`SELECT COUNT(*) as count FROM ${q}${contextMenu.id}${q}`);
                    }
                },
                {
                    label: 'View Schema',
                    icon: FileText,
                    action: () => setSchemaModalTable(contextMenu.id)
                },
                {
                    label: 'Copy Name',
                    icon: Copy,
                    action: () => navigator.clipboard.writeText(contextMenu.id)
                }
            ] : [
                // Saved Query Actions
                {
                    label: 'Execute',
                    icon: Play,
                    action: () => {
                        if (contextMenu.data?.sql) runQuery(contextMenu.data.sql);
                    }
                },
                {
                    label: 'Edit',
                    icon: Edit,
                    action: () => {
                        setQueryModal({ isOpen: true, query: contextMenu.data });
                    }
                },
                {
                    label: 'Delete',
                    icon: Trash2,
                    action: async () => {
                        const confirmed = await ask(`Are you sure you want to delete "${contextMenu.label}"?`, {
                            title: 'Confirm Delete',
                            kind: 'warning'
                        });
                        if (confirmed) {
                            deleteQuery(contextMenu.id);
                        }
                    }
                }
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
    </div>
  );
};
