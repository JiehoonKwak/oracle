---
name: oracle
description: "USE WHEN stuck in a loop, need a second opinion, user says 'ask another model', 'cross-check', 'second opinion', 'other AI'. One-shot multi-model LLM review. NOT for web search (use better-search) or deep research (use deep-research)."
---

# Oracle — Second-Model Review via CLI

One-shot LLM queries with full file context. Use when you need a second opinion from a different model, cross-validation across providers, or a fresh perspective on a problem.

Oracle is stateless — every run gets the full context (project briefing + files + question). It cannot see your project unless you pass `--file`.

`oracle --help` for usage

## Examples

### 1. Second Opinion

Config defaults apply automatically when no `--model`/`--models` on CLI:

```bash
# Uses config.models (e.g. gemini + grok in parallel)
oracle -p "Review this approach and flag any issues" \
  --file "src/**/*.ts"
```

Override for a specific run:

```bash
oracle --models "google/gemini-3.1-pro-preview,x-ai/grok-4.1-fast" \
  -p "Cross-check assumptions in data layer" --file "src/**/*.ts"
```

### 2. Complex prompt from file

When the prompt needs structure, code blocks, or multi-line content:

```bash
oracle -P prompt.md --file "src/**/*.ts"
```

## Key Flags

| Flag                  | Purpose                                       |
| --------------------- | --------------------------------------------- |
| `-p "text"`           | Inline prompt                                 |
| `-P path`             | Read prompt from file (avoids shell escaping) |
| `-f / --file <globs>` | Files/dirs to attach (required for context)   |
| `-m model`            | Single model override                         |
| `--models "a,b"`      | Parallel multi-model query                    |
| `--dry-run`           | Preview token usage without calling API       |
| `--write-output path` | Save response to file                         |

## Prompt Crafting

Oracle is one-shot with no memory. Every prompt must be self-contained:

1. **Project context**: what the project does, tech stack
2. **Relevant files**: attach via `--file` (directories and globs work)
3. **Specific question**: what you need reviewed, what you've tried
4. **Constraints**: deadlines, dependencies, architecture limits

Aim for 6–30 sentences in the prompt. Brief prompts yield generic answers.

## Model Priority

`CLI --models` > `CLI --model` > `config.models` > default model.

Use `google/` or `x-ai/` prefixed IDs for exact model versions routed to native APIs.
