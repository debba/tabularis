<div align="center">
  <img src="public/logo-sm.png" width="120" height="120" />
</div>

# tabularis

![](https://img.shields.io/github/release/debba/tabularis.svg?style=flat)
![](https://img.shields.io/github/downloads/debba/tabularis/total.svg?style=flat)
![Build & Release](https://github.com/debba/tabularis/workflows/Release/badge.svg)
[![Known Vulnerabilities](https://snyk.io//test/github/debba/tabularis/badge.svg?targetFile=package.json)](https://snyk.io//test/github/debba/tabularis?targetFile=package.json)

A lightweight, developer-focused database management tool, built with Tauri and React.

<div align="center">
  <img src="screenshots/overview.png?v" width="80%" alt="Tabularis" />
</div>

## Release Download:

[![Windows](https://img.shields.io/badge/Windows-Download-blue?logo=windows)](https://github.com/debba/tabularis/releases/download/v0.8.7/tabularis_0.8.7_x64-setup.exe) [![macOS](https://img.shields.io/badge/macOS-Download-black?logo=apple)](https://github.com/debba/tabularis/releases/download/v0.8.7/tabularis_0.8.7_x64.dmg) [![Linux](https://img.shields.io/badge/Linux-Download-green?logo=linux)](https://github.com/debba/tabularis/releases/download/v0.8.7/tabularis_0.8.7_amd64.AppImage)

## Installation

### macOS

#### Homebrew (Recommended)

To add our tap, run:

```bash
brew tap debba/tabularis
```

Then install:

```bash
brew install --cask tabularis
```

[![Homebrew](https://img.shields.io/badge/Homebrew-Repository-orange?logo=homebrew)](https://github.com/debba/homebrew-tabularis)

#### Direct Download

When you install tabularis on macOS, you need to allow accessibility access (Privacy & Security) to the tabularis app.

If you are upgrading and you already have tabularis on the allowed list you will need to manually remove them before accessibility access can be granted to the new version.

macOS users who download directly from releases may need to run:

```bash
xattr -c /Applications/tabularis.app
```

after copying the app to the Applications directory.

### Arch Linux (AUR)

```bash
yay -S tabularis-bin
```

## Gallery

**View the full gallery at [tabularis.dev](https://tabularis.dev)**

## [Changelog](./CHANGELOG.md)

## Features

### Connection Management

- Support for **MySQL/MariaDB**, working on: **PostgreSQL** and **SQLite**.
- Save, manage, and clone connection profiles with secure local persistence.
- Manage **SSH Connections** from the connection manager.
- Optional secure password storage in system **Keychain**.
- **SSH Tunneling** with automatic readiness detection.

### Database Explorer

- **Tree View:** Browse tables, columns, keys, foreign keys, and indexes.
- **ER Diagram:** Interactive Entity-Relationship visualization (Pan, Zoom, Layout).
- **Context Actions:** Show data, count rows, modify schema, duplicate/delete tables.
- **Fast Metadata:** Parallel fetching for schema loading.

### SQL Editor

- **Monaco Editor:** Syntax highlighting and auto-completion.
- **Tabbed Interface:** Isolated connections per tab.
- **Execution:** Run full scripts, selections, or specific statements.
- **Saved Queries:** Persist frequently used SQL.

### Visual Query Builder

- **Drag-and-Drop:** Build queries visually with ReactFlow.
- **Visual JOINs:** Connect tables to create relationships.
- **Advanced Logic:** WHERE/HAVING filters, aggregates (COUNT, SUM, AVG), sorting, and limits.
- **Real-time SQL:** Instant code generation.

### Data Grid

- **Inline & Batch Editing:** Modify cells and commit multiple changes at once.
- **Row Management:** Create, delete, and select multiple rows.
- **Copy Selected Rows:** Export selections straight to the clipboard.
- **Export:** Save results as CSV or JSON.
- **Smart Context:** Read-only mode for aggregates, edit mode for tables.

### Configuration Storage

Configuration is stored in `~/.config/tabularis/` (Linux), `~/Library/Application Support/tabularis/` (macOS), or `%APPDATA%\tabularis\` (Windows).

- `connections.json`: Connection profiles.
- `saved_queries.json`: Saved SQL queries.
- `config.json`: App settings (theme, language, page size).
- `themes/`: Custom themes.

#### `config.json` options

- `theme`: Theme ID (e.g., `"tabularis-dark"`, `"monokai"`).
- `fontFamily`: Editor font family.
- `fontSize`: Editor font size (px).
- `language`: `"auto"`, `"en"`, `"it"`.
- `resultPageSize`: Default rows per page.
- `aiEnabled`: Enable/Disable AI features.

#### Custom AI Models override
You can override or add custom models for AI providers by editing `config.json` and adding the `aiCustomModels` object:

```json
{
  "resultPageSize": 1000,
  "language": "en",
  "aiEnabled": true,
  "aiProvider": "openai",
  "aiCustomModels": {
    "openai": ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo", "gpt-5-preview"],
    "anthropic": ["claude-3-opus-20240229", "claude-3-sonnet-20240229"],
    "openrouter": ["google/gemini-pro-1.5", "meta-llama/llama-3-70b-instruct"]
  }
}
```

### AI Features (Optional)

Optional Text-to-SQL and query explanation powered by:
- **OpenAI**
- **Anthropic**
- **OpenRouter** (access to Gemini, Llama, DeepSeek, etc.)
- **Ollama** (Local LLM support for total privacy)

#### Local AI (Ollama)
Select "Ollama" as your provider in Settings. Tabularis will automatically detect your local models running on port `11434` (configurable). No API key required.

#### Dynamic Model Fetching
Tabularis automatically fetches the latest available models from your configured provider.
- **Refresh:** Click the refresh icon in Settings to update the model list from the API.
- **Cache:** Model lists are cached locally for 24h to ensure fast startup.
- **Validation:** Visual feedback if the selected model is not available for the current provider.

Includes a built-in **MCP Server** (`tabularis --mcp`) to expose connections to external agents (Claude Desktop, Cursor).

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4.
- **Backend:** Rust, Tauri v2, SQLx.

## Development

### Setup

```bash
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

## Roadmap

- [x] Multi-database support
- [x] Schema introspection (Keys, FKs, Indexes)
- [x] SQL Execution & Results with pagination
- [x] Inline & Batch Editing
- [x] Data Export (CSV/JSON)
- [x] Saved Queries
- [x] Visual Query Builder
- [x] ER Diagram
- [x] Theme System & Customization
- [x] SSH Tunneling & Keychain Support
- [ ] Better support for PostgreSQL & SQLite
- [ ] Database Export/Dump
- [ ] Query history

## License

Apache License 2.0
