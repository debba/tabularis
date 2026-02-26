import { invoke as tauriInvoke } from '@tauri-apps/api/core';

const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function invoke<T>(
  command: string,
  params?: Record<string, unknown>,
): Promise<T> {
  if (isTauri()) {
    return tauriInvoke<T>(command, params);
  }

  const token = localStorage.getItem('rc_token');
  const res = await fetch('/api/invoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ command, params: params ?? {} }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) {
      const hadToken = !!localStorage.getItem('rc_token');
      localStorage.removeItem('rc_token');
      if (hadToken) {
        window.location.reload();
      }
    }
    throw new Error(text);
  }
  return res.json() as Promise<T>;
}
