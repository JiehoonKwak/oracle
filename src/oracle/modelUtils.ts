/**
 * Strip OpenRouter-style provider prefix from a model name.
 * e.g. "google/gemini-3.1-pro-preview" → "gemini-3.1-pro-preview"
 */
export function stripProviderPrefix(model: string): string {
  return model.includes("/") ? model.split("/").slice(1).join("/") : model;
}
