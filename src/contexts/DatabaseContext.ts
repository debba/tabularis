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
  routine_type: string; // "PROCEDURE" | "FUNCTION"
  definition?: string;
}

export interface SavedConnection {
  id: string;
  name: string;
  params: {
    driver: string;
    host?: string;
    database: string;
  };
}

export interface SchemaData {
  tables: TableInfo[];
  views: ViewInfo[];
  routines: RoutineInfo[];
  isLoading: boolean;
  isLoaded: boolean;
}

export interface DatabaseContextType {
  activeConnectionId: string | null;
  activeDriver: string | null;
  activeTable: string | null;
  activeConnectionName: string | null;
  activeDatabaseName: string | null;
  tables: TableInfo[];
  views: ViewInfo[];
  routines: RoutineInfo[];
  isLoadingTables: boolean;
  isLoadingViews: boolean;
  isLoadingRoutines: boolean;
  connect: (connectionId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  setActiveTable: (table: string | null, schema?: string | null) => void;
  refreshTables: () => Promise<void>;
  refreshViews: () => Promise<void>;
  refreshRoutines: () => Promise<void>;
  // Schema support (PostgreSQL)
  schemas: string[];
  isLoadingSchemas: boolean;
  schemaDataMap: Record<string, SchemaData>;
  activeSchema: string | null;
  loadSchemaData: (schema: string) => Promise<void>;
  refreshSchemaData: (schema: string) => Promise<void>;
  // Schema selection (PostgreSQL)
  selectedSchemas: string[];
  setSelectedSchemas: (schemas: string[]) => Promise<void>;
  needsSchemaSelection: boolean;
}

export const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);
