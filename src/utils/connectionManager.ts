import type { SavedConnection, ConnectionData } from '../contexts/DatabaseContext';

export interface ConnectionStatus {
  id: string;
  name: string;
  driver: string;
  database: string;
  host?: string;
  sshEnabled: boolean;
  isOpen: boolean;
  isActive: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  error?: string;
}

/** Build a ConnectionStatus from raw connection data */
export function buildConnectionStatus(
  conn: SavedConnection,
  isOpen: boolean,
  isActive: boolean,
  data: ConnectionData | undefined,
): ConnectionStatus {
  return {
    id: conn.id,
    name: conn.name,
    driver: conn.params.driver,
    database: conn.params.database,
    host: conn.params.host,
    sshEnabled: conn.params.ssh_enabled ?? false,
    isOpen,
    isActive,
    isConnecting: data?.isConnecting ?? false,
    isConnected: data?.isConnected ?? false,
    error: data?.error,
  };
}

/** Split connections into open and closed */
export function partitionConnections(connections: ConnectionStatus[]): {
  openConnections: ConnectionStatus[];
  closedConnections: ConnectionStatus[];
} {
  return {
    openConnections: connections.filter((c) => c.isOpen),
    closedConnections: connections.filter((c) => !c.isOpen),
  };
}

/** CSS class for the connection button in the narrow sidebar */
export function getConnectionItemClass(isActive: boolean): string {
  return isActive
    ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40'
    : 'text-secondary hover:bg-surface-secondary hover:text-primary';
}

/** CSS class for the status dot inside the connection button */
export function getStatusDotClass(isActive: boolean, hasError: boolean): string {
  if (hasError) return 'bg-red-400';
  return isActive ? 'bg-green-400' : 'bg-green-400/70';
}

/** CSS classes for the connection card in the Connections page */
export function getConnectionCardClass(
  isActive: boolean,
  isOpen: boolean,
  isConnecting: boolean,
): string {
  if (isConnecting) return 'bg-blue-900/10 border-blue-400/30 animate-pulse';
  if (isActive) return 'bg-blue-900/20 border-blue-500/50';
  if (isOpen) return 'bg-green-900/10 border-green-500/30 hover:border-green-500/50';
  return 'bg-elevated border-default hover:border-strong';
}

/** CSS class for the connection icon in the Connections page */
export function getConnectionIconClass(isActive: boolean, isOpen: boolean): string {
  if (isActive) return 'bg-blue-600 text-white';
  if (isOpen) return 'bg-green-900/30 text-green-400';
  return 'bg-surface-secondary text-blue-400';
}
