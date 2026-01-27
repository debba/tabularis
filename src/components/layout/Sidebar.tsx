import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Database, Terminal, Settings, Table as TableIcon, Loader2, Copy, Hash, PlaySquare, FileText, Plus } from 'lucide-react';
import clsx from 'clsx';
import { useDatabase } from '../../contexts/DatabaseContext';
import { ContextMenu } from '../ui/ContextMenu';
import { SchemaModal } from '../ui/SchemaModal';
import { CreateTableModal } from '../ui/CreateTableModal';

const NavItem = ({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) => (
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
    <Icon size={24} />
    <span className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
      {label}
    </span>
  </NavLink>
);

export const Sidebar = () => {
  const { activeConnectionId, activeDriver, activeTable, setActiveTable, tables, isLoadingTables, refreshTables } = useDatabase();
  const navigate = useNavigate();
  const location = useLocation(); // Add useLocation
  
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tableName: string } | null>(null);
  const [schemaModalTable, setSchemaModalTable] = useState<string | null>(null);
  const [isCreateTableModalOpen, setIsCreateTableModalOpen] = useState(false);

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

  const handleContextMenu = (e: React.MouseEvent, tableName: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tableName });
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
          <NavItem to="/" icon={Database} label="Connections" />
          <NavItem to="/editor" icon={Terminal} label="SQL Editor" />
        </nav>

        <div className="mt-auto">
          <NavItem to="/settings" icon={Settings} label="Settings" />
        </div>
      </aside>

      {/* Secondary Sidebar (Schema Explorer) - Only visible when connected and not in settings */}
      {activeConnectionId && location.pathname !== '/settings' && (
        <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800 font-semibold text-sm text-slate-200 flex items-center gap-2">
            <Database size={16} className="text-blue-400"/>
            <span>Explorer</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {isLoadingTables ? (
              <div className="flex items-center justify-center h-20 text-slate-500 gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Loading schema...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-2 py-1 mb-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Tables ({tables.length})
                  </span>
                  <button 
                    onClick={() => setIsCreateTableModalOpen(true)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
                    title="Create New Table"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {tables.length === 0 ? (
                  <div className="text-center p-4 text-xs text-slate-500">
                    No tables found.
                  </div>
                ) : (
                  <div>
                    {tables.map(table => (
                      <div 
                        key={table.name}
                        onClick={() => handleTableClick(table.name)}
                        onContextMenu={(e) => handleContextMenu(e, table.name)}
                        className={clsx(
                          "flex items-center gap-2 px-2 py-1.5 text-sm rounded cursor-pointer group select-none transition-colors",
                          activeTable === table.name 
                            ? "bg-blue-900/40 text-blue-200 border-l-2 border-blue-500 pl-1.5" 
                            : "text-slate-300 hover:bg-slate-800 border-l-2 border-transparent"
                        )}
                      >
                        <TableIcon size={14} className={activeTable === table.name ? "text-blue-400" : "text-slate-500 group-hover:text-blue-400"} />
                        <span className="truncate">{table.name}</span>
                      </div>
                    ))}
                  </div>
                )}
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
          items={[
            {
              label: 'Select Top 100',
              icon: PlaySquare,
              action: () => {
                const q = getQuote();
                runQuery(`SELECT * FROM ${q}${contextMenu.tableName}${q} LIMIT 100`);
              }
            },
            {
              label: 'Count Rows',
              icon: Hash,
              action: () => {
                const q = getQuote();
                runQuery(`SELECT COUNT(*) as count FROM ${q}${contextMenu.tableName}${q}`);
              }
            },
            {
              label: 'View Schema',
              icon: FileText,
              action: () => {
                setSchemaModalTable(contextMenu.tableName);
              }
            },
            {
              label: 'Copy Name',
              icon: Copy,
              action: () => {
                navigator.clipboard.writeText(contextMenu.tableName);
              }
            }
          ]}
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
    </div>
  );
};
