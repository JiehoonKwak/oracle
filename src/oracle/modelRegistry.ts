import { countTokens as countTokensGpt5 } from "gpt-tokenizer/model/gpt-5";
import { countTokens as countTokensGpt5Pro } from "gpt-tokenizer/model/gpt-5-pro";
import { countTokens as countTokensAnthropicRaw } from "@anthropic-ai/tokenizer";
import { stringifyTokenizerInput } from "./tokenStringifier.js";
import type {
  ModelConfig,
  ModelName,
  KnownModelName,
  ProModelName,
  TokenizerFn,
  ReasoningEffort,
  ToolConfig,
} from "./types.js";
import bundledModelsJson from "./models.json" with { type: "json" };
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// --- Tokenizer lookup ---

const countTokensAnthropic: TokenizerFn = (input: unknown): number =>
  countTokensAnthropicRaw(stringifyTokenizerInput(input));

const TOKENIZER_MAP: Record<string, TokenizerFn> = {
  gpt5: countTokensGpt5 as TokenizerFn,
  gpt5pro: countTokensGpt5Pro as TokenizerFn,
  anthropic: countTokensAnthropic,
};

const DEFAULT_TOKENIZER: TokenizerFn = countTokensGpt5Pro as TokenizerFn;

function resolveTokenizer(key: string | undefined): TokenizerFn {
  if (!key) return DEFAULT_TOKENIZER;
  return TOKENIZER_MAP[key] ?? DEFAULT_TOKENIZER;
}

// --- JSON schema ---

interface ModelJsonEntry {
  apiModel?: string;
  provider?: string;
  tokenizer?: string;
  inputLimit?: number;
  pricing?: { input: number; output: number };
  pro?: boolean;
  reasoning?: { effort: string } | null;
  supportsBackground?: boolean;
  supportsSearch?: boolean;
  searchToolType?: string;
}

// --- Load user overrides ---

function loadUserModels(): Record<string, ModelJsonEntry> {
  const oracleHome = process.env.ORACLE_HOME_DIR ?? path.join(os.homedir(), ".oracle");
  const userPath = path.join(oracleHome, "models.json");
  try {
    const raw = fs.readFileSync(userPath, "utf8");
    return JSON.parse(raw) as Record<string, ModelJsonEntry>;
  } catch {
    return {};
  }
}

// --- Hydrate ---

function hydrateModelConfig(modelName: string, entry: ModelJsonEntry): ModelConfig {
  return {
    model: modelName as ModelName,
    apiModel: entry.apiModel,
    provider: (entry.provider as ModelConfig["provider"]) ?? "other",
    tokenizer: resolveTokenizer(entry.tokenizer),
    inputLimit: entry.inputLimit ?? 200_000,
    pricing: entry.pricing
      ? {
          inputPerToken: entry.pricing.input / 1_000_000,
          outputPerToken: entry.pricing.output / 1_000_000,
        }
      : null,
    reasoning: entry.reasoning ? { effort: entry.reasoning.effort as ReasoningEffort } : null,
    supportsBackground: entry.supportsBackground,
    supportsSearch: entry.supportsSearch,
    searchToolType: entry.searchToolType as ToolConfig["type"] | undefined,
  };
}

// --- Build registry ---

function buildRegistry(): {
  configs: Record<KnownModelName, ModelConfig>;
  proModels: Set<ProModelName>;
} {
  const bundled = bundledModelsJson as Record<string, ModelJsonEntry>;
  const userOverrides = loadUserModels();
  const merged = { ...bundled, ...userOverrides };

  const configs = {} as Record<string, ModelConfig>;
  const proModels = new Set<ProModelName>();

  for (const [name, entry] of Object.entries(merged)) {
    // Deep-merge: user override on top of bundled
    const base = bundled[name];
    const effective = base && userOverrides[name] ? { ...base, ...userOverrides[name] } : entry;

    configs[name] = hydrateModelConfig(name, effective);
    if (effective.pro) {
      proModels.add(name as ProModelName);
    }
  }

  return {
    configs: configs as Record<KnownModelName, ModelConfig>,
    proModels,
  };
}

const registry = buildRegistry();

export const MODEL_CONFIGS = registry.configs;
export const PRO_MODELS = registry.proModels;
