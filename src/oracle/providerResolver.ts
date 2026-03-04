import { stripProviderPrefix } from "./modelUtils.js";
import { MODEL_CONFIGS } from "./config.js";
import type { KnownModelName } from "./types.js";

export type ModelProvider = "openai" | "google" | "anthropic" | "xai" | "other";

export function resolveProvider(model: string): ModelProvider {
  const bare = stripProviderPrefix(model);
  // Check the authoritative model registry first
  const config = MODEL_CONFIGS[bare as KnownModelName];
  if (config?.provider) return config.provider;
  // Fall back to prefix matching for unknown/custom models
  if (bare.startsWith("gemini")) return "google";
  if (bare.startsWith("claude")) return "anthropic";
  if (bare.startsWith("grok")) return "xai";
  if (
    bare.startsWith("gpt") ||
    bare.startsWith("o1") ||
    bare.startsWith("o3") ||
    bare.startsWith("o4")
  )
    return "openai";
  return "other";
}
