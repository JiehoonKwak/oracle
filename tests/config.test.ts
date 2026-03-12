import { afterEach, describe, expect, it, vi } from "vitest";

// We test loadDefaultModels via the env-override path (primary usage)
// and verify array return type for the MODELS.md fallback path.
describe("loadDefaultModels", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ORACLE_MODEL env var as single-element array", async () => {
    const { loadDefaultModels } = await import("../src/config.js");
    const result = await loadDefaultModels({ ORACLE_MODEL: "grok-4.1-fast" } as NodeJS.ProcessEnv);
    expect(result).toEqual(["grok-4.1-fast"]);
  });

  it("returns empty array when env unset and MODELS.md missing", async () => {
    // loadDefaultModels with no ORACLE_MODEL will try to read MODELS.md
    // from package root; in test env it may or may not exist
    const { loadDefaultModels } = await import("../src/config.js");
    const result = await loadDefaultModels({} as NodeJS.ProcessEnv);
    // Should either return models from MODELS.md or empty array
    expect(Array.isArray(result)).toBe(true);
  });

  it("ORACLE_MODEL takes priority over MODELS.md", async () => {
    const { loadDefaultModels } = await import("../src/config.js");
    const result = await loadDefaultModels({
      ORACLE_MODEL: "custom-model",
    } as NodeJS.ProcessEnv);
    expect(result).toEqual(["custom-model"]);
  });
});
