import { InvalidArgumentError, type Command } from "commander";
import { parseDuration } from "../utils/duration.js";
import path from "node:path";
import fg from "fast-glob";
import type { ModelName } from "../oracle.js";
import { MODEL_CONFIGS } from "../oracle.js";

export function collectPaths(
  value: string | string[] | undefined,
  previous: string[] = [],
): string[] {
  if (!value) {
    return previous;
  }
  const nextValues = Array.isArray(value) ? value : [value];
  return previous.concat(
    nextValues
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

/**
 * Merge all path-like CLI inputs (file/include aliases) into a single list, preserving order.
 */
export function mergePathLikeOptions(
  file?: string[],
  include?: string[],
  filesAlias?: string[],
  pathAlias?: string[],
  pathsAlias?: string[],
): string[] {
  const withFile = collectPaths(file, []);
  const withInclude = collectPaths(include, withFile);
  const withFilesAlias = collectPaths(filesAlias, withInclude);
  const withPathAlias = collectPaths(pathAlias, withFilesAlias);
  return collectPaths(pathsAlias, withPathAlias);
}

export function dedupePathInputs(
  inputs: string[],
  { cwd = process.cwd() }: { cwd?: string } = {},
): { deduped: string[]; duplicates: string[] } {
  const deduped: string[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();

  for (const entry of inputs ?? []) {
    const raw = entry?.trim();
    if (!raw) continue;

    let key = raw;
    if (!raw.startsWith("!") && !fg.isDynamicPattern(raw)) {
      const absolute = path.isAbsolute(raw) ? raw : path.resolve(cwd, raw);
      key = `path:${path.normalize(absolute)}`;
    } else {
      key = `pattern:${raw}`;
    }

    if (seen.has(key)) {
      duplicates.push(raw);
      continue;
    }
    seen.add(key);
    deduped.push(raw);
  }

  return { deduped, duplicates };
}

export function collectModelList(value: string, previous: string[] = []): string[] {
  if (!value) {
    return previous;
  }
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return previous.concat(entries);
}

export function parseFloatOption(value: string): number {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    throw new InvalidArgumentError("Value must be a number.");
  }
  return parsed;
}

export function parseIntOption(value: string | undefined): number | undefined {
  if (value == null) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new InvalidArgumentError("Value must be an integer.");
  }
  return parsed;
}

export function parseHeartbeatOption(value: string | number | undefined): number {
  if (value == null) {
    return 30;
  }
  if (typeof value === "number") {
    if (Number.isNaN(value) || value < 0) {
      throw new InvalidArgumentError("Heartbeat interval must be zero or a positive number.");
    }
    return value;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return 30;
  }
  if (normalized === "false" || normalized === "off") {
    return 0;
  }
  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new InvalidArgumentError("Heartbeat interval must be zero or a positive number.");
  }
  return parsed;
}

export function usesDefaultStatusFilters(cmd: Command): boolean {
  const hoursSource = cmd.getOptionValueSource?.("hours") ?? "default";
  const limitSource = cmd.getOptionValueSource?.("limit") ?? "default";
  const allSource = cmd.getOptionValueSource?.("all") ?? "default";
  return hoursSource === "default" && limitSource === "default" && allSource === "default";
}

export function parseSearchOption(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (["on", "true", "1", "yes"].includes(normalized)) {
    return true;
  }
  if (["off", "false", "0", "no"].includes(normalized)) {
    return false;
  }
  throw new InvalidArgumentError('Search mode must be "on" or "off".');
}

export function normalizeModelOption(value: string | undefined): string {
  return (value ?? "").trim();
}

export function normalizeBaseUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed?.length ? trimmed : undefined;
}

export function parseTimeoutOption(value: string | undefined): number | "auto" | undefined {
  if (value == null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "auto") return "auto";
  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new InvalidArgumentError('Timeout must be a positive number of seconds or "auto".');
  }
  return parsed;
}

export function parseDurationOption(value: string | undefined, label: string): number | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) {
    throw new InvalidArgumentError(`${label} must be a duration like 30m, 10s, 500ms, or 2h.`);
  }
  const parsed = parseDuration(trimmed, Number.NaN);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new InvalidArgumentError(
      `${label} must be a positive duration like 30m, 10s, 500ms, or 2h.`,
    );
  }
  return parsed;
}

/**
 * Resolve a CLI model input to a ModelName.
 * - Empty → empty string (caller should apply DEFAULT_MODEL).
 * - Slash-prefixed → OpenRouter passthrough.
 * - Exact match in MODEL_CONFIGS → known model.
 * - Everything else → passthrough (preserves user-specified model IDs verbatim).
 */
export function resolveApiModel(modelValue: string): ModelName {
  const normalized = normalizeModelOption(modelValue).toLowerCase();
  if (!normalized) return "" as ModelName;
  // OpenRouter / prefixed IDs pass through unchanged
  if (normalized.includes("/")) return normalized as ModelName;
  // Exact match in known model registry
  if (normalized in MODEL_CONFIGS) return normalized as ModelName;
  // Passthrough — preserves arbitrary model IDs (e.g. grok-4.20-multi-agent-beta-0309)
  return normalized as ModelName;
}
