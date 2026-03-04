# Oracle Codebase Audit & Cleanup Plan

## Context

Oracle is a multi-model LLM CLI (forked from steipete/oracle) that bundles prompt + files into API requests. Model metadata, aliases, pricing, and provider routing are all **hardcoded across 6+ files**, making maintenance fragile. This plan addresses hardcoded values, dead code, redundancy, inconsistencies, README gaps, and SKILL.md quality.

---

## 1. Hardcoded Model Registry (CRITICAL)

**Problem**: Model names, API IDs, pricing, input limits, and aliases are scattered across multiple files. Adding a single new model requires touching 4-6 files.

| File | What's hardcoded |
|------|-----------------|
| `src/oracle/config.ts:13-148` | `MODEL_CONFIGS` — 11 models with pricing, limits, tokenizers |
| `src/cli/options.ts:179-226` | `resolveApiModel()` — 30+ substring matching rules |
| `src/cli/options.ts:228-292` | `inferModelFromLabel()` — DUPLICATE of above with different logic |
| `src/oracle/gemini.ts:18-30` | `MODEL_ID_MAP` — maps ALL models (not just Gemini!) |
| `src/oracle/claude.ts:140-150` | `resolveClaudeModelId()` — 2 hardcoded version aliases |
| `src/oracle/providerResolver.ts:3-10` | `resolveProvider()` — string prefix detection |
| `src/oracle/config.ts:8` | `PRO_MODELS` — separate set of "pro" model names |

**Fix**: Create `models.json` shipped with the package. Users can override via `~/.oracle/models.json`. `config.json` stays for user preferences only (default model, search, heartbeat, etc.).

```jsonc
// models.json (shipped with package)
{
  "gpt-5.1-pro": {
    "apiModel": "gpt-5.2-pro",
    "provider": "openai",
    "aliases": ["5.1-pro", "5.1 pro"],
    "inputLimit": 196000,
    "pricing": { "input": 21, "output": 168 },  // per 1M tokens
    "pro": true,
    "reasoning": { "effort": "high" }
  }
}
// ~/.oracle/models.json merges on top (user overrides/additions)
```

At startup: load bundled `models.json` → deep-merge `~/.oracle/models.json` → derive `resolveApiModel`, `resolveProvider`, model ID maps from the merged registry.

**Files to modify**: `src/oracle/config.ts`, `src/cli/options.ts`, `src/oracle/gemini.ts`, `src/oracle/claude.ts`, `src/oracle/providerResolver.ts`, `src/oracle/types.ts`

---

## 2. Dead Code

| Item | Location | Evidence |
|------|----------|---------|
| `resolveEngineWithConfig()` | `src/cli/runOptions.ts:90-96` | Never called. Params are `_args` (underscore = ignored). |
| `EngineMode` type | `src/cli/runOptions.ts:9` + `bin/oracle-cli.ts:128` | Only value is `"api"`. Three assignments all hardcode `"api"`. Leftover from removed "browser" engine. |

**Fix**: Delete `resolveEngineWithConfig()`. Remove `EngineMode` type and replace all usages with literal `"api"` or remove the field entirely from interfaces if it adds no value.

---

## 3. Redundancy / DRY Violations

### 3a. `resolveApiModel()` vs `inferModelFromLabel()` — CRITICAL

Both live in `src/cli/options.ts` (lines 179-226 and 228-292). Nearly identical substring matching logic, but **different behavior**:

| Difference | `resolveApiModel` | `inferModelFromLabel` |
|------------|--------------------|-----------------------|
| Empty input | Returns empty as ModelName | Returns `DEFAULT_MODEL` |
| `"classic"` | No match | → `gpt-5-pro` |
| `"thinking"` | No match | → `gpt-5.2-thinking` |
| `"instant"/"fast"` | No match | → `gpt-5.2-instant` |
| Fallback | Passthrough as ModelName | → `gpt-5.2` |

**Fix**: Merge into single function with options parameter (`{ fallbackToDefault?: boolean }`), or extract shared alias table and resolution logic.

### 3b. OpenRouter prefix stripping — 4x duplication

Same pattern `model.includes("/") ? model.split("/").slice(1).join("/") : model` in:
1. `src/oracle/providerResolver.ts:4`
2. `src/oracle/gemini.ts:34`
3. `src/oracle/claude.ts:142`
4. `src/cli/runOptions.ts:100`

**Fix**: Extract to shared utility:
```typescript
// src/oracle/modelUtils.ts
export function stripProviderPrefix(model: string): string {
  return model.includes("/") ? model.split("/").slice(1).join("/") : model;
}
```

### 3c. Unnecessary variable alias

`src/cli/runOptions.ts:43-44`:
```typescript
const inferredModel = resolveApiModel(cliModelArg);
const resolvedModel = inferredModel;  // ← pointless alias
```

**Fix**: Use single variable: `const resolvedModel = resolveApiModel(cliModelArg);`

---

## 4. Inconsistencies & Bugs

### 4a. `MODEL_ID_MAP` in gemini.ts contains non-Gemini models (BUG)

`src/oracle/gemini.ts:18-30` maps ALL 11 models (gpt-*, claude-*, grok-*) despite being Gemini-specific. Non-Gemini models map to themselves (identity mapping), which is harmless but misleading and a maintenance burden.

**Fix**: Keep only `"gemini-3-pro": "gemini-3-pro-preview"` entry. The fallback `?? bare` already handles unknown models.

### 4b. Claude `max_tokens: 2048` hardcoded (BUG)

`src/oracle/claude.ts:37` hardcodes `max_tokens: 2048` regardless of what's configured. Other providers respect `body.max_output_tokens` from the config. This silently limits Claude responses to ~1500 words.

**Fix**: Use `body.max_output_tokens` or a sensible default from `ModelConfig`.

### 4c. Claude "stream" doesn't actually stream

`src/oracle/claude.ts:97`: `stream: false` is passed even in the `stream()` method. The function fakes streaming by yielding the entire response as one chunk.

**Fix**: Implement real SSE streaming for Claude, or rename/document that it's non-streaming.

### 4d. Claude uses raw `fetch()` while others use SDKs

Gemini uses `@google/genai` SDK, OpenAI uses `openai` SDK, but Claude uses manual `fetch()` with hand-built headers. This means:
- No automatic retry/backoff
- No streaming support
- Manual header management
- Missing features (tool use, multi-turn, etc.)

**Fix**: Consider using `@anthropic-ai/sdk` for consistency (already have `@anthropic-ai/tokenizer` as dependency).

### 4e. Dual source of truth for provider

`ModelConfig.provider` field exists on each model config, AND `resolveProvider()` infers provider from model name prefix. These could diverge.

**Fix**: Use `ModelConfig.provider` as authoritative. `resolveProvider()` should check `MODEL_CONFIGS` first, fall back to prefix matching only for unknown models.

### 4f. `engineCoercedToApi` in return type but never set

`ResolvedRunOptions.engineCoercedToApi` is declared optional but never assigned in `resolveRunOptionsFromConfig()`.

**Fix**: Remove field from interface if unused.

---

## 5. README.md Gaps

**File**: `README.md`

| Gap | Detail |
|-----|--------|
| Undocumented CLI flags | `--dry-run`, `--render-markdown`, `--files-report`, `--timeout`, `--background`, `--heartbeat`, `--force`, `--max-input`, `--max-output`, `--base-url`, `--write-output` |
| Session commands incomplete | Missing `--hide-prompt`, `--model`, `--all`, `--limit` options |
| Config fields incomplete | Missing `promptSuffix`, `background`, `filesReport`, `apiBaseUrl`, `sessionRetentionHours`, `notify` |
| Default model unclear | "default model" not specified (is `google/gemini-3.1-pro-preview`) |
| License section | Says "Full credit to steipete/oracle" but doesn't specify actual license |

**Fix**: Add "CLI Reference" section with complete flag table. Update config example. Clarify default model. Add proper license reference.

---

## 6. SKILL.md Enhancement

**File**: `skills/oracle/SKILL.md`

### Current description (doesn't follow CSO format):
```
Use when falling into rabbit hole, stuck/loop on a problem, user says "second opinion", "ask other AI". CLI to bundle a prompt plus the right files and get a second-model review via API.
```

### Issues per skill-manager improve workflow:
1. Missing `USE WHEN` prefix
2. Missing `NOT for` boundary
3. Includes how-it-works ("CLI to bundle...") — should be trigger-only
4. "falling into rabbit hole" is vague internal jargon

### Proposed description:
```
USE WHEN stuck in a loop, need a second opinion, user says 'ask another model', 'cross-check', 'second opinion', 'other AI'. One-shot multi-model LLM review. NOT for web search (use better-search) or deep research (use deep-research).
```

### Body improvements:
- Remove "Prompt Crafting" section (generic advice Claude already knows, not skill-specific)
- Add proactive trigger guidance: when to auto-invoke vs wait for user request
- Keep Examples and Key Flags (actionable)
- This is a distribution skill (`skills/oracle/SKILL.md`), so ensure portability (no absolute paths)

---

## Implementation Order

1. **Extract `stripProviderPrefix()` utility** — unblocks other changes
2. **Clean dead code** — `resolveEngineWithConfig()`, `EngineMode` simplification, `engineCoercedToApi`
3. **Fix bugs** — Claude `max_tokens`, `MODEL_ID_MAP` non-Gemini entries, variable alias
4. **Merge `resolveApiModel`/`inferModelFromLabel`** — DRY violation
5. **Create `models.json` registry** — externalize model configs, derive aliases/pricing/providers
6. **Update provider resolution** — use `ModelConfig.provider` as source of truth
7. **Update README.md** — complete flag docs, config fields, default model
8. **Enhance SKILL.md** — CSO-format description, trim body
9. **Cleanup audit** — run `knip` to catch any remaining dead exports/imports

## Verification

- `npm test` — all existing tests pass
- `npm run build` — clean compilation
- `npx knip` — no dead code flagged
- Manual: `oracle --help` output matches README
- Manual: `oracle -p "test" --dry-run` works with new registry

