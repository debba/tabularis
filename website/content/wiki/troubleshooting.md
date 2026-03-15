---
title: "Troubleshooting & FAQ"
order: 15
excerpt: "Solutions to common problems — connection errors, SSH failures, performance tips, and more."
category: "Reference"
---

# Troubleshooting & FAQ

This page covers the most common issues users encounter and how to resolve them.

## Connection Problems

### "Connection refused" or timeout

- **Check the host and port.** Ensure the database server is running and accepting connections on the configured port. Use `telnet <host> <port>` or `nc -zv <host> <port>` from a terminal to verify network reachability.
- **Firewall rules.** Cloud databases (AWS RDS, GCP Cloud SQL, Azure) often restrict inbound connections to specific IP ranges or VPCs. Verify your IP is allowlisted.
- **SSL/TLS requirements.** Some servers require encrypted connections. Check if your provider mandates `sslmode=require` or similar.

### "Authentication failed"

- Double-check username and password. Passwords are stored in the OS keychain — if the keychain entry was deleted externally, re-enter the password in the connection editor and save.
- For PostgreSQL, verify `pg_hba.conf` allows your auth method (usually `md5` or `scram-sha-256`).
- For MySQL, ensure the user has `GRANT` privileges for the target host (e.g., `'user'@'%'` vs. `'user'@'localhost'`).

### "Too many connections"

Your database server has a connection limit. Tabularis uses a single connection per profile. Close unused connections from the sidebar (right-click → **Disconnect**) or increase the server's `max_connections` setting.

### SQLite: "database is locked"

SQLite allows only one writer at a time. If another process (or another Tabularis tab) holds a write lock, you will see this error. Close the other writer or enable WAL mode (`PRAGMA journal_mode=WAL;`) for better concurrency.

## SSH Tunnel Problems

### "Host key verification failed"

Tabularis checks `~/.ssh/known_hosts`. If the server's host key changed (e.g., after a rebuild), remove the old entry:

```bash
ssh-keygen -R <hostname>
```

Then reconnect — Tabularis will trust the new key on first use.

### "Permission denied (publickey)"

- Verify the private key path is correct in the SSH profile.
- Check file permissions: `chmod 600 ~/.ssh/id_rsa`.
- If using a passphrase-protected key, ensure the passphrase is entered (or saved in keychain).
- For key-only auth (no password), Tabularis uses the system `ssh` binary. Test manually: `ssh -i <key_file> <user>@<host>` to see the exact error.

### Tunnel connects but queries time out

The SSH tunnel is up but the database is unreachable from the bastion. Verify the **remote host** and **remote port** in the connection settings point to a host the bastion can reach. SSH into the bastion manually and test: `nc -zv <db_host> <db_port>`.

## AI Assistant Problems

### "API key invalid" or "401 Unauthorized"

- Re-enter your API key in **Settings → AI**. Keys are stored in the OS keychain.
- For OpenRouter, ensure your account has credits.
- For Ollama, no API key is needed — verify the service is running: `curl http://localhost:11434/api/tags`.

### AI generates incorrect column names

Ensure Tabularis has loaded your schema. Connect to the database and expand at least one table in the sidebar before asking the AI. The schema snapshot is built from cached metadata — if the cache is empty, the AI has no context.

## Performance

### Data Grid is slow with wide tables

Tables with 50+ columns can slow down rendering. Use the column visibility menu (right-click a column header) to hide columns you do not need. Reducing `resultPageSize` in [Configuration](/wiki/configuration) also helps.

### Editor autocomplete is delayed

Autocomplete loads table and column metadata on first trigger. For databases with thousands of tables, the initial load can take a few seconds. Subsequent completions are instant because the metadata is cached.

## Logs & Debugging

Tabularis captures application logs internally. Access them from **Settings → Logs**.

| Action | How |
| :--- | :--- |
| **View logs** | Settings → Logs tab |
| **Export logs** | Click **Export** in the Logs tab to save to a file |
| **Clear logs** | Click **Clear** to reset the log buffer |

When reporting a bug, export the logs and attach them to your issue on [GitHub](https://github.com/debba/tabularis/issues).

## FAQ

### Where are my connections stored?

Connection profiles (non-sensitive fields) are in `connections.json` inside the app config directory. Passwords and secrets are in your OS keychain. See [Security & Credentials](/wiki/security-credentials) for details.

### Can I use Tabularis with a read-only database user?

Yes. Enable **Read-Only Mode** on the connection profile to add a client-side guard. Tabularis will parse your SQL and block any DML/DDL statements before they reach the server.

### How do I reset Tabularis to default settings?

Delete the app config directory:

- **Linux**: `~/.config/dev.tabularis.app`
- **macOS**: `~/Library/Application Support/dev.tabularis.app`
- **Windows**: `%APPDATA%\dev.tabularis.app`

Restart Tabularis. A fresh configuration will be created.

### Does Tabularis send telemetry?

Tabularis includes optional Matomo analytics that can be controlled via the cookie consent banner. No database content or query data is ever transmitted.
