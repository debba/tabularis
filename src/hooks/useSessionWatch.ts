import { useEffect, useRef } from 'react';

const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const POLL_INTERVAL_MS = 5000;

interface UseSessionWatchOptions {
  token: string | null;
  onRevoked: () => void;
}

/**
 * Polls /api/session-status every 5 seconds (web mode only).
 * Calls onRevoked() when the server reports the session has been revoked.
 */
export function useSessionWatch({ token, onRevoked }: UseSessionWatchOptions) {
  const onRevokedRef = useRef(onRevoked);
  onRevokedRef.current = onRevoked;

  useEffect(() => {
    // Only active in web (remote) mode with a valid token
    if (isTauri() || !token) return;

    const poll = async () => {
      try {
        const res = await fetch('/api/session-status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data: { status: string } = await res.json();
        if (data.status === 'revoked') {
          onRevokedRef.current();
        }
      } catch {
        // server temporarily unreachable — keep polling
      }
    };

    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [token]);
}
