import type { RunOracleOptions, ModelName } from "../oracle.js";
import { DEFAULT_MODEL, MODEL_CONFIGS } from "../oracle.js";
import type { UserConfig } from "../config.js";
import { normalizeModelOption, resolveApiModel, normalizeBaseUrl } from "./options.js";
import { resolveGeminiModelId } from "../oracle/gemini.js";
import { PromptValidationError } from "../oracle/errors.js";
import { resolveProvider } from "../oracle/providerResolver.js";

export type EngineMode = "api";

export interface ResolveRunOptionsInput {
  prompt: string;
  files?: string[];
  model?: string;
  models?: string[];
  engine?: EngineMode;
  userConfig?: UserConfig;
  env?: NodeJS.ProcessEnv;
}

export interface ResolvedRunOptions {
  runOptions: RunOracleOptions;
  resolvedEngine: EngineMode;
  engineCoercedToApi?: boolean;
}

export function resolveRunOptionsFromConfig({
  prompt,
  files = [],
  model,
  models,
  userConfig,
  env = process.env,
}: ResolveRunOptionsInput): ResolvedRunOptions {
  const resolvedEngine: EngineMode = "api";
  const requestedModelList = Array.isArray(models) ? models : [];
  const normalizedRequestedModels = requestedModelList
    .map((entry) => normalizeModelOption(entry))
    .filter(Boolean);

  const configDefaultModel = userConfig?.models?.[0];
  const cliModelArg = normalizeModelOption(model ?? configDefaultModel) || DEFAULT_MODEL;
  const inferredModel = resolveApiModel(cliModelArg);
  const resolvedModel = inferredModel;
  const isClaude = resolveProvider(resolvedModel) === "anthropic";
  const isGrok = resolveProvider(resolvedModel) === "xai";

  const allModels: ModelName[] =
    normalizedRequestedModels.length > 0
      ? Array.from(new Set(normalizedRequestedModels.map((entry) => resolveApiModel(entry))))
      : [resolvedModel];

  const fixedEngine: EngineMode = "api";

  const promptWithSuffix =
    userConfig?.promptSuffix && userConfig.promptSuffix.trim().length > 0
      ? `${prompt.trim()}\n${userConfig.promptSuffix}`
      : prompt;

  const search = userConfig?.search !== "off";

  const heartbeatIntervalMs =
    userConfig?.heartbeatSeconds !== undefined ? userConfig.heartbeatSeconds * 1000 : 30_000;

  const baseUrl = normalizeBaseUrl(
    userConfig?.apiBaseUrl ??
      (isClaude ? env.ANTHROPIC_BASE_URL : isGrok ? env.XAI_BASE_URL : env.OPENAI_BASE_URL),
  );
  const uniqueMultiModels: ModelName[] = normalizedRequestedModels.length > 0 ? allModels : [];

  const chosenModel: ModelName = uniqueMultiModels[0] ?? resolvedModel;
  const effectiveModelId = resolveEffectiveModelId(chosenModel);

  const runOptions: RunOracleOptions = {
    prompt: promptWithSuffix,
    model: chosenModel,
    models: uniqueMultiModels.length > 0 ? uniqueMultiModels : undefined,
    file: files ?? [],
    search,
    heartbeatIntervalMs,
    filesReport: userConfig?.filesReport,
    background: userConfig?.background,
    baseUrl,
    effectiveModelId,
  };

  return { runOptions, resolvedEngine: fixedEngine };
}

function resolveEngineWithConfig(_args: {
  engine?: EngineMode;
  configEngine?: EngineMode;
  env: NodeJS.ProcessEnv;
}): EngineMode {
  return "api";
}

function resolveEffectiveModelId(model: ModelName): string {
  if (typeof model === "string" && resolveProvider(model) === "google") {
    return resolveGeminiModelId(model);
  }
  const config = MODEL_CONFIGS[model as keyof typeof MODEL_CONFIGS];
  return config?.apiModel ?? model;
}
