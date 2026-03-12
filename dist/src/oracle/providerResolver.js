import { stripProviderPrefix } from "./modelUtils.js";
import { MODEL_CONFIGS } from "./config.js";
export function resolveProvider(model) {
    const bare = stripProviderPrefix(model);
    // Check the authoritative model registry first
    const config = MODEL_CONFIGS[bare];
    if (config?.provider)
        return config.provider;
    // Fall back to prefix matching for unknown/custom models
    if (bare.startsWith("gemini"))
        return "google";
    if (bare.startsWith("claude"))
        return "anthropic";
    if (bare.startsWith("grok"))
        return "xai";
    if (bare.startsWith("gpt") ||
        bare.startsWith("o1") ||
        bare.startsWith("o3") ||
        bare.startsWith("o4"))
        return "openai";
    return "other";
}
