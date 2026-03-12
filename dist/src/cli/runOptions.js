import { DEFAULT_MODEL } from "../oracle.js";
import { normalizeModelOption, resolveApiModel } from "./options.js";
import { resolveEffectiveModelId } from "../oracle/effectiveModelId.js";
export function resolveRunOptionsFromConfig({ prompt, files = [], model, models, env = process.env, }) {
    const requestedModelList = Array.isArray(models) ? models : [];
    const normalizedRequestedModels = requestedModelList
        .map((entry) => normalizeModelOption(entry))
        .filter(Boolean);
    const cliModelArg = normalizeModelOption(model) || DEFAULT_MODEL;
    const resolvedModel = resolveApiModel(cliModelArg);
    const allModels = normalizedRequestedModels.length > 0
        ? Array.from(new Set(normalizedRequestedModels.map((entry) => resolveApiModel(entry))))
        : [resolvedModel];
    const uniqueMultiModels = normalizedRequestedModels.length > 0 ? allModels : [];
    const chosenModel = uniqueMultiModels[0] ?? resolvedModel;
    const effectiveModelId = resolveEffectiveModelId(chosenModel);
    const runOptions = {
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
