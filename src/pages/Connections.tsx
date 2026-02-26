import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NewConnectionModal } from '../components/ui/NewConnectionModal';
import { invoke } from '@tauri-apps/api/core';
import { ask } from '@tauri-apps/plugin-dialog';
import { Database, Plus, Power, Edit, Trash2, Shield, AlertCircle, Copy, Loader2 } from 'lucide-react';
import { useDatabase } from '../hooks/useDatabase';
import { useDrivers } from '../hooks/useDrivers';
import { getConnectionCardClass, getConnectionIconClass } from '../utils/connectionManager';
import { isLocalDriver, getCapabilitiesForDriver } from '../utils/driverCapabilities';

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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { connect, activeConnectionId, disconnect, isConnectionOpen, switchConnection } = useDatabase();
  const { allDrivers } = useDrivers();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<SavedConnection | null>(null);
  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);

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

    // If already open, just switch and navigate
    if (isConnectionOpen(conn.id)) {
      switchConnection(conn.id);
      navigate('/editor');
      return;
    }

    setConnectingId(conn.id);
    try {
      await connect(conn.id);
      navigate('/editor');
    } catch (e) {
      console.error('Connection error:', e);
      const errorMsg = typeof e === 'string' ? e : (e as Error).message || String(e);
      setError(`${t('connections.failConnect', { name: conn.name })}\n\nError: ${errorMsg}`);
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    try {
      await disconnect();
    } catch (e) {
      console.error('Disconnect error:', e);
      const errorMsg = typeof e === 'string' ? e : (e as Error).message || String(e);
      setError(`${t('connections.failDisconnect')}\n\nError: ${errorMsg}`);
    }
  };

  const handleDelete = async (id: string) => {
      const confirmed = await ask(t('connections.confirmDelete'), { 
          title: t('connections.deleteTitle'),
          kind: 'warning'
      });
      
      if (confirmed) {
          try {
              if (activeConnectionId === id) {
                  await disconnect();
              }
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
        setError(t('connections.failDuplicate'));
    }
  };

  return (
    <div className="p-6 h-full overflow-auto relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t('connections.title')}</h1>
        <button 
          onClick={() => { setEditingConnection(null); setIsModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md font-medium text-sm flex items-center gap-2"
        >
          <Plus size={16} />
          {t('connections.addConnection')}
        </button>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-900/50 rounded-lg flex items-center gap-3 text-red-400">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}
      
      {connections.length === 0 ? (
        <div className="p-8 border border-default rounded-lg bg-elevated/50 flex flex-col items-center justify-center text-secondary min-h-[400px]">
          <Database size={48} className="mb-4 opacity-50" />
          <p className="mb-4">{t('connections.noConnections')}</p>
          <button 
            onClick={() => { setEditingConnection(null); setIsModalOpen(true); }}
            className="text-blue-400 hover:text-blue-300 font-medium"
          >
            {t('connections.createFirst')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {connections.map(conn => {
            const isActive = activeConnectionId === conn.id;
            const isOpen = isConnectionOpen(conn.id);
            return (
              <div
                key={conn.id}
                onDoubleClick={() => handleConnect(conn)}
                className={`p-4 border rounded-lg transition-all cursor-pointer group relative ${getConnectionCardClass(isActive, isOpen, connectingId === conn.id)} ${connectingId === conn.id ? 'pointer-events-none' : ''}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded flex items-center justify-center relative ${getConnectionIconClass(isActive, isOpen)}`}>
                      <Database size={20} />
                      {conn.params.ssh_enabled && (
                          <div className="absolute -bottom-1 -right-1 bg-elevated rounded-full p-0.5" title={t('connections.sshEnabled')}>
                              <Shield size={12} className="text-emerald-400 fill-emerald-400/20" />
                          </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-primary">{conn.name}</h3>
                      <p className="text-xs text-muted uppercase tracking-wider flex items-center gap-1">
                          {conn.params.driver}
                          {conn.params.ssh_enabled && <span className="text-emerald-500 font-bold text-[10px] ml-1">SSH</span>}
                      </p>
                    </div>
                  </div>
                  {isActive ? (
                    <div className="flex items-center gap-1 text-xs text-green-400 font-medium bg-green-400/10 px-2 py-0.5 rounded">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      {t('connections.active')}
                    </div>
                  ) : isOpen ? (
                    <div className="flex items-center gap-1 text-xs text-green-500/70 font-medium bg-green-400/5 px-2 py-0.5 rounded">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500/70" />
                      {t('connections.open')}
                    </div>
                  ) : null}
                </div>
                
                <div className="text-sm text-secondary mt-3 truncate pl-1 font-mono">
                  {isLocalDriver(getCapabilitiesForDriver(conn.params.driver, allDrivers))
                    ? conn.params.database
                    : `${conn.params.host}:${conn.params.database}`}
                </div>

                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-elevated/80 p-1 rounded-lg backdrop-blur-sm border border-white/30">
                    {isActive ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDisconnect(); }}
                        className="p-1.5 hover:bg-red-900/50 text-secondary hover:text-red-400 rounded"
                        title={t('connections.disconnect')}
                      >
                        <Power size={14} />
                      </button>
                    ) : (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleConnect(conn); }}
                         className="p-1.5 hover:bg-green-900/50 text-secondary hover:text-green-400 rounded"
                        title={t('connections.connect')}
                      >
                        <Power size={14} />
                      </button>
                    )}
                   
                    <div className="w-[1px] h-4 bg-strong mx-0.5 self-center" />

                   <button 
                       onClick={(e) => { e.stopPropagation(); openEdit(conn); }}
                        className="p-1.5 hover:bg-blue-900/50 text-secondary hover:text-blue-400 rounded"
                       title={t('connections.edit')}
                   >
                       <Edit size={14} />
                   </button>
                   <button 
                       onClick={(e) => { e.stopPropagation(); handleDuplicate(conn.id); }}
                        className="p-1.5 hover:bg-purple-900/50 text-secondary hover:text-purple-400 rounded"
                       title={t('connections.clone')}
                   >
                       <Copy size={14} />
                   </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(conn.id); }}
                        className="p-1.5 hover:bg-red-900/50 text-secondary hover:text-red-400 rounded"
                        title={t('connections.delete')}
                    >
                        <Trash2 size={14} />
                    </button>
                 </div>
                 {connectingId === conn.id && (
                    <div className="absolute inset-0 bg-elevated/80 rounded-lg flex items-center justify-center">
                     <div className="flex flex-col items-center gap-2">
                       <Loader2 size={24} className="animate-spin text-blue-400" />
                       <span className="text-sm text-blue-300 font-medium">
                         {t('connections.connecting')}
                       </span>
                     </div>
                   </div>
                 )}
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
