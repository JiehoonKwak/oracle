import { beforeEach, describe, expect, test } from "vitest";

let _originalIsTTY: unknown;
let _originalColumns: unknown;

beforeEach(() => {
  _originalIsTTY = process.stdout.isTTY;
  _originalColumns = process.stdout.columns;
  Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
  Object.defineProperty(process.stdout, "columns", { value: 80, configurable: true });
});

describe("renderMarkdownAnsi", () => {
  test("renders fenced code blocks", async () => {
    const { renderMarkdownAnsi } = await import("../../src/cli/markdownRenderer.ts");
    const out = renderMarkdownAnsi("```ts\nlet x\n```");
    expect(out).toContain("let x");
  });

  test("renders plain markdown", async () => {
    const { renderMarkdownAnsi } = await import("../../src/cli/markdownRenderer.ts");
    const out = renderMarkdownAnsi("```bash\necho hi\n```");
    expect(out).toContain("echo hi");
  });
});
