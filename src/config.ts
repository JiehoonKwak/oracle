import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseModelsFile(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.replace(/#.*$/, "").trim())
    .filter(Boolean);
}

export async function loadDefaultModels(env = process.env): Promise<string[]> {
  if (env.ORACLE_MODEL) return [env.ORACLE_MODEL];

  // User-level override via ORACLE_MODELS_FILE (e.g. ~/.agents/skills/oracle/MODELS.md)
  if (env.ORACLE_MODELS_FILE) {
    try {
      return parseModelsFile(await fs.readFile(env.ORACLE_MODELS_FILE, "utf8"));
    } catch { /* fall through to bundled */ }
  }

  // Bundled default
  try {
    return parseModelsFile(await fs.readFile(path.resolve(__dirname, "../MODELS.md"), "utf8"));
  } catch {
    return [];
  }
}
