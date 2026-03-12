import { describe, expect, it } from "vitest";
import { resolveRunOptionsFromConfig } from "../src/cli/runOptions.js";
import { estimateRequestTokens } from "../src/oracle/tokenEstimate.js";
import { DEFAULT_MODEL, MODEL_CONFIGS } from "../src/oracle/config.js";

describe("resolveRunOptionsFromConfig", () => {
  const basePrompt = "This prompt is comfortably above twenty characters.";

  it("returns runOptions", () => {
    const { runOptions } = resolveRunOptionsFromConfig({
      prompt: basePrompt,
      env: {},
    });
    expect(runOptions).toBeDefined();
  });

  it("defaults to DEFAULT_MODEL when model not provided", () => {
    const { runOptions } = resolveRunOptionsFromConfig({
      prompt: basePrompt,
    });
    expect(runOptions.model).toBe(DEFAULT_MODEL);
  });

  it("resolves gemini model", () => {
    const { runOptions } = resolveRunOptionsFromConfig({
      prompt: basePrompt,
      model: "gemini-3-pro",
      env: {},
    });
    expect(runOptions.model).toBe("gemini-3-pro");
  });

  it("resolves gpt-5.1-codex", () => {
    const { runOptions } = resolveRunOptionsFromConfig({
      prompt: basePrompt,
      model: "gpt-5.1-codex",
      env: {},
    });
    expect(runOptions.model).toBe("gpt-5.1-codex");
  });

  it("passes through exact model names in multi-model entries", () => {
    const { runOptions } = resolveRunOptionsFromConfig({
      prompt: basePrompt,
      models: ["gpt-5.1", "gemini-3-pro", "claude-4.5-sonnet"],
    });

    expect(runOptions.model).toBe("gpt-5.1");
    expect(runOptions.models).toEqual(["gpt-5.1", "gemini-3-pro", "claude-4.5-sonnet"]);
  });

  it("passes through unknown model names verbatim", () => {
    const { runOptions } = resolveRunOptionsFromConfig({
      prompt: basePrompt,
      models: ["grok-4.20-multi-agent-beta-0309"],
    });

    expect(runOptions.model).toBe("grok-4.20-multi-agent-beta-0309");
    expect(runOptions.models).toEqual(["grok-4.20-multi-agent-beta-0309"]);
  });
});

describe("estimateRequestTokens", () => {
  const modelConfig = MODEL_CONFIGS["gpt-5.1"];

  it("includes instructions, input text, tools, reasoning, background/store, plus buffer", () => {
    const request = {
      model: "gpt-5.1",
      instructions: "sys",
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: "hello world" }],
        },
      ],
      tools: [{ type: "web_search_preview" }],
      reasoning: { effort: "high" },
      background: true,
      store: true,
    };
    const estimate = estimateRequestTokens(
      request as unknown as Parameters<typeof estimateRequestTokens>[0],
      modelConfig,
      10,
    );
    expect(estimate).toBeGreaterThan(10);
  });

  it("adds buffer even with minimal input", () => {
    const request = {
      model: "gpt-5.1",
      instructions: "a",
      input: [{ role: "user", content: [{ type: "input_text", text: "b" }] }],
    };
    const estimate = estimateRequestTokens(
      request as unknown as Parameters<typeof estimateRequestTokens>[0],
      modelConfig,
      50,
    );
    expect(estimate).toBeGreaterThanOrEqual(50);
  });
});
