# AGENTS.md

## Directives
1. **Always Update Project Log:** Every session must end with an update to the "Project Log" section below, summarizing the status and actions taken.
2. **Language:** Use **English** for all code comments, documentation, and commit messages.

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

- **Next Steps:**
    - Implement actual SSH tunneling logic in Rust backend.
    - Multiple Query Tabs.

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
