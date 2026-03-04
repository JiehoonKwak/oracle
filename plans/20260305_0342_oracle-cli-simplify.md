# Oracle CLI Simplification Plan

## Context

Oracle is a forked multi-model LLM CLI with accumulated dead code from a removed browser engine, redundant provider paths, and duplicated model resolution logic. The goal is to simplify it to its core purpose: **a CLI that AI agents use to call LLMs via OpenRouter (primary) with Google Gemini and xAI Grok as direct fallbacks**. Direct Anthropic, Azure OpenAI, and raw OpenAI paths should be removed — these all route through OpenRouter.

## Skills to Use

- **`/simplify`** — after each phase, review changed code for reuse, quality, and efficiency
- **`/batch`** — Claude Code built-in batch command for parallel file processing during refactoring

---

## Phase 1: Dead Code Removal (safe, isolated deletions)

### 1.1 `types.ts` — Remove dead types and browser-era fields
- **Delete**: `ThinkingTimeLevel` type (line 23)
- **Delete**: `AzureOptions` interface (lines 25-29)
- **Delete**: `azure?: AzureOptions` from `ClientFactory` options (line 35) and `RunOracleOptions` (line 135)
- **Delete**: `browserAttachments`, `browserInlineFiles`, `browserBundleFiles` (lines 140-146)

### 1.2 `sessionManager.ts` — Remove unused imports and dead variants
- Remove `ThinkingTimeLevel` from import
- Remove `AzureOptions` from import and `azure` field from `StoredRunOptions`
- Simplify `SessionMode` from `'api' | 'browser'` → `'api'`

### 1.3 `markdownRenderer.ts` + `renderOutput.ts` — Remove `ensureShikiReady` no-op
- Delete empty `ensureShikiReady()` from `markdownRenderer.ts`
- Remove import + call from `renderOutput.ts`
- Update tests: `renderOutput.test.ts`, `markdownRenderer.test.ts`

### 1.4 `bin/oracle-cli.ts` — Remove dead function
- Delete `resolveEffectiveModelIdForRun()` (line ~1025, never called)
- Remove `--azure-endpoint`, `--azure-deployment`, `--azure-api-version` CLI options
- Remove Azure fields from `CliOptions` interface and `buildRunOptions`

### 1.5 `src/config.ts` — Remove Azure config
- Delete `AzureConfig` interface and `azure` field from `UserConfig`

### 1.6 Test updates
- `tests/cli/searchPersist.test.ts` — remove browser phantom fields from `baseOptions`
- `tests/cli/renderOutput.test.ts` — remove `ensureShikiReady` mock/assertion
- `tests/cli/markdownRenderer.test.ts` — remove `ensureShikiReady` usage

**Verify**: `npm test` passes, `grep -r ThinkingTimeLevel|browserAttachments|AzureOpenAI|ensureShikiReady src/` returns 0

---

## Phase 2: Remove Direct Anthropic Client (claude.ts)

### 2.1 `src/oracle/client.ts` — Remove Claude + Azure branches, merge routing
**Before** (257 lines, two parallel if-blocks):
```
if (baseUrl) {
  if google → gemini    // branch A1
  if anthropic → claude // REMOVE
  openRouter or OpenAI  // branch A2
}
if google → gemini      // branch B1 (duplicate of A1)
if anthropic → claude   // REMOVE
azure or OpenAI         // branch B2
```

**After** (~80 lines, linear flow):
```
provider = resolveProvider(model)
if google → createGeminiClient()
if isOpenRouterBaseUrl → buildOpenRouterCompletionClient()
else → new OpenAI({ baseURL }) // covers xAI, OpenRouter, custom
```

- Remove `AzureOpenAI` import
- Remove `createClaudeClient` import
- Merge two parallel if-blocks into single linear routing

### 2.2 `src/oracle/run.ts` — Simplify provider routing to 3 paths

**Current key selection** (6 providers, ~30 lines):
- google → GEMINI_API_KEY
- xai → XAI_API_KEY
- anthropic → ANTHROPIC_API_KEY
- openai → OPENAI_API_KEY / AZURE key
- openrouter → OPENROUTER_API_KEY
- other → OPENROUTER_API_KEY

**New key selection** (3 paths):
```
google → GEMINI_API_KEY (direct)
xai → XAI_API_KEY (direct via OpenAI SDK @ api.x.ai)
everything else → OPENROUTER_API_KEY (primary), OPENAI_API_KEY (fallback)
```

Changes:
- Remove `import { resolveClaudeModelId } from "./claude.js"`
- Remove `hasAnthropicKey`, `isAzureOpenAI` variables
- Simplify `hasOpenAIKey` (remove Azure branch)
- Simplify `baseUrl` derivation (remove `ANTHROPIC_BASE_URL` branch)
- Simplify `getApiKeyForModel()` to 3 paths
- Simplify `apiEndpoint` (remove anthropic branch at line 377)
- Simplify `resolvedModelId` in clientFactory call (remove `resolveClaudeModelId` at line 388)

### 2.3 Delete files
- **Delete**: `src/oracle/claude.ts`
- **Delete**: `tests/oracle/claude.test.ts`

### 2.4 Test updates
- `tests/oracle/clientFactory.test.ts` — remove Claude routing test, remove Azure test, add test: Claude model routes to OpenRouter
- `tests/cli/runOracle/runOracle.logging.test.ts` — update missing-key error message regex
- `tests/cli/runOracle/runOracle.request-payload.test.ts` — remove Azure test

### 2.5 Update barrel `src/oracle.ts`
- Remove claude.ts re-exports (if any)

**Verify**: `npm test` passes, `grep -r createClaudeClient|resolveClaudeModelId|AzureOpenAI src/` returns 0

---

## Phase 3: Consolidate `resolveEffectiveModelId`

Currently computed in 3 places independently:
1. `bin/oracle-cli.ts:696-700` — inline
2. `src/cli/runOptions.ts:81-88` — private function
3. `src/oracle/run.ts:262-266` — inline

### 3.1 Add shared `resolveEffectiveModelId()` to `src/oracle/modelResolver.ts`
```typescript
export function resolveEffectiveModelId(model: ModelName): string {
  const bare = stripProviderPrefix(model) as ModelName;
  if (resolveProvider(model) === 'google') return resolveGeminiModelId(model);
  const config = isKnownModel(bare) ? MODEL_CONFIGS[bare] : undefined;
  return config?.apiModel ?? bare;
}
```

### 3.2 Update callers
- `bin/oracle-cli.ts` — replace inline logic with import
- `src/cli/runOptions.ts` — delete private function, use shared import
- `src/oracle/run.ts` — replace inline logic with import, remove `resolveGeminiModelId` import if unused

### 3.3 Export from barrel
- Add `resolveEffectiveModelId` to `src/oracle.ts`

**Verify**: `npm test` passes, single definition in `modelResolver.ts`

---

## Phase 4: Dependency & Model Cleanup

### 4.1 `package.json`
- Remove `zod` from `dependencies` (unused in source)
- Remove `@anthropic-ai/tokenizer` from `devDependencies` (already in `dependencies`)

### 4.2 `src/cli/options.ts` — Ghost model
- Remove or register `gpt-5.2-thinking` (line 253, 269) — currently cast with `as ModelName`, not in models.json
- Decision: remove the alias branch (if model doesn't exist on any provider)

### 4.3 Run `knip` for remaining dead exports
```bash
npx knip --reporter compact
```

**Verify**: `npm test` + `npm run build` pass

---

## Phase 5: Run `/simplify` skill
- Review all changed files for quality, reuse opportunities, and efficiency
- Verify no regressions

---

## Files Summary

### DELETE
| File | Reason |
|------|--------|
| `src/oracle/claude.ts` | Direct Anthropic client removed; Claude routes through OpenRouter |
| `tests/oracle/claude.test.ts` | Tests for deleted file |

### MODIFY (production) — 12 files
| File | Changes |
|------|---------|
| `src/oracle/types.ts` | Remove `ThinkingTimeLevel`, `AzureOptions`, browser fields |
| `src/oracle/client.ts` | Remove Claude/Azure branches, merge two if-blocks into linear flow |
| `src/oracle/run.ts` | Simplify to 3 provider paths (Google/xAI/OpenRouter) |
| `src/oracle/modelResolver.ts` | Add shared `resolveEffectiveModelId()` |
| `src/oracle.ts` | Update barrel exports |
| `src/cli/markdownRenderer.ts` | Remove `ensureShikiReady` |
| `src/cli/renderOutput.ts` | Remove `ensureShikiReady` import/call |
| `src/cli/runOptions.ts` | Use shared `resolveEffectiveModelId` |
| `src/cli/options.ts` | Remove ghost model alias |
| `src/sessionManager.ts` | Remove dead imports, simplify `SessionMode` |
| `src/config.ts` | Remove `AzureConfig` |
| `bin/oracle-cli.ts` | Remove dead function, Azure options, use shared model ID resolution |
| `package.json` | Remove `zod`, deduplicate `@anthropic-ai/tokenizer` |

### MODIFY (tests) — 6 files
| File | Changes |
|------|---------|
| `tests/cli/searchPersist.test.ts` | Remove browser phantom fields |
| `tests/cli/renderOutput.test.ts` | Remove `ensureShikiReady` mock |
| `tests/cli/markdownRenderer.test.ts` | Remove `ensureShikiReady` usage |
| `tests/oracle/clientFactory.test.ts` | Remove Claude/Azure tests, add OpenRouter routing test |
| `tests/cli/runOracle/runOracle.logging.test.ts` | Update error message regex |
| `tests/cli/runOracle/runOracle.request-payload.test.ts` | Remove Azure test |

---

## Verification

After each phase:
1. `npm test` — all 329 tests pass (minus deleted test files)
2. `npm run build` — TypeScript compiles
3. Grep for removed symbols returns 0 hits
4. After Phase 4: `npx knip` for remaining dead exports

End-to-end:
```bash
OPENROUTER_API_KEY=... npx tsx bin/oracle-cli.ts "hello" -m gpt-5.1
GEMINI_API_KEY=... npx tsx bin/oracle-cli.ts "hello" -m gemini-3-pro
XAI_API_KEY=... npx tsx bin/oracle-cli.ts "hello" -m grok-4.1
```

