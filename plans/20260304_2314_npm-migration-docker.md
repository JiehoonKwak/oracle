# pnpm → npm 마이그레이션 + Docker 컨테이너 지원

## Context

oracle-lite가 pnpm을 사용하는 이유는 upstream 설정을 그대로 가져왔기 때문. workspace/catalog 등 pnpm 고유 기능을 쓰지 않으므로 npm으로 전환. 동시에 새 컴퓨터/서버에서 컨테이너로 바로 실행할 수 있도록 Dockerfile 추가.

---

## Step 1: package.json — pnpm 제거

**File**: `package.json`

1. scripts에서 `pnpm run` → `npm run`, `pnpm start` → `npm start` 치환 (5곳)
2. `"pnpm"` 섹션 제거 (lines 79-83)
3. `"packageManager"` 필드 제거 (line 84)

## Step 2: CI workflow — npm으로 전환

**File**: `.github/workflows/ci.yml`

- `pnpm/action-setup@v4` step 삭제
- `pnpm install --frozen-lockfile` → `npm ci`
- `pnpm run lint/test/build` → `npm run lint/test/build`
- node-version `20` → `22` (engines 필드와 일치)

## Step 3: release.sh — npm으로 전환

**File**: `scripts/release.sh`

- `pnpm run check/lint/test/build` → `npm run` (4곳)
- `pnpm publish` → `npm publish` (1곳)
- usage 텍스트 업데이트

## Step 4: Lock 파일 교체

- `pnpm-lock.yaml` 삭제
- `npm install` 실행 → `package-lock.json` 생성
- `.gitignore`에 `pnpm-lock.yaml` 불필요 (삭제했으므로)

## Step 5: Dockerfile 생성

**File**: `Dockerfile` (NEW)

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
ENTRYPOINT ["node", "dist/bin/oracle-cli.js"]
```

핵심 설계:
- **pre-built dist 복사**: 컨테이너에서 tsc 빌드 안 함 (devDeps 불필요 → 이미지 경량화)
- alpine 기반 (~50MB)
- API 키는 `docker run -e OPENROUTER_API_KEY=... oracle-lite -p "..."` 로 주입

## Step 6: .dockerignore 생성

**File**: `.dockerignore` (NEW)

```
node_modules
src
tests
scripts
docs
*.md
.git
.github
coverage
*.tsbuildinfo
```

## Step 7: smoke-test.sh 업데이트

**File**: `scripts/smoke-test.sh`

- pnpm 참조 없음 (이미 `node dist/bin/oracle-cli.js` 사용) — 변경 불필요

## Verify

```bash
# npm 전환 확인
rm -rf node_modules
npm install
npm run build
npm test
npm run test:smoke

# Docker 빌드 + 실행
docker build -t oracle-lite .
docker run --rm oracle-lite --help
docker run --rm -e OPENROUTER_API_KEY=$OPENROUTER_API_KEY oracle-lite \
  -m "arcee-ai/trinity-large-preview:free" \
  --base-url "https://openrouter.ai/api/v1" \
  -p "Say hello"
```

