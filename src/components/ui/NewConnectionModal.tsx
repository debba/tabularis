import { useState } from 'react';
import { X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import clsx from 'clsx';

type Driver = 'postgres' | 'mysql' | 'sqlite';

interface ConnectionParams {
  driver: Driver;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database: string;
  // SSH
  ssh_enabled?: boolean;
  ssh_host?: string;
  ssh_port?: number;
  ssh_user?: string;
  ssh_password?: string;
  ssh_key_file?: string;
}

interface SavedConnection {
  id: string;
  name: string;
  params: ConnectionParams;
}

interface NewConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (connection: SavedConnection) => void;
}

export const NewConnectionModal = ({ isOpen, onClose, onSave }: NewConnectionModalProps) => {
  const [driver, setDriver] = useState<Driver>('postgres');
  const [name, setName] = useState('');
  const [formData, setFormData] = useState<Partial<ConnectionParams>>({
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    database: 'postgres'
  });
  const [status, setStatus] = useState<'idle' | 'testing' | 'saving' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleDriverChange = (newDriver: Driver) => {
    setDriver(newDriver);
    setFormData(prev => ({
      ...prev,
      port: newDriver === 'postgres' ? 5432 : newDriver === 'mysql' ? 3306 : undefined,
      username: newDriver === 'postgres' ? 'postgres' : 'root',
    }));
    setStatus('idle');
    setMessage('');
  };

  const updateField = (field: keyof ConnectionParams, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const testConnection = async () => {
    setStatus('testing');
    setMessage('');
    try {
      const result = await invoke<string>('test_connection', {
        params: {
          driver,
          ...formData,
          port: Number(formData.port)
        }
      });
      setStatus('success');
      setMessage(result);
      return true;
    } catch (err: any) {
      setStatus('error');
      setMessage(typeof err === 'string' ? err : 'Connection failed');
      return false;
    }
  };

  const saveConnection = async () => {
    if (!name.trim()) {
      setStatus('error');
      setMessage('Connection name is required');
      return;
    }

    setStatus('saving');
    try {
      const saved = await invoke<SavedConnection>('save_connection', {
        name,
        params: {
          driver,
          ...formData,
          port: Number(formData.port)
        }
      });
      if (onSave) onSave(saved);
      onClose();
    } catch (err: any) {
      setStatus('error');
      setMessage(typeof err === 'string' ? err : 'Failed to save connection');
    }
  };

  const InputClass = "w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 mt-1";
  const LabelClass = "block text-xs text-slate-400 font-medium mt-3";

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl w-[500px] border border-slate-700 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">New Connection</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          <div>
            <label className={LabelClass}>Connection Name</label>
            <input 
              value={name}
              onChange={e => setName(e.target.value)}
              className={InputClass} 
              placeholder="My Production DB"
              autoFocus
            />
          </div>

          <div>
            <label className={LabelClass}>Database Type</label>
            <div className="flex gap-2 mt-1">
              {(['postgres', 'mysql', 'sqlite'] as Driver[]).map(d => (
                <button
                  key={d}
                  onClick={() => handleDriverChange(d)}
                  className={clsx(
                    "px-4 py-2 rounded border text-sm font-medium capitalize flex-1",
                    driver === d 
                      ? "bg-blue-600 border-blue-600 text-white" 
                      : "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {driver !== 'sqlite' && (
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className={LabelClass}>Host</label>
                <input 
                  value={formData.host}
                  onChange={e => updateField('host', e.target.value)}
                  className={InputClass} 
                />
              </div>
              <div>
                <label className={LabelClass}>Port</label>
                <input 
                  type="number"
                  value={formData.port}
                  onChange={e => updateField('port', e.target.value)}
                  className={InputClass} 
                />
              </div>
            </div>
          )}

          {driver !== 'sqlite' && (
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className={LabelClass}>Username</label>
                 <input 
                   value={formData.username}
                   onChange={e => updateField('username', e.target.value)}
                   className={InputClass} 
                 />
               </div>
               <div>
                 <label className={LabelClass}>Password</label>
                 <input 
                   type="password"
                   value={formData.password || ''}
                   onChange={e => updateField('password', e.target.value)}
                   className={InputClass} 
                   placeholder="••••••"
                 />
               </div>
             </div>
          )}

          <div>
            <label className={LabelClass}>{driver === 'sqlite' ? 'File Path' : 'Database Name'}</label>
            <input 
              value={formData.database}
              onChange={e => updateField('database', e.target.value)}
              className={InputClass} 
              placeholder={driver === 'sqlite' ? '/absolute/path/to/db.sqlite' : 'my_database'}
            />
          </div>

          {/* SSH Tunnel Section */}
          {driver !== 'sqlite' && (
            <div className="mt-6 pt-4 border-t border-slate-700">
                <div className="flex items-center gap-2 mb-3">
                    <input 
                        type="checkbox" 
                        id="ssh-toggle"
                        checked={!!formData.ssh_enabled}
                        onChange={(e) => {
                            const enabled = e.target.checked;
                            updateField('ssh_enabled', enabled);
                            if (enabled && !formData.ssh_port) updateField('ssh_port', 22);
                        }}
                        className="accent-blue-500 w-4 h-4 rounded cursor-pointer"
                    />
                    <label htmlFor="ssh-toggle" className="text-sm font-semibold text-slate-300 cursor-pointer select-none">
                        Use SSH Tunnel
                    </label>
                </div>

                {formData.ssh_enabled && (
                    <div className="space-y-4 pl-3 border-l-2 border-slate-800 ml-1">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2">
                                <label className={LabelClass}>SSH Host</label>
                                <input 
                                    value={formData.ssh_host || ''}
                                    onChange={e => updateField('ssh_host', e.target.value)}
                                    className={InputClass} 
                                    placeholder="ssh.example.com"
                                />
                            </div>
                            <div>
                                <label className={LabelClass}>SSH Port</label>
                                <input 
                                    type="number"
                                    value={formData.ssh_port || 22}
                                    onChange={e => updateField('ssh_port', Number(e.target.value))}
                                    className={InputClass} 
                                />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={LabelClass}>SSH User</label>
                                <input 
                                    value={formData.ssh_user || ''}
                                    onChange={e => updateField('ssh_user', e.target.value)}
                                    className={InputClass} 
                                    placeholder="root"
                                />
                            </div>
                            <div>
                                <label className={LabelClass}>SSH Password</label>
                                <input 
                                    type="password"
                                    value={formData.ssh_password || ''}
                                    onChange={e => updateField('ssh_password', e.target.value)}
                                    className={InputClass} 
                                    placeholder="••••••"
                                />
                            </div>
                        </div>
                        
                        <div>
                            <label className={LabelClass}>SSH Key File (Optional)</label>
                            <input 
                                value={formData.ssh_key_file || ''}
                                onChange={e => updateField('ssh_key_file', e.target.value)}
                                className={InputClass} 
                                placeholder="/path/to/id_rsa"
                            />
                        </div>
                    </div>
                )}
            </div>
          )}

          {/* Status Message */}
          {message && (
            <div className={clsx(
              "mt-6 p-3 rounded flex items-start gap-2 text-sm",
              status === 'success' ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
            )}>
              {status === 'success' ? <Check size={16} className="mt-0.5"/> : <AlertCircle size={16} className="mt-0.5"/>}
              <span>{message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex justify-end gap-3 rounded-b-lg">
          <button 
            onClick={testConnection}
            disabled={status === 'testing' || status === 'saving'}
            className="px-4 py-2 text-slate-300 hover:text-white font-medium text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {status === 'testing' && <Loader2 size={16} className="animate-spin" />}
            Test Connection
          </button>
          <button 
            onClick={saveConnection}
            disabled={status === 'saving'}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-medium text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {status === 'saving' && <Loader2 size={16} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
