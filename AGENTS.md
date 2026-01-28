# AGENTS.md

## Directives
Adhere to the rules defined in the [rules directory](./.rules/):
- [General Rules](./.rules/general.md) (Logging & Language)
- [TypeScript Rules](./.rules/typescript.md)
- [React Rules](./.rules/react.md)

## Project Log

### Session 1: Initialization & GUI Skeleton
- **Status:** Skeleton Complete.
- **Actions:** Scaffolding, Backend setup, Frontend basic layout.

### Session 2: Connection Management & Schema Browser
- **Status:** Functional (Connect & Explore).
- **Actions:** Persistence, Introspection, Auto-query.

### Session 3: Refinements & Bug Fixes
- **Status:** Polished MVP.
- **Actions:** Monaco Editor, Resizable Split, Disconnect, Fix MySQL quoting.

### Session 4: Advanced Features (Schema & Modification)
- **Status:** Advanced / Feature Complete.
- **Actions:**
    - **Backend:**
        - Implemented introspection and modification commands (`get_columns`, `delete_record`, `update_record`).
        - Refactored executors for robustness.
    - **Frontend:**
        - **Schema View:** Added modal to view table structure.
        - **Inline Edit:** Enabled cell editing (double-click).
        - **Delete Row:** Context menu action.
        - **Sidebar:** Added active table highlighting and context actions.
        - **Edit Row Modal:** Added full-row editing capability via context menu.

### Session 5: Creation & Export & Rebrand
- **Status:** Feature Complete (Core MVP).
- **Actions:**
    - **Frontend:**
        - **New Row UI:** Implemented modal to insert new records into tables.
        - **Create Table Wizard:** Implemented DataGrip-style modal to create tables with columns, types, and constraints.
        - **Sidebar:** Added persistent "+" button for table creation.
        - **Export:** Added CSV and JSON export functionality for query results.
    - **Backend:**
        - Validated `insert_record` implementation for supported databases.
    - **Rebranding:**
        - Renamed project to **debba.sql**.
        - Updated configuration files (`tauri.conf.json`, `Cargo.toml`, `package.json`).
        - Updated UI branding in Sidebar.

### Session 6: Export Fix & SSH Prep & Branding
- **Status:** Polishing.
- **Actions:**
    - **Rebranding:** Renamed to **debba.sql**.
    - **Export:** Fixed CSV/JSON export using native Tauri dialog/fs plugins instead of web blobs.
    - **SSH Tunnel:** Added data structures and UI to configure SSH tunneling for connections.
    - **Docs:** Updated README with "vibe coding" origin story.

### Session 7: Error Handling & Robustness
- **Status:** In Progress.
- **Actions:**
    - **Connection Safety:** Prevent entering SQL Editor when connection fails.
    - **Error Feedback:** Show user-friendly errors on connection failure.

### Session 8: Bug Fixes & Driver Improvements
- **Status:** Maintenance / Bug Fixes.
- **Actions:**
    - **Data Type Handling:** Fixed incomplete pattern matching in `map_rows` for MySQL, PostgreSQL, and SQLite drivers.
    - **Backend:** Added support for `i8`, `i16`, `u8`, `u16`, `u32`, `u64`, and `f32` types to ensure correct value retrieval and prevent data loss or incorrect `Null` values.

### Session 9: Result Limiting & Settings UI
- **Status:** Feature Complete.
- **Actions:**
    - **Backend Streaming:** Refactored `execute_query` in all drivers (MySQL, Postgres, SQLite) to use streaming (`fetch`) with a configurable limit.
    - **Settings Store:** Implemented `SettingsContext` with persistence to `localStorage`.
    - **UI Updates:**
        - Created a tabbed **Settings** page ("General", "Info").
        - Added configuration for **Result Page Size**.
        - Added **Info** tab with GitHub star button.
        - **Sidebar:** Hidden Explorer sidebar when in Settings view.
    - **Editor:** Updated to send `limit` parameter and display a "Truncated" warning badge when results are limited.

### Session 10: Pagination & UI Polish
- **Status:** Feature Complete.
- **Actions:**
    - **Backend Pagination:** Implemented real SQL pagination (`LIMIT` + `OFFSET`) for `SELECT` queries across all drivers.
    - **Count Query:** Added logic to automatically count total rows for paginated queries using a wrapped `SELECT COUNT(*)`.
    - **Frontend:**
        - **Pagination Controls:** Added First/Prev/Next/Last buttons and page indicator to results footer.
        - **Jump to Page:** Implemented clickable page number for quick navigation.
        - **Sidebar Polish:** Hidden "SQL Editor" link when disconnected; added green status dot to "Connections" icon when connected.

### Session 11: Advanced Execution & Cancellation
- **Status:** Advanced / Feature Complete.
- **Actions:**
    - **Backend:**
        - **Query Sanitization:** Implemented logic to ignore trailing semicolons in queries to prevent driver errors.
        - **Cancellation:** Implemented `cancel_query` command and wrapped query execution in cancellable async tasks using `AbortHandle`.
    - **Frontend:**
        - **Stop Button:** Added a "Stop" button in the Editor toolbar that replaces "Run" during execution and cancels the active query.
        - **Execute Selection:** Added "Execute Selection" logic. Users can select a portion of SQL and run only that part via "Run" button or Context Menu.
        - **Multi-Statement Handling:** Implemented `splitQueries` utility to detect multiple SQL statements. If "Run" is clicked without selection and multiple queries exist, a modal prompts the user to select which query to execute.
        - **Run Dropdown:** Added a split-button dropdown next to "Run" to quickly view and execute any individual query present in the editor.
        - **Window Title:** Implemented dynamic window title updating to show the currently active database name.

### Session 12: Saved Queries & UX Polish
- **Status:** Feature Complete.
- **Actions:**
    - **Backend:**
        - Implemented persistence module for queries (`saved_queries.json` + `.sql` files).
        - Added CRUD commands (`save_query`, `get_saved_queries`, `update_saved_query`, `delete_saved_query`).
    - **Frontend:**
        - **Context:** Created `SavedQueriesContext` to manage query state linked to connections.
        - **Sidebar:**
            - Refactored sidebar to use Accordion layout (Saved Queries + Tables).
            - Added Context Menu for saved queries (Execute, Edit, Delete).
        - **Editor:**
            - Added "Save Query" context menu action.
            - Implemented "Save/Edit Query" Modal with Monaco Editor integration.
            - **Dropdown Polish:** Added "Save" button (floppy icon) next to each query in the "Run" dropdown list for quick saving.

### Session 14: SSH Tunnel Debugging
- **Status:** Maintenance / Debugging.
- **Actions:**
    - **Backend:**
        - **Enhanced Logging:** Added comprehensive error logging to `SshTunnel` implementation (`src-tauri/src/ssh_tunnel.rs`).
        - **Conditional Verbosity:** SSH verbose mode (`-v`) and real-time stream logging are now enabled **only in debug builds** (`#[cfg(debug_assertions)]`), ensuring a clean console for release builds.
        - **Error Capture:** Implemented rigorous stdout/stderr capture for system SSH process failures to surface actual errors (e.g., "Permission denied") to the user.
        - **Wait-for-Ready:** Fixed "first connection failure" by implementing an active wait loop (up to 10s) that verifies the local tunnel port is listening before returning success.
        - **Monitor Process:** Added logic to detect premature SSH process exit during tunnel initialization and return the captured error log immediately.

### Session 15: Rules Definition
- **Status:** Maintenance.
- **Actions:**
    - **Rules:** Created `.rules/` directory and defined `typescript.md` and `react.md` to prevent common linting/runtime errors (Any types, Hook deps, Sync setState, Fast Refresh).
    - **Docs:** Updated `AGENTS.md` to link and enforce these new rules.

### Session 16: Driver Refactoring & Type Compatibility
- **Status:** Refactoring Complete / Bug Fix.
- **Actions:**
    - **Backend Refactoring:**
        - **Created Common Module:** Added `src-tauri/src/drivers/common.rs` with shared utilities and type extraction macros.
        - **Database-Specific Macros:** Implemented three specialized macros:
            - `try_extract_mysql_value!()` - Full support for unsigned integers, UUID, TIMESTAMP/DATETIME
            - `try_extract_postgres_value!()` - Support for TIMESTAMPTZ, UUID, JSON/JSONB, no unsigned types
            - `try_extract_sqlite_value!()` - Flexible type handling with string-first approach
        - **Type Priority Fix:** Reordered type checks to prioritize DateTime types BEFORE integers to fix TIMESTAMP recognition
        - **Eliminated Redundancy:** Reduced ~500 lines of duplicate type mapping code across drivers to ~230 lines of reusable macros
    - **Type Support Enhancement:**
        - **All Databases:** Added support for UUID, Vec<u8> (base64 encoded), all integer sizes (i8-i64, u8-u64 where supported)
        - **MySQL:** NaiveDateTime, NaiveDate, NaiveTime recognition improved
        - **PostgreSQL:** DateTime<Utc>, JSON/JSONB native support
        - **SQLite:** String-first approach for flexible date handling
    - **Bug Fixes:**
        - **Fixed TIMESTAMP NULL Issue:** Corrected if-else chain continuity in macros (removed standalone blocks that broke the cascade)
        - **Fixed Truncated Badge:** Updated frontend logic to show "Paginated" badge when pagination is active
    - **Dependencies:**
        - Added `uuid` feature to sqlx in `Cargo.toml`
        - Ensured base64 encoding support for binary data

### Session 17: Clone Connection & v0.3.0
- **Status:** Release v0.3.0.
- **Actions:**
    - **Backend:** Implemented `duplicate_connection` command to clone connection profiles.
    - **Frontend:**
        - Added "Clone" button to connection cards which immediately opens the Edit modal for the new copy.
        - **Dialog Fix:** Replaced all native `confirm()` and `alert()` calls with `@tauri-apps/plugin-dialog` counterparts (`ask`, `message`) to resolve issues with native dialogs not appearing.
    - **Release:** Bumped version to **0.3.0**.

### Session 18: Multiple Query Tabs (DataGrip Style)
- **Status:** Feature Complete.
- **Actions:**
    - **State Management:**
        - Created `EditorProvider` and `EditorContext` for global tab management.
        - Implemented **Connection Isolation**: Tabs and active sessions are stored per-connection.
        - Tabs are persistent using `localStorage`.
    - **DataGrip Logic:**
        - Implemented **Typed Tabs**: `console` (SQL script) and `table` (data view).
        - **Smart Re-use**: Clicking a table in the sidebar focuses the existing tab instead of duplicating it.
        - **Auto-execution**: Tabs opened from sidebar (tables/queries) execute automatically.
    - **UI Redesign:**
        - Compact tab bar with icons, active indicators, and "close on hover" behavior.
        - Added "+" button to quickly spawn new consoles.
        - Visual execution progress bar per tab.
    - **Robustness:** Fixed infinite re-render loops using `useRef` locks and `useCallback` memoization.

- **Next Steps:**
    - Multi-statement execution (running all queries in a tab).
    - Database export/dump.

### Session 19: Visual Query Builder (Experimental)
- **Status:** Feature Complete (Experimental).
- **Actions:**
    - **Frontend:**
        - **Visual Query Builder:** Implemented DataGrip-style visual query builder using ReactFlow.
        - **Table Nodes:** Created draggable table nodes with column selection and handles for joining.
        - **JOIN Support:** Implemented visual JOIN creation by connecting column handles between tables.
        - **JOIN Type Selection:** Added clickable edge labels to cycle through JOIN types (INNER, LEFT, RIGHT, FULL OUTER, CROSS).
        - **Query Settings Panel:** Added collapsible sidebar with advanced query controls:
            - WHERE/HAVING conditions builder with:
                - AND/OR toggle buttons between conditions
                - Aggregate function checkbox to convert WHERE to HAVING
                - Column/operator/value inputs with inline delete button
                - Support for LIKE, IN, comparison operators
            - GROUP BY clause with column selection.
            - ORDER BY clause with column and direction (ASC ↑ / DESC ↓).
            - LIMIT input control.
        - **Aggregate Functions:** Implemented per-column aggregation support (COUNT, COUNT DISTINCT, SUM, AVG, MIN, MAX) with optional aliases.
        - **Auto GROUP BY:** Automatic GROUP BY generation when using aggregate functions - non-aggregated columns are automatically added to GROUP BY clause.
        - **Dark Theme Styling:** Customized ReactFlow controls, minimap, and edges for dark theme consistency.
            - Fixed select dropdown visibility (dark background with light text)
            - Improved spacing and padding throughout
            - Color-coded section icons (WHERE=blue, GROUP BY=purple, ORDER BY=green, LIMIT=orange)
        - **SQL Generation:** Automatic SQL generation with support for:
            - Multi-table SELECT with column selection.
            - JOIN clauses with proper relationship detection and type selection.
            - WHERE clauses with AND/OR logic.
            - HAVING clauses for aggregate conditions.
            - Automatic GROUP BY for mixed aggregate/non-aggregate queries.
            - ORDER BY and LIMIT clauses.
            - Aggregate functions with aliases.
        - **Tab Integration:** Added new tab type `query_builder` with Network icon and "New Visual Query" button.
        - **Run Button Integration:** Enhanced Run button to execute generated SQL from query builder directly.
        - **UX Improvements:**
            - Click column name to expand/collapse options panel
            - Delete table button positioned in top-right corner of each node
            - Reduced handle visibility with purple theme for cleaner appearance
            - Lateral padding on column rows for better spacing
            - Zoom controls refined (min: 0.1, max: 2, no excessive zoom on drag)
            - Real-time query preview in Run dropdown
    - **Types:**
        - Added `FlowState` interface with proper ReactFlow types.
        - Extended `Tab` interface to support `flowState` for persisting query builder state.
        - Enhanced `WhereCondition` with `logicalOperator` and `isAggregate` fields.
        - Refined `ColumnAggregation` to exclude empty string (undefined when no aggregation).
    - **Components:**
        - Created `VisualQueryBuilder.tsx` - Main query builder component with ReactFlow canvas.
        - Created `TableNode.tsx` - Custom node component for database tables with aggregate function UI.
        - Created `JoinEdge.tsx` - Custom edge component with clickable JOIN type labels.
    - **CSS:**
        - Added ReactFlow dark theme overrides to `index.css`.
        - Fixed select dropdown option visibility.
        - Styled controls, minimap, edges, and custom scrollbars.
    - **Bug Fixes:**
        - Fixed Run button not working in Visual Query Builder
        - Fixed Run dropdown showing stale queries - now updates in real-time
        - Fixed aggregate functions not generating correct GROUP BY clauses
        - Fixed empty string aggregation type causing incorrect SQL generation

### Session 20: Visual Query Builder Polish & Saved Queries
- **Status:** Maintenance / UX Polish.
- **Actions:**
    - **Saved Queries:**
        - Tab titles now display saved query names instead of generic "Console"
        - Query name passed through navigation state when opening from sidebar
    - **Debug:**
        - Added console logging for Visual Query Builder executed queries (visible only in browser console)

### Session 22: Advanced Schema Management
- **Status:** Release v0.5.0.
- **Actions:**
    - **Sidebar Upgrade:**
        - Implemented DataGrip-style tree view for tables (Columns, Keys, Foreign Keys, Indexes).
        - Added parallel fetching for metadata for performance.
        - Implemented `schemaVersion` state for auto-refreshing sidebar on changes.
    - **Structure Modification:**
        - **Modify/Add Column:** Created modal to manage column definitions (Type, Length, Nullable, Default, PK, AutoInc).
        - **Manage Indexes:** Added ability to create and delete indexes via context menu.
        - **Manage Foreign Keys:** Added modal to create FKs and delete action.
        - **Delete Table:** Added safe table deletion with confirmation.
    - **Data Editing UX:**
        - **Smart FK Selector:** Implemented context-aware `<select>` for Foreign Keys in New/Edit Row modals. It fetches referenced rows and displays readable labels (e.g. `ID - Name | Email`) instead of just IDs.
        - **DataGrid:** Added row numbering and row selection (Single/Multi/Range).
    - **Backend:**
        - Added `get_foreign_keys` and `get_indexes` commands for MySQL, Postgres, and SQLite.
        - Fixed `QueryResult` mapping logic for dynamic row objects.
    - **UX:**
        - **Window Title:** Dynamic update to `debba.sql - Connection (DB)` when connected.
    - **Release:** Bumped version to **0.5.0**.

### Session 23: UX Improvements
- **Status:** UX Polish.
- **Actions:**
    - **Editor UI:**
        - **Hide/Show Results:** Increased size of the toggle bar and button for better accessibility and clickability.
        - **Resize Handle:** Increased height of the resize handle (from 8px to 24px) to make it easier to grab.
