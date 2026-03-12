import { stripProviderPrefix } from "./modelUtils.js";
import { resolveProvider } from "./providerResolver.js";
import { resolveGeminiModelId } from "./gemini.js";
import { MODEL_CONFIGS } from "./config.js";
import { isKnownModel } from "./modelResolver.js";
/**
 * Resolve the concrete API model ID from a user-facing model name.
 * - Google models pass through Gemini ID mapping.
 * - Known models use `apiModel` from MODEL_CONFIGS (if different).
 * - Everything else passes through unchanged.
 */
export function resolveEffectiveModelId(model) {
    const bare = stripProviderPrefix(model);
    if (resolveProvider(model) === "google") {
        return resolveGeminiModelId(model);
    }
    const config = isKnownModel(bare) ? MODEL_CONFIGS[bare] : undefined;
    return config?.apiModel ?? bare;
}
