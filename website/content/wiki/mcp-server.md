---
title: "MCP Server"
order: 9
excerpt: "Use Tabularis as an MCP server to let Claude Desktop, Cursor, and other AI agents query your local databases."
---

# MCP Server

Tabularis includes a built-in **Model Context Protocol (MCP)** server. Once configured, external AI assistants like **Claude Desktop** or **Cursor** can list your saved connections, read database schemas, and run SQL queries — all without leaving their chat interface.

## How It Works

Tabularis exposes an MCP server by running its own executable in a special `--mcp` mode. The MCP host (e.g. Claude Desktop) spawns the Tabularis binary as a child process and communicates over `stdin`/`stdout` using **JSON-RPC 2.0**, following the [MCP specification](https://modelcontextprotocol.io).

Tabularis exposes:

- **Resources** — read-only data the AI can access passively.
- **Tools** — callable actions the AI can invoke on your behalf.

No network port is opened. All communication happens locally via the process's stdio pipe.

## Quick Setup (Claude Desktop)

The fastest way to configure the integration is directly from Tabularis:

1. Open **Settings → AI** (or **Settings → MCP**).
2. Click **Install for Claude Desktop**.
3. Tabularis automatically writes the required entry to Claude's config file and shows a confirmation.

To verify: open Claude Desktop, start a new conversation, and ask it to list your databases. It will use the `tabularis://connections` resource automatically.

## Manual Configuration

If you prefer to configure it manually, add the following block to your Claude Desktop config file:

**Config file locations:**

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "tabularis": {
      "command": "/path/to/tabularis",
      "args": ["--mcp"]
    }
  }
}
```

Replace `/path/to/tabularis` with the actual path to the Tabularis binary on your system. After saving the file, restart Claude Desktop.

## Resources

Resources are read by the AI to understand your data environment without executing queries.

### `tabularis://connections`

Returns the list of all saved connections (id, name, driver, host, database). Passwords are never included.

**Example response:**
```json
[
  { "id": "abc123", "name": "Production PG", "driver": "postgres", "host": "db.example.com", "database": "myapp" },
  { "id": "def456", "name": "Local SQLite", "driver": "sqlite", "host": null, "database": "/home/user/dev.db" }
]
```

### `tabularis://{connection_id}/schema`

Returns the table list for a specific connection. The `{connection_id}` can be the connection's UUID **or** its human-readable name (case-insensitive, partial match supported).

**Example:**
```
tabularis://Production PG/schema
tabularis://abc123/schema
```

## Tools

Tools are actions the AI can call to retrieve or manipulate data.

### `run_query`

Executes a SQL query on a specific connection and returns the results.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `connection_id` | `string` | The connection UUID or name (partial match supported) |
| `query` | `string` | The SQL query to execute |

**Returns:** query results as JSON with `columns`, `rows`, `total_count`, and `execution_time_ms`.

**Example prompt to Claude:**
> "Show me the last 5 orders from my Production PG database"

Claude will call `run_query` with `connection_id: "Production PG"` and an appropriate `SELECT` statement.

## Security Considerations

- The MCP server runs with the **same OS permissions** as your Tabularis process — it can read any database you have credentials for.
- Only connections already saved in Tabularis (with credentials in the OS keychain) are accessible.
- Passwords and API keys are **never** exposed through MCP resources or tool outputs.
- The tool can execute **any SQL**, including `DELETE` or `DROP`. Use read-only database users if you want to restrict the AI to safe operations.
- Communication happens entirely **locally** — no data leaves your machine via the MCP channel.

## Troubleshooting

**Claude Desktop doesn't see Tabularis as a server**
- Verify the path in `claude_desktop_config.json` points to the correct Tabularis binary.
- Restart Claude Desktop after editing the config file.
- Check that the binary is executable (`chmod +x tabularis` on Linux/macOS).

**`run_query` returns "Connection not found"**
- The `connection_id` must match a name or UUID in your saved connections. Use the `tabularis://connections` resource to list available IDs.

**No resources appear in Claude**
- Tabularis reads connections from `connections.json` at the standard app data path. If you haven't saved any connections yet, the resource list will be empty.
