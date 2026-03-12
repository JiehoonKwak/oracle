import { countTokens as countTokensGpt5 } from "gpt-tokenizer/model/gpt-5";
import { countTokens as countTokensGpt5Pro } from "gpt-tokenizer/model/gpt-5-pro";
import { countTokens as countTokensAnthropicRaw } from "@anthropic-ai/tokenizer";
import { stringifyTokenizerInput } from "./tokenStringifier.js";
import bundledModelsJson from "./models.json" with { type: "json" };
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
// --- Tokenizer lookup ---
const countTokensAnthropic = (input) => countTokensAnthropicRaw(stringifyTokenizerInput(input));
const TOKENIZER_MAP = {
    gpt5: countTokensGpt5,
    gpt5pro: countTokensGpt5Pro,
    anthropic: countTokensAnthropic,
};
const DEFAULT_TOKENIZER = countTokensGpt5Pro;
function resolveTokenizer(key) {
    if (!key)
        return DEFAULT_TOKENIZER;
    return TOKENIZER_MAP[key] ?? DEFAULT_TOKENIZER;
}
// --- Load user overrides ---
function loadUserModels() {
    const oracleHome = process.env.ORACLE_HOME_DIR ?? path.join(os.homedir(), ".oracle");
    const userPath = path.join(oracleHome, "models.json");
    try {
        const raw = fs.readFileSync(userPath, "utf8");
        return JSON.parse(raw);
    }
    catch {
        return {};
    }
}
// --- Hydrate ---
function hydrateModelConfig(modelName, entry) {
    return {
        model: modelName,
        apiModel: entry.apiModel,
        provider: entry.provider ?? "other",
        tokenizer: resolveTokenizer(entry.tokenizer),
        inputLimit: entry.inputLimit ?? 200_000,
        pricing: entry.pricing
            ? {
                inputPerToken: entry.pricing.input / 1_000_000,
                outputPerToken: entry.pricing.output / 1_000_000,
            }
            : null,
        reasoning: entry.reasoning ? { effort: entry.reasoning.effort } : null,
        supportsBackground: entry.supportsBackground,
        supportsSearch: entry.supportsSearch,
        searchToolType: entry.searchToolType,
    };
}
// --- Build registry ---
function buildRegistry() {
    const bundled = bundledModelsJson;
    const userOverrides = loadUserModels();
    const merged = { ...bundled, ...userOverrides };
    const configs = {};
    const proModels = new Set();
    for (const [name, entry] of Object.entries(merged)) {
        // Deep-merge: user override on top of bundled
        const base = bundled[name];
        const effective = base && userOverrides[name] ? { ...base, ...userOverrides[name] } : entry;
        configs[name] = hydrateModelConfig(name, effective);
        if (effective.pro) {
            proModels.add(name);
        }
    }
    return {
        configs: configs,
        proModels,
    };
}
const registry = buildRegistry();
export const MODEL_CONFIGS = registry.configs;
export const PRO_MODELS = registry.proModels;
