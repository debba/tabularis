import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NewConnectionModal } from '../components/ui/NewConnectionModal';
import { invoke } from '@tauri-apps/api/core';
import { ask } from '@tauri-apps/plugin-dialog';
import { Database, Plus, Power, Edit, Trash2, Shield, AlertCircle, Copy } from 'lucide-react';
import { useDatabase } from '../hooks/useDatabase';

interface SavedConnection {
  id: string;
  name: string;
  params: {
    driver: 'postgres' | 'mysql' | 'sqlite';
    host?: string;
    database: string;
    port?: number;
    username?: string;
    password?: string;
    ssh_enabled?: boolean;
    ssh_host?: string;
    ssh_port?: number;
    ssh_user?: string;
    ssh_password?: string;
    ssh_key_file?: string;
  };
}

export const Connections = () => {
  const navigate = useNavigate();
  const { connect, activeConnectionId, disconnect } = useDatabase();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<SavedConnection | null>(null);
  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadConnections = async () => {
    try {
      const result = await invoke<SavedConnection[]>('get_connections');
      setConnections(result);
    } catch (error) {
      console.error('Failed to load connections:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadConnections();
    };
    void init();
  }, []);

  const handleSave = () => {
    loadConnections();
    setIsModalOpen(false);
    setEditingConnection(null);
  };

  const handleConnect = async (conn: SavedConnection) => {
    setError(null);
    try {
      await connect(conn.id);
      navigate('/editor');
    } catch (e) {
      console.error(e);
      setError(`Failed to connect to ${conn.name}. Please check your settings or ensuring the database is running.`);
    }
  };

  const handleDelete = async (id: string) => {
      const confirmed = await ask("Are you sure you want to delete this connection?", { 
          title: 'Confirm Delete',
          kind: 'warning'
      });
      
      if (confirmed) {
          try {
              await invoke('delete_connection', { id });
              loadConnections();
          } catch (e) {
              console.error(e);
          }
      }
  };

  const openEdit = (conn: SavedConnection) => {
      setEditingConnection(conn);
      setIsModalOpen(true);
  };

  const handleDuplicate = async (id: string) => {
    try {
        const newConn = await invoke<SavedConnection>('duplicate_connection', { id });
        await loadConnections();
        openEdit(newConn);
    } catch (e) {
        console.error(e);
        setError("Failed to duplicate connection");
    }
  };

  return (
    <div className="p-6 h-full overflow-auto relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Connections</h1>
        <button 
          onClick={() => { setEditingConnection(null); setIsModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md font-medium text-sm flex items-center gap-2"
        >
          <Plus size={16} />
          Add Connection
        </button>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-900/50 rounded-lg flex items-center gap-3 text-red-400">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}
      
      {connections.length === 0 ? (
        <div className="p-8 border border-slate-800 rounded-lg bg-slate-900/50 flex flex-col items-center justify-center text-slate-400 min-h-[400px]">
          <Database size={48} className="mb-4 opacity-50" />
          <p className="mb-4">No active connections</p>
          <button 
            onClick={() => { setEditingConnection(null); setIsModalOpen(true); }}
            className="text-blue-400 hover:text-blue-300 font-medium"
          >
            Create your first connection
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {connections.map(conn => {
            const isActive = activeConnectionId === conn.id;
            return (
              <div 
                key={conn.id}
                onDoubleClick={() => handleConnect(conn)}
                className={`
                  p-4 border rounded-lg transition-all cursor-pointer group relative
                  ${isActive 
                    ? 'bg-blue-900/20 border-blue-500/50' 
                    : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                  }
                `}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-10 h-10 rounded flex items-center justify-center relative
                      ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-800 text-blue-400'}
                    `}>
                      <Database size={20} />
                      {conn.params.ssh_enabled && (
                          <div className="absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-0.5" title="SSH Tunnel Enabled">
                              <Shield size={12} className="text-emerald-400 fill-emerald-400/20" />
                          </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-200">{conn.name}</h3>
                      <p className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          {conn.params.driver}
                          {conn.params.ssh_enabled && <span className="text-emerald-500 font-bold text-[10px] ml-1">SSH</span>}
                      </p>
                    </div>
                  </div>
                  {isActive && (
                    <div className="flex items-center gap-1 text-xs text-green-400 font-medium bg-green-400/10 px-2 py-0.5 rounded">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      Active
                    </div>
                  )}
                </div>
                
                <div className="text-sm text-slate-400 mt-3 truncate pl-1 font-mono">
                  {conn.params.driver === 'sqlite' 
                    ? conn.params.database 
                    : `${conn.params.host}:${conn.params.database}`}
                </div>

                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-slate-900/80 p-1 rounded-lg backdrop-blur-sm border border-slate-700/50">
                   {isActive ? (
                     <button 
                       onClick={(e) => { e.stopPropagation(); disconnect(); }}
                       className="p-1.5 hover:bg-red-900/50 text-slate-400 hover:text-red-400 rounded"
                       title="Disconnect"
                     >
                       <Power size={14} />
                     </button>
                   ) : (
                     <button 
                       onClick={(e) => { e.stopPropagation(); handleConnect(conn); }}
                       className="p-1.5 hover:bg-green-900/50 text-slate-400 hover:text-green-400 rounded"
                       title="Connect"
                     >
                       <Power size={14} />
                     </button>
                   )}
                   
                   <div className="w-[1px] h-4 bg-slate-700 mx-0.5 self-center" />

                   <button 
                       onClick={(e) => { e.stopPropagation(); openEdit(conn); }}
                       className="p-1.5 hover:bg-blue-900/50 text-slate-400 hover:text-blue-400 rounded"
                       title="Edit"
                   >
                       <Edit size={14} />
                   </button>
                   <button 
                       onClick={(e) => { e.stopPropagation(); handleDuplicate(conn.id); }}
                       className="p-1.5 hover:bg-purple-900/50 text-slate-400 hover:text-purple-400 rounded"
                       title="Clone"
                   >
                       <Copy size={14} />
                   </button>
                   <button 
                       onClick={(e) => { e.stopPropagation(); handleDelete(conn.id); }}
                       className="p-1.5 hover:bg-red-900/50 text-slate-400 hover:text-red-400 rounded"
                       title="Delete"
                   >
                       <Trash2 size={14} />
                   </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewConnectionModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingConnection(null); }}
        onSave={handleSave}
        initialConnection={editingConnection}
      />
    </div>
  );
};
