---
name: oracle
description: Use the @steipete/oracle CLI to bundle a prompt plus the right files and get a second-model review (API or browser) for debugging, refactors, design checks, or cross-validation.
---

# Oracle — Second-Model Review via CLI

One-shot LLM queries with full file context. Use when you need a second opinion from a different model, cross-validation across providers, or a fresh perspective on a problem.

Oracle is stateless — every run gets the full context (project briefing + files + question). It cannot see your project unless you pass `--file`.

## When to Use

- Stuck or looping on a problem → get a different model's take
- Code review or refactor validation → multi-model cross-check
- Architecture decision → compare reasoning across providers
- Debugging → fresh eyes with full file context

## Examples

### 1. Second opinion (single model)

```bash
oracle -p "I'm stuck on [problem]. I've tried [approach]. What am I missing?" \
  --file src/relevant.ts --file src/related.ts
```

### 2. Multi-model cross-validation

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

### 3. Complex prompt from file

When the prompt needs structure, code blocks, or multi-line content:

```bash
oracle -P prompt.md --file "src/**/*.ts"
```

### 4. Dry run (check token budget before calling API)

```bash
oracle --dry-run -p "Review auth flow" --file "src/auth/**"
```

## Key Flags

| Flag | Purpose |
|------|---------|
| `-p "text"` | Inline prompt |
| `-P path` | Read prompt from file (avoids shell escaping) |
| `-f / --file <globs>` | Files/dirs to attach (required for context) |
| `-m model` | Single model override |
| `--models "a,b"` | Parallel multi-model query |
| `--dry-run` | Preview token usage without calling API |
| `--write-output path` | Save response to file |

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
