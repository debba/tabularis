# Why Tabularis

This project was born from frustration with existing database tools. Most current solutions feel clunky, outdated, or bloated with poor user experience.

**Tabularis** is the answer: a refreshing alternative built to prioritize UX without sacrificing power. It bridges the gap between native performance and web flexibility, using Tauri to keep the footprint tiny and startup instant.

# Capabilities

### 🔌 Multi-Database
First-class support for **PostgreSQL** (with multi-schema support), **MySQL/MariaDB**, and **SQLite**. Manage multiple connection profiles with secure local persistence.

### 🤖 AI Assistance (Experimental)
Generate SQL from natural language ("Show me active users") and get explanations for complex queries. Securely integrated with OpenAI, Anthropic, OpenRouter, and **Ollama (Local LLM)** for total privacy.

### 🔌 MCP Server
Built-in **Model Context Protocol** support. Expose your database schemas and run queries directly from Claude or other MCP-compatible AI agents.

### 🎨 Visual Query Builder
Construct complex queries visually. Drag tables, connect columns for JOINs, and let the tool write the SQL for you. Includes aggregate functions and advanced filtering.

### 🔒 SSH Tunneling & Security
Connect to remote databases securely through SSH tunnels and manage SSH connections right from the connection manager. Passwords and API Keys are stored securely in your system's Keychain.

### 📝 Modern SQL Editor
Monaco-based editor with syntax highlighting, multiple tabs, and DataGrip-style execution (run selected, run all).

### 🪟 Split View
Work with **multiple connections simultaneously** in a resizable split-pane layout. Open any connection directly from the sidebar context menu and compare results across databases side by side.

### 🗄️ Schema Management
**Inline editing** of table and column properties directly from the sidebar. GUI wizards to Create Tables, Modify Columns, and Manage Indexes/Foreign Keys.

# Plugins

Tabularis supports extending its database support via an **external plugin system**. Plugins are standalone executables that communicate with the app through **JSON-RPC 2.0 over stdin/stdout**. They can be written in any programming language and distributed independently of the main app.

### 🧩 Language-Agnostic
Write your driver in Rust, Go, Python, Node.js — anything that speaks JSON-RPC over stdin/stdout. No SDK required.

### ⚡ Hot Install
Install, update, and remove plugins from **Settings → Plugins** without restarting. New drivers appear instantly in the connection form.

### 🔒 Process Isolation
Each plugin runs as a separate process. A crashing plugin never takes down the app — only the affected connection fails.

# Themes

Why stare at a dull interface? Tabularis brings a first-class theming experience. Switch instantly between **10+ presets** without restarting. Syntax highlighting is automatically generated from the UI theme, ensuring perfect visual harmony.

# Installation

### macOS — Homebrew

```bash
brew tap debba/tabularis
brew install --cask tabularis
```

If macOS blocks the app after a direct `.dmg` install, run:

```bash
xattr -c /Applications/tabularis.app
```

### Linux — Snap

```bash
sudo snap install tabularis
```

### Linux — Arch (AUR)

```bash
yay -S tabularis-bin
```

### Build from Source

Requires Node.js and Rust installed on your machine.

```bash
git clone https://github.com/debba/tabularis.git
cd tabularis
npm install
npm run tauri build
```
