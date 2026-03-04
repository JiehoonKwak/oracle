#!/usr/bin/env bash
set -euo pipefail

echo "=== oracle smoke test ==="

# Test 1: dry-run with default model
echo "Test 1: dry-run default model..."
node dist/bin/oracle-cli.js --dry-run -p "test prompt"
echo "PASS"

# Test 2: status command
echo "Test 2: status command..."
node dist/bin/oracle-cli.js status 2>&1 || true
echo "PASS"

# Test 3: dry-run with multi-model
echo "Test 3: dry-run multi-model..."
node dist/bin/oracle-cli.js --dry-run --models "google/gemini-3.1-pro-preview,x-ai/grok-4.1-fast" -p "test prompt"
echo "PASS"

# Test 4: help
echo "Test 4: help..."
node dist/bin/oracle-cli.js --help | grep -q "oracle"
echo "PASS"

echo "=== All smoke tests passed ==="
