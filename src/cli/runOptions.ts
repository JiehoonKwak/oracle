import type { RunOracleOptions, ModelName } from "../oracle.js";
import { DEFAULT_MODEL } from "../oracle.js";
import { normalizeModelOption, resolveApiModel } from "./options.js";
import { resolveEffectiveModelId } from "../oracle/effectiveModelId.js";

export interface ResolveRunOptionsInput {
  prompt: string;
  files?: string[];
  model?: string;
  models?: string[];
  env?: NodeJS.ProcessEnv;
}

export interface ResolvedRunOptions {
  runOptions: RunOracleOptions;
}

export function resolveRunOptionsFromConfig({
  prompt,
  files = [],
  model,
  models,
  env = process.env,
}: ResolveRunOptionsInput): ResolvedRunOptions {
  const requestedModelList = Array.isArray(models) ? models : [];
  const normalizedRequestedModels = requestedModelList
    .map((entry) => normalizeModelOption(entry))
    .filter(Boolean);

  const cliModelArg = normalizeModelOption(model) || DEFAULT_MODEL;
  const resolvedModel = resolveApiModel(cliModelArg);

  const allModels: ModelName[] =
    normalizedRequestedModels.length > 0
      ? Array.from(new Set(normalizedRequestedModels.map((entry) => resolveApiModel(entry))))
      : [resolvedModel];

  const uniqueMultiModels: ModelName[] = normalizedRequestedModels.length > 0 ? allModels : [];

  const chosenModel: ModelName = uniqueMultiModels[0] ?? resolvedModel;
  const effectiveModelId = resolveEffectiveModelId(chosenModel);

  const runOptions: RunOracleOptions = {
    prompt,
    model: chosenModel,
    models: uniqueMultiModels.length > 0 ? uniqueMultiModels : undefined,
    file: files ?? [],
    search: true,
    heartbeatIntervalMs: 30_000,
    baseUrl: undefined,
    effectiveModelId,
  };

  return { runOptions };
}
