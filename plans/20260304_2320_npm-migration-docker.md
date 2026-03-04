# pnpm → npm 마이그레이션 + 컨테이너 설치 지원

## Context

oracle-lite를 pnpm에서 npm으로 전환하고, 기존 Dockerfile에서 `npm install github:user/oracle-lite -g`로 설치할 수 있게 함. `prepare` 스크립트가 install 시 자동 빌드(`tsc`)를 트리거하므로 별도 빌드 단계 불필요.

---

## Step 1: package.json — pnpm → npm

**File**: `package.json`

1. scripts에서 `pnpm run` → `npm run` 치환 (5곳: start, oracle, check, lint, prepare)
2. `"pnpm"` 섹션 제거 (onlyBuiltDependencies)
3. `"packageManager"` 필드 제거

## Step 2: CI workflow — npm

**File**: `.github/workflows/ci.yml`

- `pnpm/action-setup@v4` step 삭제
- `pnpm install --frozen-lockfile` → `npm ci`
- `pnpm run` → `npm run` (3곳)
- node-version `20` → `22`

## Step 3: release.sh — npm

**File**: `scripts/release.sh`

- `pnpm run` → `npm run` (4곳)
- `pnpm publish` → `npm publish`
- usage 텍스트 업데이트

## Step 4: Lock 파일 교체

- `pnpm-lock.yaml` 삭제
- `npm install` → `package-lock.json` 생성

## Step 5: .gitignore 정리

**File**: `.gitignore`

- `pnpm-lock.yaml` 추가 (혹시 남아있을 경우 무시)

## Verify

```bash
rm -rf node_modules pnpm-lock.yaml
npm install
npm run build
npm test
npm run test:smoke
```

---

## 컨테이너 설치 방법

기존 Dockerfile에 추가할 내용:

```dockerfile
# oracle-lite 설치 (GitHub에서 직접, prepare 스크립트가 자동 빌드)
RUN npm install -g github:jiehoonk/oracle-lite

# 사용: oracle-lite -m "x-ai/grok-4.1-fast" --base-url "https://openrouter.ai/api/v1" -p "..."
```

API 키는 런타임에 환경변수로 주입:
```bash
docker run -e OPENROUTER_API_KEY=sk-or-... my-image oracle-lite -p "hello"
```

또는 config 파일 마운트:
```bash
docker run -v ~/.oracle-lite:/root/.oracle-lite my-image oracle-lite -p "hello"
```

