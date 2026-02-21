# Reddit Promotion Post - Tabularis 200 Stars

## Recommended Subreddits (in order of priority)

1. **r/selfhosted** - Great fit: open-source desktop tool, technical audience that appreciates local-first software
2. **r/database** - Direct target audience: DBAs and developers working with databases daily
3. **r/programming** - Broad dev audience, good for visibility on open-source projects
4. **r/rust** - Tabularis backend is Rust/Tauri, the Rust community loves seeing real-world Rust apps
5. **r/opensource** - Dedicated to open-source projects, receptive to milestone posts like 200 stars

---

## Post

**Title:** Tabularis just hit 200 GitHub stars -- a lightweight, open-source database manager built with Rust and React

**Body:**

Hey everyone,

I'm the developer behind [Tabularis](https://github.com/debba/tabularis), an open-source database management tool built with Tauri (Rust) + React. It supports MySQL, PostgreSQL, and SQLite in a single, lightweight desktop app.

We just crossed **200 stars on GitHub** and the project is growing steadily, so I wanted to share some of the things we've been shipping recently:

**Recent highlights:**

- **Split View** -- work with multiple database connections side-by-side in resizable panels
- **Spatial data support** -- GEOMETRY handling for MySQL and PostgreSQL with WKB/WKT formatting
- **PostgreSQL multi-schema** -- browse and switch between schemas seamlessly
- **AI assist (optional)** -- supports OpenAI, Anthropic, Ollama (fully local), and any OpenAI-compatible API. It lives in a floating overlay in the editor so it's there when you need it, out of the way when you don't
- **Built-in MCP Server** -- run `tabularis --mcp` to expose your connections to external AI agents
- **Visual Query Builder** -- drag-and-drop tables, draw JOINs, get real-time SQL generation
- **SSH Tunneling** with automatic readiness detection

The app is **native** (not Electron), starts fast, and keeps all your data local. No accounts, no telemetry, no cloud dependency.

Available on Windows, macOS, and Linux. Apache 2.0 license.

Would love to hear your feedback or feature requests. We also have a [Discord](https://discord.gg/YrZPHAwMSG) if you want to chat.

GitHub: https://github.com/debba/tabularis
