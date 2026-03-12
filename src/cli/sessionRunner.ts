import kleur from "kleur";
import fs from "node:fs/promises";
import path from "node:path";
import type { SessionMetadata } from "../sessionStore.js";
import type { RunOracleOptions, UsageSummary } from "../oracle.js";
import {
  runOracle,
  OracleResponseError,
  OracleTransportError,
  extractResponseMetadata,
  asOracleUserError,
  extractTextOutput,
} from "../oracle.js";
import { renderMarkdownAnsi } from "./markdownRenderer.js";
import { formatResponseMetadata, formatTransportMetadata } from "./sessionDisplay.js";
import { markErrorLogged } from "./errorUtils.js";
import { sessionStore } from "../sessionStore.js";
import { runMultiModelApiSession } from "../oracle/multiModelRunner.js";
import { MODEL_CONFIGS, DEFAULT_SYSTEM_PROMPT } from "../oracle/config.js";
import { isKnownModel } from "../oracle/modelResolver.js";
import { resolveModelConfig } from "../oracle/modelResolver.js";
import { buildPrompt, buildRequestBody } from "../oracle/request.js";
import { estimateRequestTokens } from "../oracle/tokenEstimate.js";
import { formatTokenEstimate, formatTokenValue } from "../oracle/runUtils.js";
import { formatFinishLine } from "../oracle/finishLine.js";
import { sanitizeOscProgress } from "./oscUtils.js";
import { readFiles } from "../oracle/files.js";
import { cwd as getCwd } from "node:process";

interface MultiModelJsonOutput {
  prompt: string;
  timestamp: string;
  models: Array<{
    model: string;
    response: string;
    tokens: { in: number; out: number };
    duration_ms: number;
  }>;
}

function buildMultiModelJson(
  prompt: string,
  results: Array<{
    model: string;
    text: string;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
  }>,
): MultiModelJsonOutput {
  return {
    prompt,
    timestamp: new Date().toISOString(),
    models: results.map((r) => ({
      model: r.model,
      response: r.text,
      tokens: { in: r.inputTokens, out: r.outputTokens },
      duration_ms: r.durationMs,
    })),
  };
}

const isTty = process.stdout.isTTY;
const dim = (text: string): string => (isTty ? kleur.dim(text) : text);

export interface SessionRunResult {
  answers: Array<{ model: string; text: string; usage: UsageSummary }>;
}

interface SessionRunParams {
  sessionMeta: SessionMetadata;
  runOptions: RunOracleOptions;
  mode?: "api";
  cwd: string;
  log: (message?: string) => void;
  write: (chunk: string) => boolean;
  version: string;
  muteStdout?: boolean;
}

export async function performSessionRun({
  sessionMeta,
  runOptions,
  cwd,
  log,
  write,
  version,
  muteStdout = false,
}: SessionRunParams): Promise<SessionRunResult> {
  const writeInline = (chunk: string): boolean => {
    // Keep session logs intact while still echoing inline output to the user.
    write(chunk);
    return muteStdout ? true : process.stdout.write(chunk);
  };
  const mode = "api" as const;
  await sessionStore.updateSession(sessionMeta.id, {
    status: "running",
    startedAt: new Date().toISOString(),
    mode,
  });
  const modelForStatus = runOptions.model ?? sessionMeta.model;
  try {
    const multiModels = Array.isArray(runOptions.models) ? runOptions.models.filter(Boolean) : [];
    if (multiModels.length > 1) {
      const [primaryModel] = multiModels;
      if (!primaryModel) {
        throw new Error("Missing model name for multi-model run.");
      }
      const modelConfig = await resolveModelConfig(primaryModel, {
        baseUrl: runOptions.baseUrl,
        openRouterApiKey: process.env.OPENROUTER_API_KEY,
      });
      const files = await readFiles(runOptions.file ?? [], { cwd });
      const promptWithFiles = buildPrompt(runOptions.prompt, files, cwd);
      const requestBody = buildRequestBody({
        modelConfig,
        systemPrompt: runOptions.system ?? DEFAULT_SYSTEM_PROMPT,
        userPrompt: promptWithFiles,
        searchEnabled: runOptions.search !== false,
        maxOutputTokens: runOptions.maxOutput,
        background: runOptions.background,
        storeResponse: runOptions.background,
      });
      const estimatedTokens = estimateRequestTokens(requestBody, modelConfig);
      const tokenLabel = formatTokenEstimate(estimatedTokens, (text) =>
        isTty ? kleur.green(text) : text,
      );
      const filesPhrase = files.length === 0 ? "no files" : `${files.length} files`;
      const modelsLabel = multiModels.join(", ");
      log(
        `Calling ${isTty ? kleur.cyan(modelsLabel) : modelsLabel} — ${tokenLabel} tokens, ${filesPhrase}.`,
      );

      const multiRunTips: string[] = [];
      if (files.length === 0) {
        multiRunTips.push(
          "Tip: no files attached — Oracle works best with project context. Add files via --file path/to/code or docs.",
        );
      }
      const shortPrompt = (runOptions.prompt?.trim().length ?? 0) < 80;
      if (shortPrompt) {
        multiRunTips.push(
          "Tip: brief prompts often yield generic answers — aim for 6–30 sentences and attach key files.",
        );
      }
      for (const tip of multiRunTips) {
        log(dim(tip));
      }

      // Surface long-running model expectations up front so users know why a response might lag.
      const longRunningModels = multiModels.filter(
        (model) => isKnownModel(model) && MODEL_CONFIGS[model]?.reasoning?.effort === "high",
      );
      if (longRunningModels.length > 0) {
        for (const model of longRunningModels) {
          log("");
          const headingLabel = `[${model}]`;
          log(isTty ? kleur.bold(headingLabel) : headingLabel);
          log(dim("This model can take up to 60 minutes (usually replies much faster)."));
          log(dim("Press Ctrl+C to cancel."));
        }
      }

      const shouldStreamInline = !muteStdout && process.stdout.isTTY;
      const shouldRenderMarkdown = shouldStreamInline && runOptions.renderPlain !== true;
      const printedModels = new Set<string>();
      const answerFallbacks = new Map<string, string>();
      const stripOscProgress = (text: string): string =>
        sanitizeOscProgress(text, shouldStreamInline);

      const printModelLog = async (model: string) => {
        if (printedModels.has(model)) return;
        printedModels.add(model);
        const body = stripOscProgress(await sessionStore.readModelLog(sessionMeta.id, model));
        log("");
        const fallback = answerFallbacks.get(model);
        const hasBody = body.length > 0;
        if (!hasBody && !fallback) {
          log(dim(`${model}: (no output recorded)`));
          return;
        }
        const headingLabel = `[${model}]`;
        const heading = shouldStreamInline ? kleur.bold(headingLabel) : headingLabel;
        log(heading);
        const content = hasBody ? body : (fallback ?? "");
        const printable = shouldRenderMarkdown ? renderMarkdownAnsi(content) : content;
        writeInline(printable);
        if (!printable.endsWith("\n")) {
          log("");
        }
      };

      const summary = await runMultiModelApiSession(
        {
          sessionMeta,
          runOptions,
          models: multiModels,
          cwd,
          version,
          onModelDone: shouldStreamInline
            ? async (result) => {
                if (result.answerText) {
                  answerFallbacks.set(result.model, result.answerText);
                }
                await printModelLog(result.model);
              }
            : undefined,
        },
        {
          runOracleImpl: muteStdout
            ? (opts, deps) => runOracle(opts, { ...deps, allowStdout: false })
            : undefined,
        },
      );

      if (!shouldStreamInline) {
        // If we couldn't stream inline (e.g., non-TTY), print all logs after completion.
        for (const [index, result] of summary.fulfilled.entries()) {
          if (index > 0) {
            log("");
          }
          await printModelLog(result.model);
        }
      }
      const aggregateUsage = summary.fulfilled.reduce<UsageSummary>(
        (acc, entry) => ({
          inputTokens: acc.inputTokens + entry.usage.inputTokens,
          outputTokens: acc.outputTokens + entry.usage.outputTokens,
          reasoningTokens: acc.reasoningTokens + entry.usage.reasoningTokens,
          totalTokens: acc.totalTokens + entry.usage.totalTokens,
          cost: (acc.cost ?? 0) + (entry.usage.cost ?? 0),
        }),
        { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0, cost: 0 },
      );
      const tokensDisplay = [
        aggregateUsage.inputTokens,
        aggregateUsage.outputTokens,
        aggregateUsage.reasoningTokens,
        aggregateUsage.totalTokens,
      ]
        .map((v, idx) =>
          formatTokenValue(
            v,
            {
              input_tokens: aggregateUsage.inputTokens,
              output_tokens: aggregateUsage.outputTokens,
              reasoning_tokens: aggregateUsage.reasoningTokens,
              total_tokens: aggregateUsage.totalTokens,
            },
            idx,
          ),
        )
        .join("/");
      const tokensPart = (() => {
        const parts = tokensDisplay.split("/");
        if (parts.length !== 4) return tokensDisplay;
        return `↑${parts[0]} ↓${parts[1]} ↻${parts[2]} Δ${parts[3]}`;
      })();
      const statusColor =
        summary.rejected.length === 0
          ? kleur.green
          : summary.fulfilled.length > 0
            ? kleur.yellow
            : kleur.red;
      const overallText = `${summary.fulfilled.length}/${multiModels.length} models`;
      const { line1 } = formatFinishLine({
        elapsedMs: summary.elapsedMs,
        model: overallText,
        costUsd: aggregateUsage.cost ?? null,
        tokensPart,
      });
      log(statusColor(line1));

      const hasFailure = summary.rejected.length > 0;
      await sessionStore.updateSession(sessionMeta.id, {
        status: hasFailure ? "error" : "completed",
        completedAt: new Date().toISOString(),
        usage: aggregateUsage,
        elapsedMs: summary.elapsedMs,
        response: undefined,
        transport: undefined,
        error: undefined,
      });
      const totalCharacters = summary.fulfilled.reduce(
        (sum, entry) => sum + entry.answerText.length,
        0,
      );
      if (runOptions.writeOutputPath) {
        const jsonOutput = buildMultiModelJson(
          runOptions.prompt ?? "",
          summary.fulfilled.map((entry) => ({
            model: entry.model,
            text: entry.answerText,
            inputTokens: entry.usage.inputTokens,
            outputTokens: entry.usage.outputTokens,
            durationMs: 0,
          })),
        );
        const jsonPath = runOptions.writeOutputPath.replace(/\.[^.]+$/, "") + ".json";
        const savedPath = await writeAssistantOutput(
          jsonPath,
          JSON.stringify(jsonOutput, null, 2),
          log,
        );
        if (savedPath) {
          log(dim(`Saved multi-model JSON output to ${savedPath}`));
        }
      }
      if (hasFailure) {
        throw summary.rejected[0].reason;
      }
      return {
        answers: summary.fulfilled.map((entry) => ({
          model: entry.model,
          text: entry.answerText,
          usage: entry.usage,
        })),
      };
    }
    const singleModelOverride = multiModels.length === 1 ? multiModels[0] : undefined;
    const apiRunOptions: RunOracleOptions = singleModelOverride
      ? { ...runOptions, model: singleModelOverride, models: undefined }
      : runOptions;
    if (modelForStatus && singleModelOverride == null) {
      await sessionStore.updateModelRun(sessionMeta.id, modelForStatus, {
        status: "running",
        startedAt: new Date().toISOString(),
      });
    }
    const result = await runOracle(apiRunOptions, {
      cwd,
      log,
      write,
      allowStdout: !muteStdout,
    });
    if (result.mode !== "live") {
      throw new Error("Unexpected preview result while running a session.");
    }
    await sessionStore.updateSession(sessionMeta.id, {
      status: "completed",
      completedAt: new Date().toISOString(),
      usage: result.usage,
      elapsedMs: result.elapsedMs,
      response: extractResponseMetadata(result.response),
      transport: undefined,
      error: undefined,
    });
    if (modelForStatus && singleModelOverride == null) {
      await sessionStore.updateModelRun(sessionMeta.id, modelForStatus, {
        status: "completed",
        completedAt: new Date().toISOString(),
        usage: result.usage,
      });
    }
    const answerText = extractTextOutput(result.response);
    await writeAssistantOutput(runOptions.writeOutputPath, answerText, log);
    return {
      answers: [
        {
          model: apiRunOptions.model,
          text: answerText,
          usage: result.usage,
        },
      ],
    };
  } catch (error: unknown) {
    const message = formatError(error);
    log(`ERROR: ${message}`);
    markErrorLogged(error);
    const userError = asOracleUserError(error);
    if (userError) {
      log(dim(`User error (${userError.category}): ${userError.message}`));
    }
    const responseMetadata = error instanceof OracleResponseError ? error.metadata : undefined;
    const metadataLine = formatResponseMetadata(responseMetadata);
    if (metadataLine) {
      log(dim(`Response metadata: ${metadataLine}`));
    }
    const transportMetadata =
      error instanceof OracleTransportError ? { reason: error.reason } : undefined;
    const transportLine = formatTransportMetadata(transportMetadata);
    if (transportLine) {
      log(dim(`Transport: ${transportLine}`));
    }
    await sessionStore.updateSession(sessionMeta.id, {
      status: "error",
      completedAt: new Date().toISOString(),
      errorMessage: message,
      mode,
      response: responseMetadata,
      transport: transportMetadata,
      error: userError
        ? {
            category: userError.category,
            message: userError.message,
            details: userError.details,
          }
        : undefined,
    });
    if (modelForStatus) {
      await sessionStore.updateModelRun(sessionMeta.id, modelForStatus, {
        status: "error",
        completedAt: new Date().toISOString(),
      });
    }
    throw error;
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function writeAssistantOutput(
  targetPath: string | undefined,
  content: string,
  log: (message: string) => void,
) {
  if (!targetPath) return;
  if (!content || content.trim().length === 0) {
    log(dim("write-output skipped: no assistant content to save."));
    return;
  }
  const normalizedTarget = path.resolve(targetPath);
  const normalizedSessionsDir = path.resolve(sessionStore.sessionsDir());
  if (
    normalizedTarget === normalizedSessionsDir ||
    normalizedTarget.startsWith(`${normalizedSessionsDir}${path.sep}`)
  ) {
    log(
      dim(
        `write-output skipped: refusing to write inside session storage (${normalizedSessionsDir}).`,
      ),
    );
    return;
  }
  try {
    await fs.mkdir(path.dirname(normalizedTarget), { recursive: true });
    const payload = content.endsWith("\n") ? content : `${content}\n`;
    await fs.writeFile(normalizedTarget, payload, "utf8");
    log(dim(`Saved assistant output to ${normalizedTarget}`));
    return normalizedTarget;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (isPermissionError(error)) {
      const fallbackPath = buildFallbackPath(normalizedTarget);
      if (fallbackPath) {
        try {
          await fs.mkdir(path.dirname(fallbackPath), { recursive: true });
          const payload = content.endsWith("\n") ? content : `${content}\n`;
          await fs.writeFile(fallbackPath, payload, "utf8");
          log(dim(`write-output fallback to ${fallbackPath} (original failed: ${reason})`));
          return fallbackPath;
        } catch (innerError) {
          const innerReason = innerError instanceof Error ? innerError.message : String(innerError);
          log(
            dim(
              `write-output failed (${reason}); fallback failed (${innerReason}); session completed anyway.`,
            ),
          );
          return;
        }
      }
    }
    log(dim(`write-output failed (${reason}); session completed anyway.`));
  }
}

export function deriveModelOutputPath(
  basePath: string | undefined,
  model: string,
): string | undefined {
  if (!basePath) return undefined;
  const ext = path.extname(basePath);
  const stem = path.basename(basePath, ext);
  const dir = path.dirname(basePath);
  const suffix = ext.length > 0 ? `${stem}.${model}${ext}` : `${stem}.${model}`;
  return path.join(dir, suffix);
}

function isPermissionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: string }).code;
  return code === "EACCES" || code === "EPERM";
}

function buildFallbackPath(original: string): string | null {
  const ext = path.extname(original);
  const stem = path.basename(original, ext);
  const dir = getCwd();
  const candidate = ext ? `${stem}.fallback${ext}` : `${stem}.fallback`;
  const fallback = path.join(dir, candidate);
  const normalizedSessionsDir = path.resolve(sessionStore.sessionsDir());
  const normalizedFallback = path.resolve(fallback);
  if (
    normalizedFallback === normalizedSessionsDir ||
    normalizedFallback.startsWith(`${normalizedSessionsDir}${path.sep}`)
  ) {
    return null;
  }
  return fallback;
}
