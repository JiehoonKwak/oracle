import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export async function loadDefaultModels(env = process.env) {
    if (env.ORACLE_MODEL)
        return [env.ORACLE_MODEL];
    const modelsPath = path.resolve(__dirname, "../MODELS.md");
    try {
        const raw = await fs.readFile(modelsPath, "utf8");
        return raw
            .split("\n")
            .map((l) => l.replace(/#.*$/, "").trim())
            .filter(Boolean);
    }
    catch {
        return [];
    }
}
