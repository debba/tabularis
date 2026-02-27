import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '../../lib/invoke';
import { Wifi, Copy, Power, AlertTriangle, Loader2, Check, Globe } from 'lucide-react';
import clsx from 'clsx';

interface RemoteControlStatus {
  running: boolean;
  port: number | null;
  url: string | null;
}

interface TunnelStatus {
  running: boolean;
  url: string | null;
}

export const RemoteControlTab = () => {
  const { t } = useTranslation();

  const [status, setStatus] = useState<RemoteControlStatus>({
    running: false,
    port: null,
    url: null,
  });
  const [port, setPort] = useState<number>(4321);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [tunnel, setTunnel] = useState<TunnelStatus>({ running: false, url: null });
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [tunnelCopied, setTunnelCopied] = useState(false);
  const [tunnelError, setTunnelError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const s = await invoke<RemoteControlStatus>('get_remote_control_status');
      setStatus(s);
      if (s.port) setPort(s.port);
    } catch (e) {
      console.error('Failed to get remote control status', e);
    }
  }, []);

  const fetchTunnelStatus = useCallback(async () => {
    try {
      const s = await invoke<TunnelStatus>('get_tunnel_status');
      setTunnel(s);
    } catch (e) {
      console.error('Failed to get tunnel status', e);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchTunnelStatus();
  }, [fetchStatus, fetchTunnelStatus]);

  const handleStart = async () => {
    setLoading(true);
    try {
      await invoke('start_remote_control', {
        port,
        password: password.trim() || null,
      });
      setTunnel({ running: false, url: null });
      await fetchStatus();
    } catch (e) {
      console.error('Failed to start remote control', e);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await invoke('stop_remote_control');
      setStatus({ running: false, port: null, url: null });
      setTunnel({ running: false, url: null });
    } catch (e) {
      console.error('Failed to stop remote control', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!status.url) return;
    await navigator.clipboard.writeText(status.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartTunnel = async () => {
    setTunnelLoading(true);
    setTunnelError(null);
    try {
      const url = await invoke<string>('start_tunnel', { port });
      setTunnel({ running: true, url });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTunnelError(msg);
    } finally {
      setTunnelLoading(false);
    }
  };

  const handleStopTunnel = async () => {
    setTunnelLoading(true);
    try {
      await invoke('stop_tunnel');
      setTunnel({ running: false, url: null });
      setTunnelError(null);
    } catch (e) {
      console.error('Failed to stop tunnel', e);
    } finally {
      setTunnelLoading(false);
    }
  };

  const handleCopyTunnelUrl = async () => {
    if (!tunnel.url) return;
    await navigator.clipboard.writeText(tunnel.url);
    setTunnelCopied(true);
    setTimeout(() => setTunnelCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Remote Control Server */}
      <div className="bg-elevated border border-default rounded-xl p-6">
        <h3 className="text-lg font-semibold text-primary mb-1 flex items-center gap-2">
          <Wifi size={20} className="text-blue-400" />
          {t('settings.remoteControl.title')}
        </h3>
        <p className="text-xs text-muted mb-6">{t('settings.remoteControl.description')}</p>

        <div className="space-y-4">
          {/* Port */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              {t('settings.remoteControl.port')}
            </label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(parseInt(e.target.value) || 4321)}
              min={1024}
              max={65535}
              disabled={status.running}
              className="bg-base border border-strong rounded px-3 py-2 text-primary w-32 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              {t('settings.remoteControl.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('settings.remoteControl.passwordPlaceholder')}
              disabled={status.running}
              className="bg-base border border-strong rounded px-3 py-2 text-primary w-64 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
            />
          </div>

          {/* Status */}
          <div className="flex items-center gap-3 py-2">
            <span
              className={clsx(
                'h-2.5 w-2.5 rounded-full',
                status.running ? 'bg-green-400' : 'bg-muted',
              )}
            />
            <span className="text-sm text-secondary">
              {status.running
                ? t('settings.remoteControl.status.running')
                : t('settings.remoteControl.status.stopped')}
            </span>
            {status.url && (
              <span className="text-sm text-blue-400 font-mono">{status.url}</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {!status.running ? (
              <button
                onClick={handleStart}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Power size={14} />
                )}
                {t('settings.remoteControl.startServer')}
              </button>
            ) : (
              <>
                <button
                  onClick={handleStop}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Power size={14} />
                  )}
                  {t('settings.remoteControl.stopServer')}
                </button>

                {status.url && (
                  <button
                    onClick={handleCopyUrl}
                    className="flex items-center gap-2 px-4 py-2 bg-surface-secondary hover:bg-surface-tertiary text-primary rounded-lg text-sm font-medium transition-colors border border-default"
                  >
                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    {copied ? 'Copied!' : t('settings.remoteControl.copyUrl')}
                  </button>
                )}

                <button
                  onClick={handleStart}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-surface-secondary hover:bg-surface-tertiary text-primary rounded-lg text-sm font-medium transition-colors border border-default disabled:opacity-50"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                  {t('settings.remoteControl.saveAndRestart')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cloudflare Tunnel — only available when server is running */}
      {status.running && (
        <div className="bg-elevated border border-default rounded-xl p-6">
          <h3 className="text-lg font-semibold text-primary mb-1 flex items-center gap-2">
            <Globe size={20} className="text-green-400" />
            {t('settings.remoteControl.tunnel.title')}
          </h3>
          <p className="text-xs text-muted mb-4">
            {t('settings.remoteControl.tunnel.description')}
          </p>

          {/* Tunnel URL */}
          {tunnel.running && tunnel.url && (
            <div className="flex items-center gap-2 mb-4">
              <span className="h-2.5 w-2.5 rounded-full bg-green-400 shrink-0" />
              <span className="text-sm font-mono text-blue-400 break-all">{tunnel.url}</span>
            </div>
          )}

          {/* Error */}
          {tunnelError && (
            <p className="text-xs text-red-400 mb-4 break-all">{tunnelError}</p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {!tunnel.running ? (
              <button
                onClick={handleStartTunnel}
                disabled={tunnelLoading}
                className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {tunnelLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Globe size={14} />
                )}
                {tunnelLoading
                  ? t('settings.remoteControl.tunnel.generating')
                  : t('settings.remoteControl.tunnel.generate')}
              </button>
            ) : (
              <>
                <button
                  onClick={handleStopTunnel}
                  disabled={tunnelLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {tunnelLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Power size={14} />
                  )}
                  {t('settings.remoteControl.tunnel.stop')}
                </button>

                {tunnel.url && (
                  <button
                    onClick={handleCopyTunnelUrl}
                    className="flex items-center gap-2 px-4 py-2 bg-surface-secondary hover:bg-surface-tertiary text-primary rounded-lg text-sm font-medium transition-colors border border-default"
                  >
                    {tunnelCopied ? (
                      <Check size={14} className="text-green-400" />
                    ) : (
                      <Copy size={14} />
                    )}
                    {tunnelCopied ? 'Copied!' : t('settings.remoteControl.copyUrl')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Warning */}
      <div className="flex items-start gap-3 px-4 py-3 bg-yellow-900/20 border border-yellow-700/40 rounded-lg text-sm text-yellow-400">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <span>{t('settings.remoteControl.warning')}</span>
      </div>
    </div>
  );
};
