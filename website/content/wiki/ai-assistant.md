---
title: "AI Assistant"
order: 7
excerpt: "Use AI to generate SQL from natural language and explain complex queries."
---

# AI Assistant & Context Engine

Tabularis integrates a powerful, privacy-first AI assistant directly into the SQL Editor. It goes beyond simple autocomplete by deeply understanding your database structure to generate accurate, syntactically correct queries.

## How Context Injection Works

A common failure of generic AI tools (like ChatGPT) is hallucinating column names. Tabularis solves this via **Schema Snapshots**.

When you ask the AI to "Find users who ordered in the last 30 days", Tabularis intercepts the request and builds a condensed, token-optimized snapshot of your current database structure.

**Example Snapshot injected into the system prompt:**
```text
=== DATABASE SCHEMA ===
Engine: PostgreSQL 15
Table: users (id: uuid, username: varchar, created_at: timestamptz)
Table: orders (id: uuid, user_id: uuid, total: numeric, status: varchar)
FK: orders.user_id -> users.id
```
By feeding this exact structural context to the LLM alongside your natural language prompt, the AI knows exactly which `JOIN` clauses to write and which data types it is dealing with.

## Supported Providers & Local Privacy

Tabularis is provider-agnostic. Configure your preferred engine in Settings:

### 1. Cloud Providers
- **OpenAI**: Supports `gpt-4o` and `gpt-4-turbo`. Requires your own API Key.
- **Anthropic**: Supports Claude 3.5 Sonnet and Haiku. Excellent for complex query explanations.
- **OpenRouter**: Access hundreds of models via a unified API.

### 2. Local Execution (Zero-Knowledge Privacy)
For enterprise databases with strict compliance requirements, you cannot send schema data to third-party servers. Tabularis natively integrates with **Ollama**.
1. Install [Ollama](https://ollama.com/) on your machine.
2. Pull a coding model: `ollama run codellama` or `ollama run llama3`.
3. In Tabularis Settings, set the provider to **Ollama** and point it to `http://localhost:11434`.
**Result**: Powerful AI assistance with a guarantee that zero bytes of data ever leave your network.

## Explain & Optimize Queries

The AI isn't just for writing new code. Highlight any complex, legacy 300-line SQL query, right-click, and select **"Explain Query with AI"**. 
The AI will break down the nested subqueries, explain the logic in plain English, and even suggest optimizations (like adding missing indexes based on the `WHERE` clauses).

## Model Context Protocol (MCP)

Tabularis ships with a built-in **MCP Server**, allowing external AI agents (like Claude Desktop or Cursor) to securely interface with your Tabularis connections.
- Enable the MCP server in Settings.
- Connect your external agent to the local endpoint.
- The agent can now request schema reads and execute specific queries against your local databases, turning Tabularis into a powerful bridge for AI workflows.
