import type { ModelName } from "./types.js";
export { MODEL_CONFIGS, PRO_MODELS } from "./modelRegistry.js";

export const DEFAULT_MODEL: ModelName = "google/gemini-3.1-pro-preview";

export const DEFAULT_SYSTEM_PROMPT = [
  "You are Oracle, a focused one-shot problem solver.",
  "Emphasize direct answers and cite any files referenced.",
].join(" ");

export const TOKENIZER_OPTIONS = { allowedSpecial: "all" } as const;
