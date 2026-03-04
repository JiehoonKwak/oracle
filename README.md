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

## Config

Put defaults in `~/.oracle/config.json` (JSON5 supported):

```json5
{
  // one model → single-model mode; multiple → parallel multi-model
  models: ["google/gemini-3.1-pro-preview", "x-ai/grok-4.1-fast"],
  // OpenRouter fallback URL (used when native API key unavailable)
  base_url: "https://openrouter.ai/api/v1",
  // search: "off",
  // heartbeatSeconds: 30,
}
```

Priority: CLI `--models` > CLI `--model` > `config.models` > default model.

Use `google/` or `x-ai/` prefixed model IDs to preserve exact versions and route to native APIs. Bare names (e.g. `gemini-3.1-pro-preview`) also work but get normalized to the closest known model.

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
oracle status --hours 72

# Replay a session
oracle session <id> --render

# Prune old sessions
oracle status --clear --hours 168
```

Session logs live in `~/.oracle/sessions` (override with `ORACLE_HOME_DIR`).

## License

Full credit to [steipete/oracle](https://github.com/steipete/oracle)
