---
title: "Connection Management"
order: 2
excerpt: "Learn how to manage your database connections securely with SSH tunneling and keychain integration."
---

# Connection Management

Tabularis provides a secure, intuitive, and highly robust way to manage your database connections, especially when dealing with production environments isolated within private networks.

## Secure Credentials & Keychain

Security is at the heart of Tabularis. We strictly avoid storing plain-text passwords or weakly encrypted secrets in configuration files. Instead, Tabularis interfaces directly with your OS's native secure enclave:
- **macOS**: Keychain Access
- **Windows**: Windows Credential Manager
- **Linux**: libsecret (GNOME Keyring / KWallet)

When you save a connection, the password is encrypted by the OS. Tabularis only requests decryption at the exact moment the connection is established. The identifier used in the keychain follows the format `connection-{uuid}`.

## Advanced SSH Tunneling Architecture

Connecting to databases inside private VPCs requires SSH tunneling. Tabularis handles this seamlessly without requiring external tools like DBeaver's SSH extensions or manual `ssh -L` commands.

### Dual-Backend Engine
The Rust backend dynamically selects between two SSH implementation strategies based on your configuration:

1. **System SSH (Recommended for complex setups)**: If you use an SSH agent or your `~/.ssh/config` defines complex Jump Hosts (ProxyJump), Tabularis delegates to your machine's native `ssh` binary. It parses the config and transparently establishes the tunnel.
2. **Russh (Native Rust)**: When using direct password authentication or specifying explicit `.pem`/`.pub` key files within the Tabularis UI, the app uses `russh`, a pure-Rust, high-performance async SSH2 implementation. This avoids spawning external processes and provides tighter error control.

### Dynamic Port Forwarding
You do not need to manually map local ports. When you open a tunneled connection:
1. Tabularis asks the OS for a free ephemeral port on `127.0.0.1` (e.g., `51342`).
2. It establishes the SSH tunnel, forwarding remote `localhost:5432` to the local ephemeral port.
3. The database driver is instructed to connect to `127.0.0.1:51342`.

### Tunnel Monitoring & Auto-Reconnect
- **Keep-Alive**: Tunnels send periodic keep-alive packets to prevent firewalls from dropping idle connections.
- **Self-Healing**: If a tunnel drops (e.g., due to Wi-Fi changes or sleep/wake cycles), the Rust monitoring task detects the broken pipe and automatically attempts to rebuild the tunnel and re-establish the database connection pool before your next query fails.

## Connection Organization

- **Color Coding**: Assign colors to connections (e.g., Red for Production, Green for Local) to visually distinguish them in the UI and editor tabs, preventing accidental execution of destructive queries on the wrong database.
- **Read-Only Mode**: Toggle "Read-Only" in the connection settings. Tabularis will intercept and block any DML/DDL statements (`INSERT`, `UPDATE`, `DELETE`, `DROP`) at the application layer before they reach the database driver.

## Multi-Schema Support

For databases like PostgreSQL, Tabularis supports multi-schema browsing. By default, it loads the `public` schema. In the connection profile, you can configure a list of schemas to include (allowlist) or exclude (blocklist), significantly speeding up introspection on massive databases with hundreds of schemas.
