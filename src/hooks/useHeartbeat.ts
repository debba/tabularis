import { useEffect, useRef } from 'react';

const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const HEARTBEAT_INTERVAL_MS = 20_000;

/**
 * Sends a heartbeat to /api/heartbeat every 20 seconds (web mode only).
 * Also sends a keepalive heartbeat when the page is about to unload.
 */
export function useHeartbeat(token: string | null) {
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    if (isTauri() || !token) return;

    const sendHeartbeat = () => {
      fetch('/api/heartbeat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true,
      }).catch(() => {});
    };

    const id = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    const handleBeforeUnload = () => {
      // keepalive: true allows the request to complete even as the page closes
      if (tokenRef.current) {
        fetch('/api/heartbeat', {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenRef.current}` },
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(id);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [token]);
}
