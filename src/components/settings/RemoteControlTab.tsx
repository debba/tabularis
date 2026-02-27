import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '../../lib/invoke';
import {
  Wifi,
  Copy,
  Power,
  AlertTriangle,
  Loader2,
  Check,
  Globe,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  LogOut,
} from 'lucide-react';
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

interface PendingRequest {
  id: string;
  name: string | null;
  ip: string;
  status: string;
  createdAt: number;
}

interface SessionInfo {
  token: string;
  name: string | null;
  ip: string;
  connectedAt: number;
  revoked: boolean;
}

type ActiveTab = 'config' | 'sessions';

export const RemoteControlTab = () => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<ActiveTab>('config');

  const [status, setStatus] = useState<RemoteControlStatus>({
    running: false,
    port: null,
    url: null,
  });
  const [port, setPort] = useState<number>(4321);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [tunnel, setTunnel] = useState<TunnelStatus>({ running: false, url: null });
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [tunnelCopied, setTunnelCopied] = useState(false);
  const [tunnelError, setTunnelError] = useState<string | null>(null);

  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [activeSessions, setActiveSessions] = useState<SessionInfo[]>([]);
  const [sessionActionLoading, setSessionActionLoading] = useState<string | null>(null);

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

  const fetchSessions = useCallback(async () => {
    try {
      const [requests, sessions] = await Promise.all([
        invoke<PendingRequest[]>('get_access_requests'),
        invoke<SessionInfo[]>('get_active_sessions'),
      ]);
      setPendingRequests(requests);
      setActiveSessions(sessions);
    } catch (e) {
      console.error('Failed to fetch sessions', e);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchTunnelStatus();
  }, [fetchStatus, fetchTunnelStatus]);

  // Poll sessions tab every 3 seconds when active
  useEffect(() => {
    if (activeTab !== 'sessions') return;
    fetchSessions();
    const id = setInterval(fetchSessions, 3000);
    return () => clearInterval(id);
  }, [activeTab, fetchSessions]);

  const handleStart = async () => {
    setLoading(true);
    try {
      await invoke('start_remote_control', { port });
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

  const handleApprove = async (id: string) => {
    setSessionActionLoading(id);
    try {
      await invoke('approve_access_request', { id });
      await fetchSessions();
    } catch (e) {
      console.error('Failed to approve request', e);
    } finally {
      setSessionActionLoading(null);
    }
  };

  const handleDeny = async (id: string) => {
    setSessionActionLoading(id);
    try {
      await invoke('deny_access_request', { id });
      await fetchSessions();
    } catch (e) {
      console.error('Failed to deny request', e);
    } finally {
      setSessionActionLoading(null);
    }
  };

  const handleRevoke = async (token: string) => {
    setSessionActionLoading(token);
    try {
      await invoke('revoke_session', { token });
      await fetchSessions();
    } catch (e) {
      console.error('Failed to revoke session', e);
    } finally {
      setSessionActionLoading(null);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString();
  };

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-default">
        <button
          onClick={() => setActiveTab('config')}
          className={clsx(
            'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'config'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-muted hover:text-secondary',
          )}
        >
          <span className="flex items-center gap-2">
            <Wifi size={14} />
            {t('settings.remoteControl.title')}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={clsx(
            'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'sessions'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-muted hover:text-secondary',
          )}
        >
          <span className="flex items-center gap-2">
            <Users size={14} />
            {t('settings.remoteControl.sessions.title')}
            {pendingRequests.length > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {pendingRequests.length}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* Config tab */}
      {activeTab === 'config' && (
        <>
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

          {/* Cloudflare Tunnel */}
          {status.running && (
            <div className="bg-elevated border border-default rounded-xl p-6">
              <h3 className="text-lg font-semibold text-primary mb-1 flex items-center gap-2">
                <Globe size={20} className="text-green-400" />
                {t('settings.remoteControl.tunnel.title')}
              </h3>
              <p className="text-xs text-muted mb-4">
                {t('settings.remoteControl.tunnel.description')}
              </p>

              {tunnel.running && tunnel.url && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-400 shrink-0" />
                  <span className="text-sm font-mono text-blue-400 break-all">{tunnel.url}</span>
                </div>
              )}

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
        </>
      )}

      {/* Sessions tab */}
      {activeTab === 'sessions' && (
        <div className="space-y-6">
          {/* Pending Requests */}
          <div className="bg-elevated border border-default rounded-xl p-6">
            <h3 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
              <Clock size={16} className="text-yellow-400" />
              {t('settings.remoteControl.sessions.pendingRequests')}
            </h3>

            {pendingRequests.length === 0 ? (
              <p className="text-sm text-muted">{t('settings.remoteControl.sessions.noRequests')}</p>
            ) : (
              <div className="space-y-2">
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between gap-3 p-3 bg-base rounded-lg border border-default"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-primary font-medium truncate">
                        {req.name ?? req.ip}
                      </p>
                      {req.name && (
                        <p className="text-xs text-muted">{req.ip}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={sessionActionLoading === req.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {sessionActionLoading === req.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <CheckCircle size={12} />
                        )}
                        {t('settings.remoteControl.sessions.accept')}
                      </button>
                      <button
                        onClick={() => handleDeny(req.id)}
                        disabled={sessionActionLoading === req.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {sessionActionLoading === req.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <XCircle size={12} />
                        )}
                        {t('settings.remoteControl.sessions.deny')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Sessions */}
          <div className="bg-elevated border border-default rounded-xl p-6">
            <h3 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
              <Users size={16} className="text-green-400" />
              {t('settings.remoteControl.sessions.activeSessions')}
            </h3>

            {activeSessions.length === 0 ? (
              <p className="text-sm text-muted">{t('settings.remoteControl.sessions.noSessions')}</p>
            ) : (
              <div className="space-y-2">
                {activeSessions.map((session) => (
                  <div
                    key={session.token}
                    className="flex items-center justify-between gap-3 p-3 bg-base rounded-lg border border-default"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-primary font-medium truncate">
                        {session.name ?? session.ip}
                      </p>
                      <p className="text-xs text-muted">
                        {session.name && `${session.ip} · `}
                        {t('settings.remoteControl.sessions.connectedAt')} {formatTime(session.connectedAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRevoke(session.token)}
                      disabled={sessionActionLoading === session.token}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 shrink-0"
                    >
                      {sessionActionLoading === session.token ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <LogOut size={12} />
                      )}
                      {t('settings.remoteControl.sessions.disconnect')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
