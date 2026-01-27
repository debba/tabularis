# debba.sql

A lightweight, developer-focused database management tool, built with Tauri and React.

> 💡 **Origin Story:** This project was born from a **vibe coding** session — an experiment in fluid, agent-assisted development to build a functional tool from scratch in record time.

<div align="center">
  <img src="screenshots/overview.png" width="80%" alt="Main Window" />
</div>

## Gallery

<div align="center">
  <img src="screenshots/screenshot-1.png" width="45%" alt="Connection Manager" />
  <img src="screenshots/screenshot-2.png" width="45%" alt="SQL Editor and Data Grid" />
</div>
<div align="center">
  <img src="screenshots/screenshot-3.png" width="45%" alt="Table Wizard" />
  <img src="screenshots/screenshot-4.png" width="45%" alt="New Connection" />
</div>

## Features

### 🚀 New in v0.2.0 (Beta)

- **Advanced SQL Execution:**
  - **Stop Queries:** Cancel long-running queries instantly.
  - **Run Selection:** Execute only highlighted SQL code.
  - **Smart Run:** Executes single query or prompts selection if multiple queries are detected.
  - **Query List:** Quick dropdown to view and execute any query in the editor.
- **Saved Queries:**
  - Save frequently used queries with custom names.
  - Manage via Sidebar context menu (Execute, Edit, Delete).
  - Saved queries are persisted as `.sql` files for portability.
- **Result Pagination:**
  - Server-side pagination (`LIMIT`/`OFFSET`) for efficiency.
  - Configurable page size (default 500).
  - "Jump to Page" navigation.
- **UI Polish:**
  - Dynamic window title shows active database.
  - Sidebar accordion layout for Saved Queries and Tables.
  - Settings page with configuration tabs.

### 🔌 Connection Management

- Support for **PostgreSQL**, **MySQL/MariaDB**, and **SQLite**.
- Save and manage multiple connection profiles.
- Secure local persistence of connection settings.
- **SSH Tunneling:** Connect to remote databases securely via SSH tunnels.

### 🗄️ Database Explorer

- **Sidebar Navigation:** Quickly browse tables and saved queries.
- **Context Actions:**
  - Right-click tables to: `Select Top 100`, `Count Rows`, `View Schema`, `Copy Name`.

### 📝 SQL Editor

- **Monaco Editor:** Industry-standard editor with syntax highlighting.
- **Execution:** Run queries with `Ctrl+Enter` or Run button.
- **Partial Execution:** Select specific text to run only that portion.
- **Query History:** (Saved Queries feature covers this usage).

### 📊 Data Grid

- **Interactive Results:** Fast rendering of large result sets.
- **Inline Editing:** Double-click any cell to edit data (requires Primary Key).
- **Row Management:** Right-click to delete rows.
- **Create New Row:** Use "New Row" button to insert data into tables.
- **Export Data:** Export query results to CSV or JSON formats.

### 💾 Configuration Storage

Connection profiles are saved locally in `connections.json` at:

- **Linux:** `~/.config/com.debba.sql/`
- **macOS:** `~/Library/Application Support/com.debba.sql/`
- **Windows:** `%APPDATA%\com.debba.sql\`

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide Icons.
- **Backend:** Rust, Tauri v2, SQLx (Async, Type-safe).
- **Build Tool:** Vite.

## Development

### Prerequisites

- Node.js (v18+)
- Rust (Stable) & Cargo
- Linux dependencies (if on Linux): `libwebkit2gtk-4.1-dev`, `build-essential`, `libssl-dev`.

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run in development mode:
   ```bash
   npm run tauri dev
   ```

### Building for Production

To build a standalone executable/installer:

```bash
npm run tauri build
```

## Roadmap

- [x] Multi-database support
- [x] Schema introspection
- [x] SQL Execution & Results
- [x] Inline Editing & Deletion
- [x] Create New Row
- [x] Data Export (CSV/JSON)
- [x] Saved Queries & Persistence
- [x] Pagination & Result Limiting
- [ ] Visual Query Builder
- [ ] Multiple Tabs support

## License

Apache License 2.0
