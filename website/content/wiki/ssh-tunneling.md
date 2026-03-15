---
title: "SSH Tunneling"
order: 2.5
excerpt: "Connect to remote databases through SSH tunnels with password or key-based authentication."
category: "Security & Networking"
---

# SSH Tunneling

Tabularis includes a full SSH tunneling implementation written in Rust. It supports both password and key-based authentication, multi-hop proxy chains, and automatic dynamic port assignment. No external tools are required — everything runs inside the application process.

## How It Works

When a database connection has SSH enabled, Tabularis:

1. Opens an SSH session to the bastion host.
2. Requests the OS for a free ephemeral port on `127.0.0.1`.
3. Forwards traffic from `127.0.0.1:<local_port>` through the SSH tunnel to `<remote_db_host>:<remote_db_port>`.
4. Points the database driver at `127.0.0.1:<local_port>` instead of the remote host.

You never need to choose a local port — Tabularis handles it automatically.

## Two Backends

Tabularis selects the SSH backend automatically based on your authentication method.

### Russh (Native Rust SSH)

Used when a **password** is provided. The tunnel runs entirely within the Rust process — no external `ssh` binary is needed.

- Host key verification via `~/.ssh/known_hosts`.
- Trust-on-first-use for unknown hosts (the key is saved automatically).
- Hard failure if the host key has changed (possible MITM attack).
- 30-second authentication timeout.

### System SSH

Used when **no password** is provided (key-only authentication). Tabularis spawns your system's `ssh` binary, which means:

- Full `~/.ssh/config` support — `ProxyJump`, `IdentityFile`, `Host` aliases, and every other directive.
- Agent forwarding works if configured in your SSH config.
- `BatchMode=yes` is set so the process never hangs waiting for interactive input.
- `StrictHostKeyChecking=accept-new` — new hosts are accepted, changed keys are rejected.

## SSH Profiles

SSH connections are stored as reusable profiles in `ssh_connections.json`, separate from database connections. A single SSH profile (e.g., your production bastion) can be reused across multiple database connections.

Manage profiles from **Settings → SSH Connections** or the SSH Connections modal.

### Profile Fields

| Field | Description |
| :--- | :--- |
| **Name** | Display label |
| **Host** | Bastion hostname or IP |
| **Port** | Default `22` |
| **Username** | Your user on the bastion |
| **Auth type** | `password` or `ssh_key` |
| **Password** | SSH password (triggers Russh backend) |
| **Key file** | Path to private key (triggers System SSH backend when no password) |
| **Key passphrase** | Stored in OS keychain if "Save in keychain" is checked |

### Testing a Profile

Click **Test** before saving. Tabularis performs a real SSH handshake and reports success or the exact error message. The test uses the same backend that the connection will use.

## Linking SSH to a Database Connection

1. Open the connection editor (new or existing connection).
2. Check **SSH enabled**.
3. Select an SSH profile from the dropdown.
4. Save the connection.

When you connect, the tunnel is established first, then the database driver connects through it. If the tunnel fails, the exact SSH error is surfaced — no generic "connection refused" messages.

## Multi-Hop / ProxyJump

For databases behind multiple bastion layers, define the chain in `~/.ssh/config` and use the System SSH backend (key-only auth, no password):

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

Set the SSH profile host to `db-host`, auth type to `ssh_key`, and leave the password empty. Tabularis delegates to `ssh`, which resolves the chain automatically.

## Tunnel Lifecycle

- Tunnels are created when you **connect** and destroyed when you **disconnect**.
- Each connection gets its own tunnel — there is no sharing between connections, even if they use the same SSH profile.
- If the tunnel drops (network interruption), the database connection will fail on the next query. Disconnect and reconnect to re-establish the tunnel.

## Troubleshooting

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| "Host key verification failed" | Server key changed | `ssh-keygen -R <host>` then reconnect |
| "Permission denied (publickey)" | Wrong key or permissions | Check key path, `chmod 600` the key file |
| Tunnel up but queries time out | DB unreachable from bastion | SSH into bastion, test `nc -zv <db_host> <db_port>` |
| "Connection refused" on local port | Tunnel failed silently | Check SSH logs, verify bastion is reachable |

For more details, see [Troubleshooting & FAQ](/wiki/troubleshooting).
