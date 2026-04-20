---
title: "AI Assistant"
order: 7
excerpt: "Use AI to generate SQL from natural language and explain complex queries."
category: "AI & Integration"
---

# AI Assistant & Context Engine

Tabularis integrates a privacy-first AI assistant directly into the SQL Editor and notebooks. It goes beyond simple autocomplete by understanding your database structure to generate, explain, and label queries.

<video src="/videos/wiki/09-ai-assistant.mp4" controls muted playsinline loop autoplay controlsList="nodownload noremoteplayback noplaybackrate" disablePictureInPicture></video>

![AI Assistant](/img/tabularis-ai-assistant.png)

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
- **OpenAI** (`openai`): Uses your own API key and supports the model list shipped by the app plus any custom model entries you add.
- **Anthropic** (`anthropic`): Good for complex query explanations and structured reasoning.
- **MiniMax** (`minimax`): Available as a first-class provider in the AI settings.
- **OpenRouter** (`openrouter`): Access a broader multi-model catalog through a unified API.
- **Custom OpenAI-compatible** (`custom-openai`): Any endpoint that speaks the OpenAI API (e.g. LM Studio, vLLM, Groq-compatible gateways). Set `aiCustomOpenaiUrl` and choose a model in Settings.

### 2. Local Execution (Zero-Knowledge Privacy)
For enterprise databases with strict compliance requirements, you cannot send schema data to third-party servers. Tabularis natively integrates with **Ollama**.
1. Install [Ollama](https://ollama.com/) on your machine.
2. Pull a coding model: `ollama pull codellama` or `ollama pull llama3`.
3. In Tabularis Settings, set the provider to **Ollama**. The default port is `11434`; change it via `aiOllamaPort` if needed.
**Result**: Powerful AI assistance with a guarantee that zero bytes of data ever leave your network.

## Explain & Optimize Queries

The AI is not limited to generating SQL. From the editor you can ask it to explain the current query, and the explanation prompt is configurable in Settings. The assistant breaks down joins, subqueries, and filters in plain language and can suggest likely optimization directions.

## Notebook Cell Naming

In [SQL Notebooks](/wiki/notebooks), the AI can generate descriptive names for cells based on their content:

- **Single cell**: Click the AI icon on any cell header to generate a name for that cell.
- **Batch naming**: Click **Name All** in the notebook toolbar to generate names for all unnamed cells at once.

The naming prompt is customizable in **Settings > AI > Notebook Cell Name Prompt**. The cell content (SQL or Markdown) is sent as the user message alongside the prompt.

## Query Tab Naming

Tabularis can also generate short names for SQL result tabs. In multi-result views, the AI uses the current SQL text and a dedicated **Query Tab Name Prompt** from Settings to propose a concise label.

## Custom Prompts

The AI settings currently expose four editable prompts:

- **System Prompt** for SQL generation
- **Explain Prompt** for query explanations
- **Notebook Cell Name Prompt**
- **Query Tab Name Prompt**

## Model Context Protocol (MCP)

Tabularis ships with a built-in **MCP Server**, allowing external AI agents like Claude Desktop, Claude Code, Cursor, Windsurf, or Antigravity to interface with your saved connections over stdio.

- Open the MCP integration panel from the sidebar or Settings.
- Install the config for your target client.
- The agent can then list saved connections, inspect schemas and tables, and execute SQL through the Tabularis MCP server.
