import type { TableColumn, PendingInsertion } from "../types/editor";

/**
 * Genera un ID temporaneo univoco per una pending insertion
 */
export function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Inizializza i dati di una nuova riga con valori di default
 */
export function initializeNewRow(columns: TableColumn[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  columns.forEach((col) => {
    if (col.is_auto_increment) {
      data[col.name] = null; // Auto-increment gestito dal DB
    } else if (col.is_nullable) {
      data[col.name] = null; // NULL di default
    } else {
      data[col.name] = ""; // Stringa vuota per required
    }
  });

  return data;
}

/**
 * Valida una pending insertion controllando campi obbligatori
 * @returns Mappa colonna → messaggio errore (vuota se validazione OK)
 */
export function validatePendingInsertion(
  insertion: PendingInsertion,
  columns: TableColumn[]
): Record<string, string> {
  const errors: Record<string, string> = {};

  columns.forEach((col) => {
    // Skip auto-increment (gestito dal DB)
    if (col.is_auto_increment) return;

    // Controlla campi required
    if (!col.is_nullable) {
      const value = insertion.data[col.name];
      if (value === null || value === undefined || value === "") {
        errors[col.name] = "Campo obbligatorio";
      }
    }
  });

  return errors;
}

/**
 * Converte una pending insertion in formato per backend insert_record
 */
export function insertionToBackendData(
  insertion: PendingInsertion,
  columns: TableColumn[]
): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  columns.forEach((col) => {
    // Skip auto-increment columns
    if (col.is_auto_increment) return;

    const value = insertion.data[col.name];
    data[col.name] = value;
  });

  return data;
}

/**
 * Filtra pending insertions per row selection
 */
export function filterInsertionsBySelection(
  pendingInsertions: Record<string, PendingInsertion>,
  selectedDisplayIndices: Set<number>
): PendingInsertion[] {
  return Object.values(pendingInsertions).filter((insertion) =>
    selectedDisplayIndices.has(insertion.displayIndex)
  );
}
