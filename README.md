# debba.sql
 
A lightweight, developer-focused database management tool, built with Tauri and React.

> 💡 **Origin Story:** This project was born from a **vibe coding** session — an experiment in fluid, agent-assisted development to build a functional tool from scratch in record time.

![Screenshot](https://via.placeholder.com/800x450?text=debba.sql+Screenshot)

## Features

### 🔌 Connection Management
- Support for **PostgreSQL**, **MySQL/MariaDB**, and **SQLite**.
- Save and manage multiple connection profiles.
- Secure local persistence of connection settings.

### 🗄️ Database Explorer
- **Sidebar Navigation:** Quickly browse tables in your active connection.
- **Context Actions:**
    - Right-click tables to:
        - `Select Top 100`
        - `Count Rows`
        - `View Schema` (Column types, Keys)
        - `Copy Name`

### 📝 SQL Editor
- **Monaco Editor:** Industry-standard editor with syntax highlighting and command palette.
- **Auto-complete:** (Coming soon)
- **Execution:** Run queries with `Ctrl+Enter`.
- **Resizable Split:** Adjust the layout between editor and results.

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
- Linux dependencies (if on Linux): `libwebkit2gtk-4.0-dev`, `build-essential`, `libssl-dev`.

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
- [ ] Visual Query Builder
- [ ] Multiple Tabs support

## License
MIT
