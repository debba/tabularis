<div align="center">
  <img src="public/logo-sm.png" width="120" height="120" />
</div>

# tabularis

![](https://img.shields.io/github/release/debba/tabularis.svg?style=flat)
![](https://img.shields.io/github/downloads/debba/tabularis/total.svg?style=flat)
![Build & Release](https://github.com/debba/tabularis/workflows/Release/badge.svg)
[![Known Vulnerabilities](https://snyk.io//test/github/debba/tabularis/badge.svg?targetFile=package.json)](https://snyk.io//test/github/debba/tabularis?targetFile=package.json)
[![Discord](https://img.shields.io/discord/1470772941296894128?color=5865F2&logo=discord&logoColor=white)](https://discord.gg/WgsVw69F)

A lightweight, developer-focused database management tool, built with Tauri and React.

**Discord** - [Join our discord server](https://discord.gg/WgsVw69F) and chat with the maintainers.

<div align="center">
  <img src="screenshots/overview.png?v" width="80%" alt="Tabularis" />
</div>

## Release Download:

[![Windows](https://img.shields.io/badge/Windows-Download-blue?logo=windows)](https://github.com/debba/tabularis/releases/download/v0.8.10/tabularis_0.8.10_x64-setup.exe) [![macOS](https://img.shields.io/badge/macOS-Download-black?logo=apple)](https://github.com/debba/tabularis/releases/download/v0.8.10/tabularis_0.8.10_x64.dmg) [![Linux](https://img.shields.io/badge/Linux-Download-green?logo=linux)](https://github.com/debba/tabularis/releases/download/v0.8.10/tabularis_0.8.10_amd64.AppImage)

## Table of Contents

- [Installation](#installation)
  - [macOS](#macos)
  - [Arch Linux (AUR)](#arch-linux-aur)
- [Updates](#updates)
- [Gallery](#gallery)
- [Discord](#discord)
- [Changelog](#changelog)
- [Features](#features)
  - [Connection Management](#connection-management)
  - [Database Explorer](#database-explorer)
  - [SQL Editor](#sql-editor)
  - [Visual Query Builder](#visual-query-builder)
  - [Data Grid](#data-grid)
  - [Logging](#logging)
  - [Configuration Storage](#configuration-storage)
  - [AI Features (Optional)](#ai-features-optional)
- [Tech Stack](#tech-stack)
- [Development](#development)
- [Roadmap](#roadmap)
- [License](#license)

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

## Updates

### Automatic Updates

Tabularis checks for updates automatically on startup. When a new version is available, a notification will appear, allowing you to download and install the update seamlessly.

### Manual Updates

You can also manually check for updates or download the latest version directly from the [Releases page](https://github.com/debba/tabularis/releases).

## Gallery

**View the full gallery at [tabularis.dev](https://tabularis.dev)**

## Discord

Join our [Discord server](https://discord.gg/WgsVw69F) to chat with the maintainers, suggest features, or get help from the community.

## [Changelog](./CHANGELOG.md)

## Features

### Connection Management

- Support for **MySQL/MariaDB**, working on: **PostgreSQL** and **SQLite**.
- Save, manage, and clone connection profiles with secure local persistence.
- Manage **SSH Connections** from the connection manager.
- Optional secure password storage in system **Keychain**.
- **SSH Tunneling** with automatic readiness detection.

### Database Explorer

- **Tree View:** Browse tables, columns, keys, foreign keys, indexes, views, and stored routines.
- **ER Diagram:** Interactive Entity-Relationship visualization (Pan, Zoom, Layout) with selective table diagram generation.
- **Context Actions:** Show data, count rows, modify schema, duplicate/delete tables.
- **Views Support:** Browse, inspect, and query database views with full metadata.
- **Stored Routines:** View and manage stored procedures and functions with parameter details.
- **Fast Metadata:** Parallel fetching for schema loading.
- **SQL Dump & Import:** Export and restore databases with a single flow.

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

### Logging

- **Real-time Monitoring:** View application logs directly in Settings.
- **Level Filtering:** Filter by DEBUG, INFO, WARN, or ERROR severity.
- **In-memory Buffer:** Configurable retention.
- **Query Expansion:** Automatically expand and inspect SQL queries in logs.
- **Export Logs:** Save logs to `.log` files for debugging or audit trails.
- **Toggle Control:** Enable/disable logging and adjust buffer size without restart.
- **CLI Debug Mode:** Start with `tabularis --debug` to enable verbose logging (including internal SQLx queries) from launch.

### Configuration Storage

Configuration is stored in `~/.config/tabularis/` (Linux), `~/Library/Application Support/tabularis/` (macOS), or `%APPDATA%\tabularis\` (Windows).

- `connections.json`: Connection profiles.
- `saved_queries.json`: Saved SQL queries.
- `config.json`: App settings (theme, language, page size).
- `themes/`: Custom themes.
- `preferences/`: Editor preferences per connection (tabs, queries, layout).

#### Editor Preferences

Tabularis automatically saves your editor state for each database connection. When you reopen a connection, you'll see your previously opened tabs with their queries restored.

**Location:** `~/.config/tabularis/preferences/{connectionId}/preferences.json`

**What is saved:**

- Tab titles and types (Console, Table, Visual Query)
- SQL queries and query parameters
- Active table and selected columns
- Filter, sort, and limit clauses
- Visual Query Builder flow state
- Editor visibility state

**What is NOT saved:**

- Query results (you'll need to re-run queries)
- Error messages
- Execution times
- Pending edits or deletions
- Loading states

This approach ensures fast startup times while preserving your workspace layout across sessions.

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
- **OpenAI-Compatible APIs** (Groq, Perplexity, Azure OpenAI, LocalAI, and more)

#### Local AI (Ollama)

Select "Ollama" as your provider in Settings. Tabularis will automatically detect your local models running on port `11434` (configurable). No API key required.

#### OpenAI-Compatible APIs

Select "OpenAI Compatible" as your provider to connect to any service that implements the OpenAI API format. Configure your custom endpoint URL and model name in Settings. Examples:

- **Groq**: `https://api.groq.com/openai/v1`
- **Perplexity**: `https://api.perplexity.ai`
- **Local servers**: `http://localhost:8000/v1`

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

- [ ] [Command Palette](https://github.com/debba/tabularis/issues/25)
- [ ] [JSON/JSONB Editor & Viewer](https://github.com/debba/tabularis/issues/24)
- [ ] [SQL Formatting / Prettier](https://github.com/debba/tabularis/issues/23)
- [ ] [Visual Explain Analyze](https://github.com/debba/tabularis/issues/22)
- [ ] [Data Compare / Diff Tool](https://github.com/debba/tabularis/issues/21)
- [ ] [Team Collaboration](https://github.com/debba/tabularis/issues/20)
- [ ] [Plugin System](https://github.com/debba/tabularis/issues/19)
- [ ] [Query History](https://github.com/debba/tabularis/issues/18)
- [ ] [Better SQLite Support](https://github.com/debba/tabularis/issues/17)
- [ ] [Better PostgreSQL Support](https://github.com/debba/tabularis/issues/16)

## License

Apache License 2.0
