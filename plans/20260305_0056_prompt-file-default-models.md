# Oracle CLI v1.0 — Config Defaults, Prompt-File, Help Cleanup

## Context

Oracle CLI는 native API (xAI, Google, Anthropic, OpenAI)를 이미 지원하지만, help과 config가 이를 반영하지 않음. Config에서 default models를 자동 적용하는 로직이 없고, bash에서 복잡한 prompt를 `-p`로 넘기면 이스케이프 문제 발생. 개인 사용이므로 v1.0 bump.

---

## Step 1: `--prompt-file` 옵션 추가

### 1A. `bin/oracle-cli.ts` — CLI 옵션 등록
`-p, --prompt` 옵션 뒤에 추가:
```typescript
.option("-P, --prompt-file <path>", "Read prompt from a file (avoids shell escaping).")
```
`CliOptions` 인터페이스에 `promptFile?: string` 추가.

### 1B. `bin/oracle-cli.ts` — prompt 해석 로직
`runRootCommand()` 내부, `const previewMode = ...` (line ~577) 전에:
```typescript
if (options.promptFile) {
  if (options.prompt) {
    throw new Error("--prompt-file cannot be combined with --prompt or positional prompt.");
  }
  options.prompt = (await readFile(resolve(options.promptFile), "utf8")).trim();
  if (!options.prompt) throw new Error(`Prompt file is empty: ${options.promptFile}`);
}
```
import 추가: `import { readFile } from "node:fs/promises"` + `import { resolve } from "node:path"`

---

## Step 2: Config에서 default models 자동 적용

### 2A. `bin/oracle-cli.ts` — userConfig.models 적용
`userConfig.model` 적용 (~line 633) 바로 뒤에:
```typescript
if (optionUsesDefault("models") && userConfig.models?.length) {
  options.models = userConfig.models;
}
```

### 2B. `bin/oracle-cli.ts` — multiModelProvided 재배치
현재 `multiModelProvided` (line 557)가 config 적용 전에 계산됨.
- config 적용 후로 이동 (userConfig.model/models 적용 블록 이후)
- `--models` + `--model` 충돌 검증도 함께 이동

### 2C. `config.example.json5` 업데이트
```json5
{
  // default models (parallel multi-model query)
  models: ["x-ai/grok-4.1-fast", "google/gemini-3.1-pro-preview"],
  // OpenRouter base URL (fallback when native API key unavailable)
  base_url: "https://openrouter.ai/api/v1",
  // search: "off",
  // heartbeatSeconds: 30,
}
```

### 2D. 우선순위
CLI `--models` > `config.models` > CLI `--model` > `config.model` > DEFAULT_MODEL

---

## Step 3: Help 텍스트 업데이트

### 3A. `bin/oracle-cli.ts`
- description → `"Multi-model LLM CLI — bundles prompt + files for API queries."`
- 하단 Examples에 `--prompt-file` 예시 추가

### 3B. `src/cli/help.ts` — Tips 추가 (2개)
```
• Use -P/--prompt-file for complex prompts to avoid shell escaping.
• Native API keys (GEMINI_API_KEY, XAI_API_KEY, ANTHROPIC_API_KEY) used when available; OPENROUTER_API_KEY as fallback.
```

---

## Step 4: Version bump

### `package.json`
`"version": "0.8.6"` → `"version": "1.0.0"`

---

## Step 5: Dead code audit (no changes needed)

All --help options verified active:
- `--notify/--notify-sound`: macOS native + cross-platform ✅
- `--background`: Responses API polling ✅
- `--render/--render-markdown`: ANSI rendering ✅
- `--write-output`, `--slug`, `--azure-*`, `--wait`: all working ✅
- `--copy`: already removed from code ✅

Native API already implemented (code change unnecessary):
| Provider | SDK | Env Key |
|----------|-----|---------|
| Google Gemini | @google/genai | GEMINI_API_KEY |
| Anthropic | raw fetch | ANTHROPIC_API_KEY |
| OpenAI | openai SDK | OPENAI_API_KEY |
| xAI Grok | OpenAI SDK + api.x.ai | XAI_API_KEY |
| OpenRouter | fallback | OPENROUTER_API_KEY |

---

## Files to modify

| File | Changes |
|------|---------|
| `bin/oracle-cli.ts` | --prompt-file, config.models, multiModelProvided move, description, examples |
| `src/cli/help.ts` | 2 new tips |
| `config.example.json5` | models array default |
| `package.json` | version 1.0.0 |

## Verification

```bash
npm run build && npm test && npm run test:smoke

# prompt-file
echo "What is 2+2?" > /tmp/test-prompt.md
node dist/bin/oracle-cli.js -P /tmp/test-prompt.md --dry-run

# config.models auto-apply
node dist/bin/oracle-cli.js -p "test" --dry-run  # multi-model if config.models set

# help
node dist/bin/oracle-cli.js --help
```

