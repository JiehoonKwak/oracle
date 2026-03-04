import fs from "node:fs/promises";
import path from "node:path";
import JSON5 from "json5";
import { getOracleHomeDir } from "./oracleHome.js";

export interface NotifyConfig {
  enabled?: boolean;
  sound?: boolean;
  muteIn?: Array<"CI" | "SSH">;
}

export interface AzureConfig {
  endpoint?: string;
  deployment?: string;
  apiVersion?: string;
}

export interface UserConfig {
  models?: string[];
  base_url?: string;
  apiBaseUrl?: string;
  output_format?: "text" | "json";
  search?: "on" | "off";
  heartbeatSeconds?: number;
  filesReport?: boolean;
  background?: boolean;
  promptSuffix?: string;
  azure?: AzureConfig;
  sessionRetentionHours?: number;
  notify?: NotifyConfig;
}

function resolveConfigPath(): string {
  return path.join(getOracleHomeDir(), "config.json");
}

function applyEnvOverrides(config: UserConfig, env = process.env): UserConfig {
  const overridden = { ...config };
  if (env.ORACLE_MODEL) {
    overridden.models = [env.ORACLE_MODEL];
  }
  if (env.ORACLE_BASE_URL) {
    overridden.base_url = env.ORACLE_BASE_URL;
  }
  return overridden;
}

export interface LoadConfigResult {
  config: UserConfig;
  path: string;
  loaded: boolean;
}

export async function loadUserConfig(): Promise<LoadConfigResult> {
  const CONFIG_PATH = resolveConfigPath();
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const parsed = JSON5.parse(raw) as UserConfig;
    const config = applyEnvOverrides(parsed ?? {});
    return { config, path: CONFIG_PATH, loaded: true };
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOENT") {
      return { config: applyEnvOverrides({}), path: CONFIG_PATH, loaded: false };
    }
    console.warn(
      `Failed to read ${CONFIG_PATH}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { config: applyEnvOverrides({}), path: CONFIG_PATH, loaded: false };
  }
}
