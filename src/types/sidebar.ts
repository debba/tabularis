import type { SavedQuery } from "../contexts/SavedQueriesContext";
import type { RoutineInfo } from "../contexts/DatabaseContext";

export type ContextMenuData = SavedQuery | { tableName: string; schema?: string } | RoutineInfo;
