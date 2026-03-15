---
title: "Connection Management"
order: 2
excerpt: "Learn how to manage your database connections securely with SSH tunneling and keychain integration."
category: "Database Objects"
---

# Connection Management

Tabularis stores connection profiles as JSON (non-sensitive fields) and delegates all secrets to the OS keychain — Keychain Access on macOS, Windows Credential Manager on Windows, and libsecret (GNOME Keyring / KWallet) on Linux.

![Connection Manager](/img/tabularis-connection-manager.png)

## Supported Drivers

The following drivers are registered at startup and available natively, with no plugin required:

| Driver ID | Database | Default Port | Multi-database |
| :--- | :--- | :--- | :--- |
| `postgres` | PostgreSQL | 5432 | — (uses schemas) |
| `mysql` | MySQL / MariaDB | 3306 | Yes |
| `sqlite` | SQLite | *(file path)* | — (file-based) |

Each built-in driver renders with its own branded icon in the Connections page — the PostgreSQL elephant, MySQL dolphin, and SQLite cylinder — displayed in the driver's official color. Plugin drivers use any icon declared in their manifest, or a generic fallback.

Additional drivers can be added via the [Plugin System](/wiki/plugins).

## Connections Page

The Connections page (`Cmd/Ctrl + Shift + C`) lists all saved profiles and supports two display modes, switchable from the toolbar:

- **Grid** — each connection is a card with the driver icon, status badge, host/database info, and SSH indicator.
- **List** — the same information in compact rows, better suited for large numbers of connections.

A search bar filters by name or host in real time.

Double-click a card or row to connect immediately.

## Connection Profile Fields

When creating a connection (`+` button in the sidebar or `Cmd/Ctrl + Shift + N`):

| Field | Required | Description |
| :--- | :--- | :--- |
| **Name** | Yes | Display label in the sidebar |
| **Driver** | Yes | Selects the database type |
| **Host** | Yes* | Hostname or IP address |
| **Port** | Yes* | Auto-filled from the driver default |
| **Database** | Yes* | The database name to connect to |
| **Username** | Yes* | Database user |
| **Password** | No | Stored in OS keychain; never written to disk |
| **Save in keychain** | — | Controls whether the password persists after closing |
| **SSH enabled** | No | Activates the SSH tunnel for this connection |
| **SSH profile** | — | Which saved SSH profile to use for the tunnel |

*Not required for SQLite, which takes a file path instead.

### SQLite

For SQLite, provide the absolute path to the `.db` or `.sqlite` file using the file picker. There is no host, port, or authentication.

### Testing before saving

Click **Test** before saving. Tabularis makes a real connection attempt and returns the exact database error if it fails (e.g., `FATAL: password authentication failed for user "admin"`). The test goes through the SSH tunnel if one is configured.

## SSH Tunnel System

![SSH Connections](/img/tabularis-ssh-tunneling.png)

Tabularis has a full SSH tunneling implementation in Rust with two backends, selected automatically based on your auth method.

### Two backends

**russh (Native Rust SSH)**
Used when a password is provided for the SSH connection. The tunnel is established entirely within the Rust process — no external `ssh` binary is involved. Host keys are checked against your `~/.ssh/known_hosts` (trust-on-first-use for unknown hosts; key-changed errors are surfaced as a hard failure).

**System SSH**
Used when no password is provided (key-only authentication). Tabularis spawns your system's `ssh` binary and parses your `~/.ssh/config`, which means `ProxyJump` chains, `IdentityFile` directives, and all other `~/.ssh/config` features work automatically.

### Dynamic port assignment

When a tunneled connection opens, Tabularis asks the OS for a free ephemeral port on `127.0.0.1`, establishes the SSH tunnel to that port, then points the database driver at `127.0.0.1:<ephemeral_port>`. You never need to pick a local port manually.

### SSH profiles

SSH connections are stored as separate reusable profiles (`ssh_connections.json`). A single SSH profile (e.g., your production bastion) can be reused across multiple database connections. Manage SSH profiles via **Settings → SSH Connections** or the `SshConnectionsModal`.

| SSH field | Description |
| :--- | :--- |
| **Host** | Bastion hostname or IP |
| **Port** | Default `22` |
| **User** | Your user on the bastion host |
| **Auth type** | `password` or `ssh_key` — determines which fields are shown in the UI |
| **Password** | SSH password (uses Russh backend when set) |
| **Key file** | Path to private key (for `ssh_key` auth; uses System SSH backend when no password) |
| **Key passphrase** | Stored in OS keychain if "Save in keychain" is checked |

### ProxyJump / multi-hop example

Define the chain in `~/.ssh/config` and use the System SSH backend:

```
Host bastion
    HostName bastion.example.com
    User ec2-user
    IdentityFile ~/.ssh/prod.pem

Host db-host
    HostName 10.0.1.50
    User ubuntu
    ProxyJump bastion
```

Set the SSH profile host to `db-host`, auth type to `ssh_key`, and leave the password field empty. With no password provided, Tabularis uses the System SSH backend, which delegates to `ssh` and resolves the chain automatically.

## Connection Actions

Right-click any connection in the sidebar for:

- **Edit** — modify any field, including switching the SSH profile
- **Duplicate** — clone the profile with a new name and ID
- **Delete** — removes the profile from `connections.json` and the associated keychain entry
- **Disconnect** — closes the active connection pool and SSH tunnel without deleting the profile

## Connection Groups

Connections can be organized into collapsible folder groups in the sidebar. Right-click on the connection list background and select **New Group**. Drag connections between groups by grabbing them in the sidebar.

## Multi-Database Support (MySQL / MariaDB)

MySQL and MariaDB allow a single connection to read and write across multiple databases on the same server. Tabularis exposes this natively: when creating or editing a MySQL connection, open the **Databases** tab and click **Load Databases** to fetch every database visible to your user. Check the ones you want and save.

Each selected database appears as its own collapsible node in the Explorer sidebar. Expand a node to see its tables and views. Double-click a table to open it in the editor.

Cross-database references use fully qualified names (`database_name.table_name`) automatically, so MySQL resolves them correctly regardless of which database the connection was initially opened against.

The connection format accepts either a plain string (`"mydb"`) or an array (`["db1", "db2", "db3"]`). Existing single-database connections continue to work without any changes.

This feature applies only to drivers that support cross-database access from a single connection. SQLite (file-based) and PostgreSQL (schema-based) are unaffected.

## Multi-Schema Support (PostgreSQL)

When connected to PostgreSQL, Tabularis loads all schemas by default. To control which schemas appear in the sidebar for a given connection, use the schema selector in the sidebar header. Your selection is persisted per connection in `config.json` under `selectedSchemas`.

The schema preference (which schema is "active" for DDL operations like `CREATE TABLE`) is also persisted per connection under `schemaPreferences`.

## Read-Only Mode

Toggle **Read-Only** on a connection to block DML and DDL statements at the application layer. Tabularis parses the SQL AST before execution and refuses to run `INSERT`, `UPDATE`, `DELETE`, `DROP`, `TRUNCATE`, `CREATE`, or `ALTER` statements. This is a client-side guard — not a substitute for proper database-level permissions.

## Keychain Details

The keychain service names used by Tabularis follow these patterns:

| Secret type | Keychain service key |
| :--- | :--- |
| DB password | `tabularis-connection-<uuid>` |
| SSH password | `tabularis-ssh-<uuid>` |
| SSH key passphrase | `tabularis-ssh-passphrase-<uuid>` |
| AI API key | `tabularis-ai-<provider>` |

On macOS you can inspect an entry manually:
```bash
security find-generic-password -s "tabularis-connection-<uuid>" -w
```

On Linux with `secret-tool`:
```bash
secret-tool lookup service tabularis-connection-<uuid>
```
