import type { DriverCapabilities, PluginManifest } from "../types/plugins";

/**
 * Returns true if the driver uses a local file or folder (no host/port needed).
 * Defaults to false when capabilities are not available.
 */
export function isLocalDriver(
  capabilities?: DriverCapabilities | null,
): boolean {
  return (
    capabilities?.file_based === true || capabilities?.folder_based === true
  );
}

/**
 * Returns true if the driver requires a remote host/port connection.
 * Defaults to true when capabilities are not available (safe assumption).
 */
export function isRemoteDriver(
  capabilities?: DriverCapabilities | null,
): boolean {
  return !isLocalDriver(capabilities);
}

/**
 * Returns true if the driver supports named schemas (e.g. PostgreSQL).
 * Defaults to false when capabilities are not available.
 */
export function supportsSchemas(
  capabilities?: DriverCapabilities | null,
): boolean {
  return capabilities?.schemas === true;
}

/**
 * Returns true if the driver supports views.
 * Defaults to false when capabilities are not available.
 */
export function supportsViews(
  capabilities?: DriverCapabilities | null,
): boolean {
  return capabilities?.views === true;
}

/**
 * Returns true if the driver supports stored routines.
 * Defaults to false when capabilities are not available.
 */
export function supportsRoutines(
  capabilities?: DriverCapabilities | null,
): boolean {
  return capabilities?.routines === true;
}

/**
 * Returns true if the driver supports ALTER TABLE MODIFY/ALTER COLUMN.
 * Defaults to false when capabilities are not available (conservative).
 */
export function supportsAlterColumn(
  capabilities?: DriverCapabilities | null,
): boolean {
  return capabilities?.alter_column === true;
}

/**
 * Returns true if the driver properly supports creating foreign key constraints.
 * Defaults to false when capabilities are not available (conservative).
 */
export function supportsCreateForeignKeys(
  capabilities?: DriverCapabilities | null,
): boolean {
  return capabilities?.create_foreign_keys === true;
}

/**
 * Looks up a driver manifest by driver ID from a list of available drivers.
 * Returns null if not found.
 */
export function findDriverManifest(
  driverId: string,
  drivers: PluginManifest[],
): PluginManifest | null {
  return drivers.find((d) => d.id === driverId) ?? null;
}

/**
 * Returns the capabilities for a driver ID from a list of available drivers.
 * Returns null if the driver is not found in the list.
 */
export function getCapabilitiesForDriver(
  driverId: string,
  drivers: PluginManifest[],
): DriverCapabilities | null {
  return findDriverManifest(driverId, drivers)?.capabilities ?? null;
}
