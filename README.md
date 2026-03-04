# oracle — Multi-model LLM CLI

> Forked from https://github.com/steipete/oracle

Bundles prompt + files into a single request for any LLM API. Native support for Gemini, Grok, Claude, OpenAI; falls back to OpenRouter for everything else.

## Quick start

```bash
npm install -g github:jiehoonk/oracle
```

Requires Node 22+.

Set API keys (native providers take priority over OpenRouter):

```bash
export GEMINI_API_KEY=...        # Google Gemini (native)
export XAI_API_KEY=...           # xAI Grok (native)
export ANTHROPIC_API_KEY=...     # Anthropic Claude (native)
export OPENAI_API_KEY=...        # OpenAI (native)
export OPENROUTER_API_KEY=sk-or-...  # fallback for any model
```

Run:

```bash
oracle -p "Summarize this codebase" --file "src/**/*.ts"
```

The default model is `google/gemini-3.1-pro-preview`.

## Multi-model

Query multiple models in parallel:

```bash
oracle --models "google/gemini-3.1-pro-preview,x-ai/grok-4.1-fast" \
  -p "Cross-check the data layer assumptions" --file "src/**/*.ts"
```

## Prompt from file

For complex prompts (avoids shell escaping):

```bash
oracle -P prompt.md --file "src/**/*.ts"
```

## CLI Reference

### Prompt & files

| Flag | Description |
|------|-------------|
| `-p, --prompt <text>` | User prompt to send to the model |
| `-P, --prompt-file <path>` | Read prompt from a file |
| `-f, --file <paths...>` | Files/directories/globs to attach (prefix `!pattern` to exclude) |
| `-s, --slug <words>` | Custom session slug (3-5 words) |

### Model selection

| Flag | Description |
|------|-------------|
| `-m, --model <model>` | Model to target (default `google/gemini-3.1-pro-preview`) |
| `--models <models>` | Comma-separated list for parallel multi-model queries |

Priority: CLI `--models` > CLI `--model` > `config.models` > default model.

Use `google/` or `x-ai/` prefixed model IDs to preserve exact versions and route to native APIs. Bare names (e.g. `gemini-3.1-pro-preview`) also work but get normalized to the closest known model.

### Output & preview

| Flag | Description |
|------|-------------|
| `--dry-run [mode]` | Preview without calling the model (`summary` \| `json` \| `full`) |
| `--render-markdown` | Print assembled markdown bundle and exit |
| `--render-plain` | Render without ANSI highlighting |
| `--files-report` | Show token usage per attached file |
| `--write-output <path>` | Save response to file (multi-model appends `.<model>` before extension) |
| `-v, --verbose` | Enable verbose logging |

### Timeouts & execution

| Flag | Description |
|------|-------------|
| `--timeout <seconds\|auto>` | Overall timeout (`auto` = 60m for pro models, 120s otherwise) |
| `--background` / `--no-background` | Use Responses API background mode |
| `--heartbeat <seconds>` | Periodic progress updates (0 to disable, default 30) |
| `--force` | Force new session even if identical prompt running |
| `--wait` / `--no-wait` | Block until completion or detach immediately |
| `--http-timeout <duration>` | HTTP client timeout (default 20m; accepts `30m`, `10s`, `2h`) |

### Token limits

| Flag | Description |
|------|-------------|
| `--max-input <tokens>` | Override input token budget |
| `--max-output <tokens>` | Override max output tokens |

### Notifications

| Flag | Description |
|------|-------------|
| `--notify` / `--no-notify` | Desktop notifications (default on unless CI/SSH) |
| `--notify-sound` / `--no-notify-sound` | Notification sounds |

### API & Azure

| Flag | Description |
|------|-------------|
| `--base-url <url>` | Override API base URL (e.g. LiteLLM proxy) |
| `--azure-endpoint <url>` | Azure OpenAI endpoint |
| `--azure-deployment <name>` | Azure OpenAI deployment name |
| `--azure-api-version <version>` | Azure OpenAI API version |

## Config

Put defaults in `~/.oracle/config.json` (JSON5 supported):

```json5
{
  // one model -> single-model mode; multiple -> parallel multi-model
  models: ["google/gemini-3.1-pro-preview", "x-ai/grok-4.1-fast"],
  // OpenRouter fallback URL (used when native API key unavailable)
  base_url: "https://openrouter.ai/api/v1",

  // Text appended to every prompt
  // promptSuffix: "Answer concisely.",

  // Override base URL for API calls (e.g. LiteLLM proxy)
  // apiBaseUrl: "https://proxy.example.com/v1",

  // Default background mode for Responses API
  // background: false,

  // Auto-show token usage per file
  // filesReport: false,

  // Auto-prune sessions older than N hours
  // sessionRetentionHours: 168,

  // Heartbeat interval in seconds (0 to disable)
  // heartbeatSeconds: 30,

  // search: "off",

  // Notification settings
  // notify: { enabled: true, sound: false, muteIn: ["CI", "SSH"] },

  // Azure OpenAI config
  // azure: { endpoint: "https://resource.openai.azure.com/", deployment: "my-deploy", apiVersion: "2024-02-01" },
}
```

## Container install

```dockerfile
RUN npm install -g github:jiehoonk/oracle
```

The `prepare` script auto-builds on install.

```bash
docker run -e OPENROUTER_API_KEY=sk-or-... my-image \
  oracle -p "hello" --file src/main.ts
```

Mount config for persistent sessions:

```bash
docker run -v ~/.oracle:/root/.oracle my-image oracle -p "hello"
```

## Sessions

```bash
# List recent sessions
oracle session --hours 72

# List all sessions regardless of age
oracle session --all

# Filter by model
oracle session --model google/gemini-3.1-pro-preview

# Limit results
oracle session --limit 50

# Replay a session (renders markdown in TTY)
oracle session <id> --render

# Replay without the stored prompt
oracle session <id> --hide-prompt

# Prune old sessions
oracle session --clear --hours 168
```

Session logs live in `~/.oracle/sessions` (override with `ORACLE_HOME_DIR`).

## License

MIT. Full credit to [steipete/oracle](https://github.com/steipete/oracle).
