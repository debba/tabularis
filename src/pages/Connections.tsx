import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NewConnectionModal } from '../components/ui/NewConnectionModal';
import { invoke } from '@tauri-apps/api/core';
import { Database, Plus, Power } from 'lucide-react';
import { useDatabase } from '../contexts/DatabaseContext';

interface SavedConnection {
  id: string;
  name: string;
  params: {
    driver: string;
    host?: string;
    database: string;
  };
}

export const Connections = () => {
  const navigate = useNavigate();
  const { connect, activeConnectionId, disconnect } = useDatabase();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [connections, setConnections] = useState<SavedConnection[]>([]);

  const loadConnections = async () => {
    try {
      const result = await invoke<SavedConnection[]>('get_connections');
      setConnections(result);
    } catch (error) {
      console.error('Failed to load connections:', error);
    }
  };

  useEffect(() => {
    loadConnections();
  }, []);

  const handleSave = (newConn: SavedConnection) => {
    setConnections(prev => [...prev, newConn]);
  };

  const handleConnect = async (conn: SavedConnection) => {
    await connect(conn.id);
    navigate('/editor');
  };

  return (
    <div className="p-6 h-full overflow-auto relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Connections</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md font-medium text-sm flex items-center gap-2"
        >
          <Plus size={16} />
          Add Connection
        </button>
      </div>
      
      {connections.length === 0 ? (
        <div className="p-8 border border-slate-800 rounded-lg bg-slate-900/50 flex flex-col items-center justify-center text-slate-400 min-h-[400px]">
          <Database size={48} className="mb-4 opacity-50" />
          <p className="mb-4">No active connections</p>
          <button 
            onClick={() => setIsModalOpen(true)}
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
                      w-10 h-10 rounded flex items-center justify-center
                      ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-800 text-blue-400'}
                    `}>
                      <Database size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-200">{conn.name}</h3>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">{conn.params.driver}</p>
                    </div>
                  </div>
                  {isActive && (
                    <div className="flex items-center gap-1 text-xs text-green-400 font-medium bg-green-400/10 px-2 py-0.5 rounded">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      Active
                    </div>
                  )}
                </div>
                
                <div className="text-sm text-slate-400 mt-3 truncate pl-1">
                  {conn.params.driver === 'sqlite' 
                    ? conn.params.database 
                    : `${conn.params.host}:${conn.params.database}`}
                </div>

                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                   {isActive ? (
                     <button 
                       onClick={(e) => { e.stopPropagation(); disconnect(); }}
                       className="p-1.5 bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-red-400 rounded"
                       title="Disconnect"
                     >
                       <Power size={16} />
                     </button>
                   ) : (
                     <button 
                       onClick={(e) => { e.stopPropagation(); handleConnect(conn); }}
                       className="p-1.5 bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white rounded"
                       title="Connect"
                     >
                       <Power size={16} />
                     </button>
                   )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewConnectionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
};
