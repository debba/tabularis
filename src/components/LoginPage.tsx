import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { UserCheck, Loader2, XCircle } from 'lucide-react';

const REQUEST_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
const POLL_INTERVAL_MS = 2000;

type RequestState =
  | { phase: 'form' }
  | { phase: 'waiting'; requestId: string }
  | { phase: 'denied' }
  | { phase: 'expired' };

interface LoginPageProps {
  onLogin: () => void;
}

export const LoginPage = ({ onLogin }: LoginPageProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [state, setState] = useState<RequestState>({ phase: 'form' });
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    pollRef.current = null;
    timeoutRef.current = null;
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  const startPolling = (requestId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/request-status/${requestId}`);
        if (!res.ok) return;
        const data: { status: string; token?: string } = await res.json();

        if (data.status === 'approved' && data.token) {
          clearTimers();
          localStorage.setItem('rc_token', data.token);
          onLogin();
        } else if (data.status === 'denied') {
          clearTimers();
          setState({ phase: 'denied' });
        }
      } catch {
        // server temporarily unreachable — keep polling
      }
    }, POLL_INTERVAL_MS);

    timeoutRef.current = setTimeout(() => {
      clearTimers();
      setState({ phase: 'expired' });
    }, REQUEST_TIMEOUT_MS);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch('/api/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || null }),
      });

      if (!res.ok) {
        setState({ phase: 'form' });
        return;
      }

      const data: { requestId: string } = await res.json();
      setState({ phase: 'waiting', requestId: data.requestId });
      startPolling(data.requestId);
    } catch {
      setState({ phase: 'form' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    clearTimers();
    setState({ phase: 'form' });
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <div className="bg-elevated border border-default rounded-xl p-8 w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="p-3 bg-blue-600/20 rounded-full">
            <UserCheck size={24} className="text-blue-400" />
          </div>
          <h1 className="text-xl font-semibold text-primary">Tabularis Remote</h1>
          <p className="text-sm text-muted text-center">
            {t('settings.remoteControl.request.title')}
          </p>
        </div>

        {state.phase === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('settings.remoteControl.request.namePlaceholder')}
              autoFocus
              className="w-full bg-base border border-strong rounded px-3 py-2 text-primary focus:outline-none focus:border-blue-500 transition-colors"
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {t('settings.remoteControl.request.submit')}
            </button>
          </form>
        )}

        {state.phase === 'waiting' && (
          <div className="flex flex-col items-center gap-4 py-2">
            <Loader2 size={32} className="animate-spin text-blue-400" />
            <p className="text-sm text-secondary text-center">
              {t('settings.remoteControl.request.waiting')}
            </p>
          </div>
        )}

        {state.phase === 'denied' && (
          <div className="flex flex-col items-center gap-4 py-2">
            <XCircle size={32} className="text-red-400" />
            <p className="text-sm text-red-400 text-center">
              {t('settings.remoteControl.request.denied')}
            </p>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-surface-secondary hover:bg-surface-tertiary text-primary rounded-lg text-sm font-medium transition-colors border border-default"
            >
              {t('settings.remoteControl.request.submit')}
            </button>
          </div>
        )}

        {state.phase === 'expired' && (
          <div className="flex flex-col items-center gap-4 py-2">
            <XCircle size={32} className="text-yellow-400" />
            <p className="text-sm text-yellow-400 text-center">
              {t('settings.remoteControl.request.expired')}
            </p>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-surface-secondary hover:bg-surface-tertiary text-primary rounded-lg text-sm font-medium transition-colors border border-default"
            >
              {t('settings.remoteControl.request.submit')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
