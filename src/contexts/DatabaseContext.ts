import { createContext } from 'react';

export interface TableInfo {
  name: string;
}

export interface ViewInfo {
  name: string;
  definition?: string;
}

export interface RoutineInfo {
  name: string;
  routine_type: string;
  definition?: string;
}

export interface SavedConnection {
  id: string;
  name: string;
  params: {
    driver: string;
    host?: string;
    database: string;
    port?: number;
    username?: string;
    password?: string;
    ssh_enabled?: boolean;
    ssh_connection_id?: string;
  };
}

export interface SchemaData {
  tables: TableInfo[];
  views: ViewInfo[];
  routines: RoutineInfo[];
  isLoading: boolean;
  isLoaded: boolean;
}

export interface ConnectionData {
  driver: string;
  connectionName: string;
  databaseName: string;
  tables: TableInfo[];
  views: ViewInfo[];
  routines: RoutineInfo[];
  isLoadingTables: boolean;
  isLoadingViews: boolean;
  isLoadingRoutines: boolean;
  schemas: string[];
  isLoadingSchemas: boolean;
  schemaDataMap: Record<string, SchemaData>;
  activeSchema: string | null;
  selectedSchemas: string[];
  needsSchemaSelection: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  error?: string;
}

export interface DatabaseContextType {
  activeConnectionId: string | null;
  openConnectionIds: string[];
  connectionDataMap: Record<string, ConnectionData>;
  activeTable: string | null;
  activeDriver: string | null;
  activeConnectionName: string | null;
  activeDatabaseName: string | null;
  tables: TableInfo[];
  views: ViewInfo[];
  routines: RoutineInfo[];
  isLoadingTables: boolean;
  isLoadingViews: boolean;
  isLoadingRoutines: boolean;
  schemas: string[];
  isLoadingSchemas: boolean;
  schemaDataMap: Record<string, SchemaData>;
  activeSchema: string | null;
  selectedSchemas: string[];
  needsSchemaSelection: boolean;
  connections: SavedConnection[];
  loadConnections: () => Promise<void>;
  isLoadingConnections: boolean;
  connect: (connectionId: string) => Promise<void>;
  disconnect: (connectionId?: string) => Promise<void>;
  switchConnection: (connectionId: string) => void;
  setActiveTable: (table: string | null, schema?: string | null) => void;
  refreshTables: () => Promise<void>;
  refreshViews: () => Promise<void>;
  refreshRoutines: () => Promise<void>;
  loadSchemaData: (schema: string) => Promise<void>;
  refreshSchemaData: (schema: string) => Promise<void>;
  setSelectedSchemas: (schemas: string[]) => Promise<void>;
  getConnectionData: (connectionId: string) => ConnectionData | undefined;
  isConnectionOpen: (connectionId: string) => boolean;
}

export const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);
