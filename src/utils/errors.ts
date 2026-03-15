/**
 * Safely extracts an error message from an unknown caught value.
 *
 * Handles Error instances, plain strings, and arbitrary types
 * without unsafe casts.
 */
export function toErrorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  // Tauri invoke errors are often serialised as plain objects with a message field
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as Record<string, unknown>).message === "string"
  ) {
    return (err as Record<string, unknown>).message as string;
  }
  return String(err);
}
