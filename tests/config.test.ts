import { afterAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadUserConfig } from "../src/config.js";
import { getOracleHomeDir, setOracleHomeDirOverrideForTest } from "../src/oracleHome.js";

describe("getOracleHomeDir", () => {
  afterAll(() => {
    setOracleHomeDirOverrideForTest(null);
  });

  it("defaults to ~/.oracle", () => {
    setOracleHomeDirOverrideForTest(null);
    const saved = process.env.ORACLE_HOME_DIR;
    delete process.env.ORACLE_HOME_DIR;
    try {
      const dir = getOracleHomeDir();
      expect(dir).toBe(path.join(os.homedir(), ".oracle"));
    } finally {
      if (saved !== undefined) process.env.ORACLE_HOME_DIR = saved;
    }
  });
});

describe("loadUserConfig", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "oracle-config-"));
    setOracleHomeDirOverrideForTest(tempDir);
  });

  it("parses JSON5 config with comments", async () => {
    const configPath = path.join(tempDir, "config.json");
    await fs.writeFile(
      configPath,
      `// comment\n{
        notify: { sound: true },
        heartbeatSeconds: 15,
      }`,
      "utf8",
    );

    const result = await loadUserConfig();
    expect(result.loaded).toBe(true);
    expect(result.config.notify?.sound).toBe(true);
    expect(result.config.heartbeatSeconds).toBe(15);
  });

  it("returns empty config when file is missing", async () => {
    const result = await loadUserConfig();
    expect(result.loaded).toBe(false);
    expect(result.config).toEqual({});
  });

  it("parses new UserConfig fields (base_url, output_format, models)", async () => {
    const configPath = path.join(tempDir, "config.json");
    await fs.writeFile(
      configPath,
      JSON.stringify({
        base_url: "https://openrouter.ai/api/v1",
        output_format: "json",
        models: ["gpt-4", "claude-3"],
      }),
      "utf8",
    );

    const result = await loadUserConfig();
    expect(result.loaded).toBe(true);
    expect(result.config.base_url).toBe("https://openrouter.ai/api/v1");
    expect(result.config.output_format).toBe("json");
    expect(result.config.models).toEqual(["gpt-4", "claude-3"]);
  });

  describe("env var overrides", () => {
    it("ORACLE_MODEL overrides config.models", async () => {
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(configPath, JSON.stringify({ models: ["from-file"] }), "utf8");

      const saved = process.env.ORACLE_MODEL;
      process.env.ORACLE_MODEL = "from-env";
      try {
        const result = await loadUserConfig();
        expect(result.config.models).toEqual(["from-env"]);
      } finally {
        if (saved !== undefined) process.env.ORACLE_MODEL = saved;
        else delete process.env.ORACLE_MODEL;
      }
    });

    it("ORACLE_BASE_URL overrides config.base_url", async () => {
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(
        configPath,
        JSON.stringify({ base_url: "https://file.example.com" }),
        "utf8",
      );

      const saved = process.env.ORACLE_BASE_URL;
      process.env.ORACLE_BASE_URL = "https://env.example.com";
      try {
        const result = await loadUserConfig();
        expect(result.config.base_url).toBe("https://env.example.com");
      } finally {
        if (saved !== undefined) process.env.ORACLE_BASE_URL = saved;
        else delete process.env.ORACLE_BASE_URL;
      }
    });

    it("env vars do not override when unset", async () => {
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(
        configPath,
        JSON.stringify({ models: ["keep-me"], base_url: "https://keep.example.com" }),
        "utf8",
      );

      const savedModel = process.env.ORACLE_MODEL;
      const savedUrl = process.env.ORACLE_BASE_URL;
      delete process.env.ORACLE_MODEL;
      delete process.env.ORACLE_BASE_URL;
      try {
        const result = await loadUserConfig();
        expect(result.config.models).toEqual(["keep-me"]);
        expect(result.config.base_url).toBe("https://keep.example.com");
      } finally {
        if (savedModel !== undefined) process.env.ORACLE_MODEL = savedModel;
        if (savedUrl !== undefined) process.env.ORACLE_BASE_URL = savedUrl;
      }
    });
  });

  afterAll(() => {
    setOracleHomeDirOverrideForTest(null);
  });
});
