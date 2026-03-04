# oracle-lite → oracle 리네이밍 + pnpm → npm + 컨테이너 지원

## Context

1. CLI 명령어 `oracle-lite` → `oracle`로 변경 (타이핑 편의)
2. pnpm → npm 전환 (pnpm 고유 기능 미사용)
3. 기본 config 파일 생성 + gitignore
4. README 최소화 + 컨테이너 설치법
5. 기존 Dockerfile에서 `npm install -g github:user/oracle`로 설치 가능하게

---

## Step 1: oracle-lite → oracle 리네이밍

### 1A. package.json
- `"name"`: `"oracle-lite"` → `"oracle"`
- `"bin"`: `{ "oracle-lite": ... }` → `{ "oracle": "dist/bin/oracle-cli.js" }`

### 1B. bin/oracle-cli.ts
- `.name('oracle-lite')` → `.name('oracle')`

### 1C. scripts/smoke-test.sh
- `grep -q "oracle-lite"` → `grep -q "oracle"`

### 1D. skills/oracle/SKILL.md
- `oracle-lite` → `oracle` (CLI 사용 예시)

### 1E. src/oracleHome.ts
- `'.oracle-lite'` → `'.oracle'` (홈 디렉토리)

### 1F. tests/cli/options.test.ts
- `oracle-lite` 참조가 있으면 `oracle`로 변경

### 1G. 전체 codebase에서 `oracle-lite` 문자열 grep → 누락 없이 치환

---

## Step 2: pnpm → npm

### 2A. package.json scripts
- `"start"`: `pnpm run build` → `npm run build`
- `"oracle"`: `pnpm start` → `npm start`
- `"check"`: `pnpm run typecheck` → `npm run typecheck`
- `"lint"`: `pnpm run typecheck` → `npm run typecheck`
- `"prepare"`: `pnpm run build` → `npm run build`

### 2B. package.json 제거
- `"pnpm"` 섹션 (onlyBuiltDependencies)
- `"packageManager"` 필드

### 2C. .github/workflows/ci.yml
- `pnpm/action-setup@v4` step 삭제
- `pnpm install --frozen-lockfile` → `npm ci`
- `pnpm run lint/test/build` → `npm run lint/test/build`
- node-version `20` → `22`

### 2D. scripts/release.sh
- `pnpm run` → `npm run` (4곳)
- `pnpm publish` → `npm publish`
- usage 텍스트 업데이트

### 2E. Lock 파일 교체
- `pnpm-lock.yaml` 삭제
- `npm install` → `package-lock.json` 생성

---

## Step 3: Config 파일 + .gitignore

### 3A. 기본 config 파일 생성
**File**: `config.example.json5` (NEW, 레포 루트)
```json5
{
  // default model (OpenRouter 모델 ID)
  model: "x-ai/grok-4.1-fast",
  // OpenRouter base URL
  base_url: "https://openrouter.ai/api/v1",
  // search: "off",
  // heartbeatSeconds: 30,
}
```

### 3B. .gitignore 업데이트
- `pnpm-lock.yaml` 추가
- `.oracle/` 이미 무시됨 (홈디렉토리이므로 불필요)

---

## Step 4: README 최소화

**File**: `README.md` — 완전 재작성

내용:
1. 프로젝트 설명 (1줄)
2. Quick start (npm install, 환경변수, 실행 예시)
3. Multi-model 예시
4. Config 예시
5. Container 설치법 (기존 Dockerfile에 추가하는 방법)
6. 세션 관리
7. 라이센스

브라우저/MCP/TUI/remote/bridge 관련 내용 전부 제거.

---

## Step 5: Verify

```bash
# 전체 codebase에서 oracle-lite 잔존 확인
grep -r "oracle-lite" src/ bin/ tests/ scripts/ package.json README.md

# npm 전환 확인
rm -rf node_modules pnpm-lock.yaml
npm install
npm run build
npm test
npm run test:smoke
```

