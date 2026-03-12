import { InvalidArgumentError } from "commander";
import { parseDuration } from "../utils/duration.js";
import path from "node:path";
import fg from "fast-glob";
import { DEFAULT_MODEL, MODEL_CONFIGS } from "../oracle.js";
export function collectPaths(value, previous = []) {
    if (!value) {
        return previous;
    }
    const nextValues = Array.isArray(value) ? value : [value];
    return previous.concat(nextValues
        .flatMap((entry) => entry.split(","))
        .map((entry) => entry.trim())
        .filter(Boolean));
}
/**
 * Merge all path-like CLI inputs (file/include aliases) into a single list, preserving order.
 */
export function mergePathLikeOptions(file, include, filesAlias, pathAlias, pathsAlias) {
    const withFile = collectPaths(file, []);
    const withInclude = collectPaths(include, withFile);
    const withFilesAlias = collectPaths(filesAlias, withInclude);
    const withPathAlias = collectPaths(pathAlias, withFilesAlias);
    return collectPaths(pathsAlias, withPathAlias);
}
export function dedupePathInputs(inputs, { cwd = process.cwd() } = {}) {
    const deduped = [];
    const duplicates = [];
    const seen = new Set();
    for (const entry of inputs ?? []) {
        const raw = entry?.trim();
        if (!raw)
            continue;
        let key = raw;
        if (!raw.startsWith("!") && !fg.isDynamicPattern(raw)) {
            const absolute = path.isAbsolute(raw) ? raw : path.resolve(cwd, raw);
            key = `path:${path.normalize(absolute)}`;
        }
        else {
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
export function collectModelList(value, previous = []) {
    if (!value) {
        return previous;
    }
    const entries = value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    return previous.concat(entries);
}
export function parseFloatOption(value) {
    const parsed = Number.parseFloat(value);
    if (Number.isNaN(parsed)) {
        throw new InvalidArgumentError("Value must be a number.");
    }
    return parsed;
}
export function parseIntOption(value) {
    if (value == null) {
        return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
        throw new InvalidArgumentError("Value must be an integer.");
    }
    return parsed;
}
export function parseHeartbeatOption(value) {
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
export function usesDefaultStatusFilters(cmd) {
    const hoursSource = cmd.getOptionValueSource?.("hours") ?? "default";
    const limitSource = cmd.getOptionValueSource?.("limit") ?? "default";
    const allSource = cmd.getOptionValueSource?.("all") ?? "default";
    return hoursSource === "default" && limitSource === "default" && allSource === "default";
}
export function resolvePreviewMode(value) {
    if (typeof value === "string" && value.length > 0) {
        return value;
    }
    if (value === true) {
        return "summary";
    }
    return undefined;
}
export function parseSearchOption(value) {
    const normalized = value.trim().toLowerCase();
    if (["on", "true", "1", "yes"].includes(normalized)) {
        return true;
    }
    if (["off", "false", "0", "no"].includes(normalized)) {
        return false;
    }
    throw new InvalidArgumentError('Search mode must be "on" or "off".');
}
export function normalizeModelOption(value) {
    return (value ?? "").trim();
}
export function normalizeBaseUrl(value) {
    const trimmed = value?.trim();
    return trimmed?.length ? trimmed : undefined;
}
export function parseTimeoutOption(value) {
    if (value == null)
        return undefined;
    const normalized = value.trim().toLowerCase();
    if (normalized === "auto")
        return "auto";
    const parsed = Number.parseFloat(normalized);
    if (Number.isNaN(parsed) || parsed <= 0) {
        throw new InvalidArgumentError('Timeout must be a positive number of seconds or "auto".');
    }
    return parsed;
}
export function parseDurationOption(value, label) {
    if (value == null)
        return undefined;
    const trimmed = value.trim();
    if (!trimmed) {
        throw new InvalidArgumentError(`${label} must be a duration like 30m, 10s, 500ms, or 2h.`);
    }
    const parsed = parseDuration(trimmed, Number.NaN);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new InvalidArgumentError(`${label} must be a positive duration like 30m, 10s, 500ms, or 2h.`);
    }
    return parsed;
}
/**
 * Shared model alias resolution.
 * @param modelValue  - raw CLI input or UI label
 * @param opts.inferFromLabel - when true, uses lenient label matching
 *   (empty → DEFAULT_MODEL, extra aliases like "classic"/"thinking"/"fast",
 *    underscore variants, fallback → gpt-5.2).
 *   When false (default), uses strict CLI matching
 *   (codex-max guard, bare-word keywords, passthrough fallback).
 */
export function resolveApiModel(modelValue, opts) {
    const inferFromLabel = opts?.inferFromLabel ?? false;
    const normalized = normalizeModelOption(modelValue).toLowerCase();
    if (!normalized) {
        return inferFromLabel ? DEFAULT_MODEL : "";
    }
    // OpenRouter / prefixed IDs pass through unchanged
    if (normalized.includes("/"))
        return normalized;
    // Exact match in known model registry
    if (normalized in MODEL_CONFIGS)
        return normalized;
    // --- Provider-family aliases (shared) ---
    if (normalized.includes("grok"))
        return "grok-4.1";
    if (normalized.includes("claude") && normalized.includes("sonnet"))
        return "claude-4.5-sonnet";
    if (normalized.includes("claude") && normalized.includes("opus"))
        return "claude-4.1-opus";
    // CLI-only bare keyword matching
    if (!inferFromLabel) {
        if (normalized === "claude" ||
            normalized === "sonnet" ||
            /(^|\b)sonnet(\b|$)/.test(normalized)) {
            return "claude-4.5-sonnet";
        }
        if (normalized === "opus" || normalized === "claude-4.1")
            return "claude-4.1-opus";
    }
    // Codex
    if (normalized.includes("codex")) {
        if (!inferFromLabel && normalized.includes("max")) {
            throw new InvalidArgumentError("gpt-5.1-codex-max is not available yet. OpenAI has not released the API.");
        }
        return "gpt-5.1-codex";
    }
    if (normalized.includes("gemini"))
        return "gemini-3-pro";
    // Label-only: "classic" alias
    if (inferFromLabel && normalized.includes("classic"))
        return "gpt-5-pro";
    // --- Version-specific matching ---
    const has52 = normalized.includes("5.2") || (inferFromLabel && normalized.includes("5_2"));
    const has51 = normalized.includes("5.1") || (inferFromLabel && normalized.includes("5_1"));
    if (has52 && normalized.includes("pro"))
        return "gpt-5.2-pro";
    if (has52 && normalized.includes("instant"))
        return "gpt-5.2-instant";
    // 5.0 / 5-pro
    if (normalized.includes("5.0") || normalized.includes("5-pro"))
        return "gpt-5-pro";
    if (!inferFromLabel && (normalized === "gpt-5-pro" || normalized === "gpt-5"))
        return "gpt-5-pro";
    if (normalized.includes("gpt-5") && normalized.includes("pro") && !has51 && !has52) {
        return "gpt-5-pro";
    }
    if (has51 && normalized.includes("pro"))
        return "gpt-5.1-pro";
    if (normalized.includes("pro"))
        return "gpt-5.2-pro";
    // Label-only: remaining version aliases
    if (inferFromLabel) {
        if (has51)
            return "gpt-5.1";
        if (normalized.includes("instant") || normalized.includes("fast"))
            return "gpt-5.2-instant";
        return "gpt-5.2";
    }
    // CLI mode: passthrough for custom/OpenRouter model IDs
    return normalized;
}
/** Lenient label→model resolution. Thin wrapper around resolveApiModel. */
export function inferModelFromLabel(modelValue) {
    return resolveApiModel(modelValue, { inferFromLabel: true });
}
