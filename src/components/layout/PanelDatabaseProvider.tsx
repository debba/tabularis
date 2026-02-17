import type { ReactNode } from 'react';
import { DatabaseContext } from '../../contexts/DatabaseContext';
import { useDatabase } from '../../hooks/useDatabase';

interface Props {
  connectionId: string;
  children: ReactNode;
}

/** Overrides DatabaseContext for a single split panel with the given connectionId */
export const PanelDatabaseProvider = ({ connectionId, children }: Props) => {
  const sharedContext = useDatabase();
  const data = sharedContext.connectionDataMap[connectionId];

  return (
    <DatabaseContext.Provider
      value={{
        ...sharedContext,
        activeConnectionId: connectionId,
        activeDriver: data?.driver ?? null,
        activeConnectionName: data?.connectionName ?? null,
        activeDatabaseName: data?.databaseName ?? null,
        tables: data?.tables ?? [],
        views: data?.views ?? [],
        routines: data?.routines ?? [],
        isLoadingTables: data?.isLoadingTables ?? false,
        isLoadingViews: data?.isLoadingViews ?? false,
        isLoadingRoutines: data?.isLoadingRoutines ?? false,
        schemas: data?.schemas ?? [],
        isLoadingSchemas: data?.isLoadingSchemas ?? false,
        schemaDataMap: data?.schemaDataMap ?? {},
        activeSchema: data?.activeSchema ?? null,
        selectedSchemas: data?.selectedSchemas ?? [],
        needsSchemaSelection: data?.needsSchemaSelection ?? false,
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};
