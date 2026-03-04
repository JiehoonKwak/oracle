import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { OracleRequestBody } from "../../src/oracle/types.js";

describe("createDefaultClientFactory", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.ORACLE_CLIENT_FACTORY;
    vi.restoreAllMocks();
  });

  test("falls back to default factory and warns when custom factory export is invalid", async () => {
    process.env.ORACLE_CLIENT_FACTORY = "/nonexistent/path.js";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { createDefaultClientFactory } = await import("../../src/oracle/client.js");
    const factory = createDefaultClientFactory();
    expect(typeof factory).toBe("function");
    expect(warn).toHaveBeenCalledOnce();
  });

  test("uses inline test factory hook when requested", async () => {
    process.env.ORACLE_CLIENT_FACTORY = "INLINE_TEST_FACTORY";
    const { createDefaultClientFactory } = await import("../../src/oracle/client.js");
    const factory = createDefaultClientFactory();
    const client = factory("key");
    const request: OracleRequestBody = {
      model: "gpt-5.1",
      instructions: "test",
      input: [{ role: "user", content: [{ type: "input_text", text: "hi" }] }],
    };
    const response = await client.responses.create(request);
    const streamed = client.responses.stream(request);
    const retrieved = await client.responses.retrieve("inline-test");

    expect(response).toMatchObject({ id: "inline-test", status: "completed" });
    expect(retrieved).toMatchObject({ id: "inline-test" });
    // stream exposes an async iterator and a finalResponse promise.
    expect(typeof (await streamed).finalResponse).toBe("function");
  });

  test("routes gemini models through the Gemini client", async () => {
    process.env.ORACLE_CLIENT_FACTORY = "";
    const createGeminiClient = vi.fn((key, model, resolvedModelId) => ({
      client: "gemini",
      key,
      model,
      resolvedModelId,
    }));
    vi.doMock("../../src/oracle/gemini.js", () => ({ createGeminiClient }));

    const { createDefaultClientFactory } = await import("../../src/oracle/client.js");
    const factory = createDefaultClientFactory();
    const client = factory("abc", { model: "gemini-3-pro", resolvedModelId: "gem-3-pro" });

    expect(createGeminiClient).toHaveBeenCalledWith("abc", "gemini-3-pro", "gem-3-pro");
    expect(client).toMatchObject({ client: "gemini", model: "gemini-3-pro" });
  });

  test("claude models route through OpenAI SDK (for OpenRouter)", async () => {
    process.env.ORACLE_CLIENT_FACTORY = "";
    const { createDefaultClientFactory } = await import("../../src/oracle/client.js");
    const factory = createDefaultClientFactory();

    // Claude models no longer have a dedicated client — they use the OpenAI SDK
    const client = factory("xyz", {
      model: "claude-4.5-sonnet",
      resolvedModelId: "claude-sonnet-4-5",
      baseUrl: "https://openrouter.ai/api/v1",
    });

    expect(client.responses).toMatchObject({
      create: expect.any(Function),
      stream: expect.any(Function),
      retrieve: expect.any(Function),
    });
  });

  test("creates OpenAI client for default path", async () => {
    process.env.ORACLE_CLIENT_FACTORY = "";
    const { createDefaultClientFactory } = await import("../../src/oracle/client.js");
    const factory = createDefaultClientFactory();

    const defaultClient = factory("sk-test", { model: "gpt-5.1" });

    expect(defaultClient.responses).toMatchObject({
      create: expect.any(Function),
      stream: expect.any(Function),
      retrieve: expect.any(Function),
    });
  });
});
