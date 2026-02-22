# Frontend Rules
1. **No Driver Conditions:** NEVER add driver-specific conditionals (e.g., `driver === "duckdb"`, `activeDriver === "sqlite"`) in frontend code. Driver-specific logic belongs in the backend (Rust driver trait implementations or plugin code). The frontend must remain driver-agnostic.
