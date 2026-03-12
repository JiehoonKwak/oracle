#!/usr/bin/env node

// bin/oracle-cli.ts
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath as fileURLToPath3 } from "node:url";
import { once } from "node:events";
import { Command, Option } from "commander";

// src/cli/promptRequirement.ts
function shouldRequirePrompt(rawArgs, options) {
  if (rawArgs.length === 0) {
    return !options.prompt;
  }
  const firstArg = rawArgs[0];
  const bypassPrompt = Boolean(
    options.session || options.execSession || options.status || options.debugHelp || firstArg === "status" || firstArg === "session"
  );
  const requiresPrompt = options.renderMarkdown || Boolean(options.preview) || Boolean(options.dryRun) || !bypassPrompt;
  return requiresPrompt && !options.prompt && !options.promptFile;
}

// bin/oracle-cli.ts
import chalk11 from "chalk";

// src/sessionManager.ts
import path7 from "node:path";
import fs4 from "node:fs/promises";
import { createWriteStream } from "node:fs";

// src/oracle/modelRegistry.ts
import { countTokens as countTokensGpt5 } from "gpt-tokenizer/model/gpt-5";
import { countTokens as countTokensGpt5Pro } from "gpt-tokenizer/model/gpt-5-pro";
import { countTokens as countTokensAnthropicRaw } from "@anthropic-ai/tokenizer";

// src/oracle/tokenStringifier.ts
function stringifyTokenizerInput(input) {
  if (typeof input === "string") return input;
  if (input === null || input === void 0) return "";
  if (typeof input === "number" || typeof input === "boolean" || typeof input === "bigint") {
    return String(input);
  }
  if (typeof input === "object") {
    try {
      return JSON.stringify(input);
    } catch {
    }
  }
  if (typeof input === "function") {
    return input.toString();
  }
  return String(input);
}

// src/oracle/models.json
var models_default = {
  "gpt-5.1-pro": {
    apiModel: "gpt-5.2-pro",
    provider: "openai",
    tokenizer: "gpt5pro",
    inputLimit: 196e3,
    pricing: {
      input: 21,
      output: 168
    },
    pro: true,
    reasoning: null
  },
  "gpt-5-pro": {
    provider: "openai",
    tokenizer: "gpt5pro",
    inputLimit: 196e3,
    pricing: {
      input: 15,
      output: 120
    },
    pro: true,
    reasoning: null
  },
  "gpt-5.1": {
    provider: "openai",
    tokenizer: "gpt5",
    inputLimit: 196e3,
    pricing: {
      input: 1.25,
      output: 10
    },
    reasoning: {
      effort: "high"
    }
  },
  "gpt-5.1-codex": {
    provider: "openai",
    tokenizer: "gpt5",
    inputLimit: 196e3,
    pricing: {
      input: 1.25,
      output: 10
    },
    reasoning: {
      effort: "high"
    }
  },
  "gpt-5.2": {
    provider: "openai",
    tokenizer: "gpt5",
    inputLimit: 196e3,
    pricing: {
      input: 1.75,
      output: 14
    },
    reasoning: {
      effort: "xhigh"
    }
  },
  "gpt-5.2-instant": {
    apiModel: "gpt-5.2-chat-latest",
    provider: "openai",
    tokenizer: "gpt5",
    inputLimit: 196e3,
    pricing: {
      input: 1.75,
      output: 14
    },
    reasoning: null
  },
  "gpt-5.2-pro": {
    provider: "openai",
    tokenizer: "gpt5pro",
    inputLimit: 196e3,
    pricing: {
      input: 21,
      output: 168
    },
    pro: true,
    reasoning: {
      effort: "xhigh"
    }
  },
  "gemini-3-pro": {
    apiModel: "gemini-3-pro-preview",
    provider: "google",
    tokenizer: "gpt5pro",
    inputLimit: 2e5,
    pricing: {
      input: 2,
      output: 12
    },
    reasoning: null,
    supportsBackground: false,
    supportsSearch: true
  },
  "claude-4.5-sonnet": {
    apiModel: "claude-sonnet-4-5",
    provider: "anthropic",
    tokenizer: "anthropic",
    inputLimit: 2e5,
    pricing: {
      input: 3,
      output: 15
    },
    pro: true,
    reasoning: null,
    supportsBackground: false,
    supportsSearch: false
  },
  "claude-4.1-opus": {
    apiModel: "claude-opus-4-1",
    provider: "anthropic",
    tokenizer: "anthropic",
    inputLimit: 2e5,
    pricing: {
      input: 15,
      output: 75
    },
    pro: true,
    reasoning: {
      effort: "high"
    },
    supportsBackground: false,
    supportsSearch: false
  },
  "grok-4.1": {
    apiModel: "grok-4-1-fast-reasoning",
    provider: "xai",
    tokenizer: "gpt5pro",
    inputLimit: 2e6,
    pricing: {
      input: 0.2,
      output: 0.5
    },
    reasoning: null,
    supportsBackground: false,
    supportsSearch: true,
    searchToolType: "web_search",
    searchTools: [
      "web_search",
      "x_search"
    ]
  }
};

// src/oracle/modelRegistry.ts
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
var countTokensAnthropic = (input) => countTokensAnthropicRaw(stringifyTokenizerInput(input));
var TOKENIZER_MAP = {
  gpt5: countTokensGpt5,
  gpt5pro: countTokensGpt5Pro,
  anthropic: countTokensAnthropic
};
var DEFAULT_TOKENIZER = countTokensGpt5Pro;
function resolveTokenizer(key) {
  if (!key) return DEFAULT_TOKENIZER;
  return TOKENIZER_MAP[key] ?? DEFAULT_TOKENIZER;
}
function loadUserModels() {
  const oracleHome = process.env.ORACLE_HOME_DIR ?? path.join(os.homedir(), ".oracle");
  const userPath = path.join(oracleHome, "models.json");
  try {
    const raw = fs.readFileSync(userPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function hydrateModelConfig(modelName, entry) {
  return {
    model: modelName,
    apiModel: entry.apiModel,
    provider: entry.provider ?? "other",
    tokenizer: resolveTokenizer(entry.tokenizer),
    inputLimit: entry.inputLimit ?? 2e5,
    pricing: entry.pricing ? {
      inputPerToken: entry.pricing.input / 1e6,
      outputPerToken: entry.pricing.output / 1e6
    } : null,
    reasoning: entry.reasoning ? { effort: entry.reasoning.effort } : null,
    supportsBackground: entry.supportsBackground,
    supportsSearch: entry.supportsSearch,
    searchToolType: entry.searchToolType,
    searchTools: entry.searchTools
  };
}
function buildRegistry() {
  const bundled = models_default;
  const userOverrides = loadUserModels();
  const merged = { ...bundled, ...userOverrides };
  const configs = {};
  const proModels = /* @__PURE__ */ new Set();
  for (const [name, entry] of Object.entries(merged)) {
    const base2 = bundled[name];
    const effective = base2 && userOverrides[name] ? { ...base2, ...userOverrides[name] } : entry;
    configs[name] = hydrateModelConfig(name, effective);
    if (effective.pro) {
      proModels.add(name);
    }
  }
  return {
    configs,
    proModels
  };
}
var registry = buildRegistry();
var MODEL_CONFIGS = registry.configs;
var PRO_MODELS = registry.proModels;

// src/oracle/config.ts
var DEFAULT_MODEL = "google/gemini-3.1-pro-preview";
var DEFAULT_SYSTEM_PROMPT = [
  "You are Oracle, a focused one-shot problem solver.",
  "Emphasize direct answers and cite any files referenced."
].join(" ");
var TOKENIZER_OPTIONS = { allowedSpecial: "all" };

// src/oracle/files.ts
import fs2 from "node:fs/promises";
import path2 from "node:path";
import fg from "fast-glob";

// src/oracle/errors.ts
import { APIConnectionError, APIConnectionTimeoutError, APIUserAbortError } from "openai";
import { APIError } from "openai/error";

// src/oracle/format.ts
function formatUSD(value) {
  if (!Number.isFinite(value)) {
    return "n/a";
  }
  return `$${value.toFixed(4)}`;
}
function formatElapsed(ms) {
  if (ms >= 60 * 60 * 1e3) {
    const hours = Math.floor(ms / (60 * 60 * 1e3));
    const minutes = Math.floor(ms % (60 * 60 * 1e3) / (60 * 1e3));
    return `${hours}h ${minutes}m`;
  }
  if (ms >= 60 * 1e3) {
    const minutes = Math.floor(ms / (60 * 1e3));
    const seconds = Math.floor(ms % (60 * 1e3) / 1e3);
    return `${minutes}m ${seconds}s`;
  }
  if (ms >= 1e3) {
    return `${Math.floor(ms / 1e3)}s`;
  }
  return `${Math.round(ms)}ms`;
}

// src/oracle/errors.ts
var OracleUserError = class extends Error {
  category;
  details;
  constructor(category, message, details, cause) {
    super(message);
    this.name = "OracleUserError";
    this.category = category;
    this.details = details;
    if (cause) {
      this.cause = cause;
    }
  }
};
var FileValidationError = class extends OracleUserError {
  constructor(message, details, cause) {
    super("file-validation", message, details, cause);
    this.name = "FileValidationError";
  }
};
var PromptValidationError = class extends OracleUserError {
  constructor(message, details, cause) {
    super("prompt-validation", message, details, cause);
    this.name = "PromptValidationError";
  }
};
function asOracleUserError(error) {
  if (error instanceof OracleUserError) {
    return error;
  }
  return null;
}
var OracleTransportError = class extends Error {
  reason;
  constructor(reason, message, cause) {
    super(message);
    this.name = "OracleTransportError";
    this.reason = reason;
    if (cause) {
      this.cause = cause;
    }
  }
};
var OracleResponseError = class extends Error {
  metadata;
  response;
  constructor(message, response) {
    super(message);
    this.name = "OracleResponseError";
    this.response = response;
    this.metadata = extractResponseMetadata(response);
  }
};
function extractResponseMetadata(response) {
  if (!response) {
    return {};
  }
  const metadata = {
    responseId: response.id,
    status: response.status,
    incompleteReason: response.incomplete_details?.reason ?? void 0
  };
  const requestId = response._request_id;
  if (requestId !== void 0) {
    metadata.requestId = requestId;
  }
  return metadata;
}
function toTransportError(error, model) {
  if (error instanceof OracleTransportError) {
    return error;
  }
  if (error instanceof APIConnectionTimeoutError) {
    return new OracleTransportError(
      "client-timeout",
      "OpenAI request timed out before completion.",
      error
    );
  }
  if (error instanceof APIUserAbortError) {
    return new OracleTransportError(
      "client-abort",
      "The request was aborted before OpenAI finished responding.",
      error
    );
  }
  if (error instanceof APIConnectionError) {
    return new OracleTransportError(
      "connection-lost",
      "Connection to OpenAI dropped before the response completed.",
      error
    );
  }
  const isApiError = error instanceof APIError || error?.name === "APIError";
  if (isApiError) {
    const apiError = error;
    const code = apiError.code ?? apiError.error?.code;
    const messageText = apiError.message?.toLowerCase?.() ?? "";
    const apiMessage = apiError.error?.message || apiError.message || (apiError.status ? `${apiError.status} OpenAI API error` : "OpenAI API error");
    if (model === "gpt-5.2-pro" && (code === "model_not_found" || messageText.includes("does not exist") || messageText.includes("unknown model") || messageText.includes("model_not_found"))) {
      return new OracleTransportError(
        "model-unavailable",
        "gpt-5.2-pro is not available on this API base/key. Try gpt-5-pro or gpt-5.2.",
        apiError
      );
    }
    if (apiError.status === 404 || apiError.status === 405) {
      return new OracleTransportError(
        "unsupported-endpoint",
        "HTTP 404/405 from the Responses API; this base URL or gateway likely does not expose /v1/responses. Set OPENAI_BASE_URL to api.openai.com/v1.",
        apiError
      );
    }
    return new OracleTransportError("api-error", apiMessage, apiError);
  }
  return new OracleTransportError(
    "unknown",
    error instanceof Error ? error.message : "Unknown transport failure.",
    error
  );
}
function describeTransportError(error, deadlineMs) {
  switch (error.reason) {
    case "client-timeout":
      return deadlineMs ? `Client-side timeout: OpenAI streaming call exceeded the ${formatElapsed(deadlineMs)} deadline.` : "Client-side timeout: OpenAI streaming call exceeded the configured deadline.";
    case "connection-lost":
      return "Connection to OpenAI ended unexpectedly before the response completed.";
    case "client-abort":
      return "Request was aborted before OpenAI completed the response.";
    case "api-error":
      return error.message;
    case "model-unavailable":
      return error.message;
    case "unsupported-endpoint":
      return "The Responses API returned 404/405 \u2014 your base URL/gateway probably lacks /v1/responses (check OPENAI_BASE_URL or switch to api.openai.com).";
    default:
      return "OpenAI streaming call ended with an unknown transport error.";
  }
}

// src/oracle/files.ts
var MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024;
var DEFAULT_FS = fs2;
var DEFAULT_IGNORED_DIRS = ["node_modules", "dist", "coverage", ".git", ".turbo", ".next", "build", "tmp"];
async function readFiles(filePaths, {
  cwd = process.cwd(),
  fsModule = DEFAULT_FS,
  maxFileSizeBytes = MAX_FILE_SIZE_BYTES,
  readContents = true
} = {}) {
  if (!filePaths || filePaths.length === 0) {
    return [];
  }
  const partitioned = await partitionFileInputs(filePaths, cwd, fsModule);
  const useNativeFilesystem = fsModule === DEFAULT_FS || isNativeFsModule(fsModule);
  let candidatePaths = [];
  if (useNativeFilesystem) {
    if (partitioned.globPatterns.length === 0 && partitioned.excludePatterns.length === 0 && partitioned.literalDirectories.length === 0) {
      candidatePaths = Array.from(new Set(partitioned.literalFiles));
    } else {
      candidatePaths = await expandWithNativeGlob(partitioned, cwd);
    }
  } else {
    if (partitioned.globPatterns.length > 0 || partitioned.excludePatterns.length > 0) {
      throw new Error("Glob patterns and exclusions are only supported for on-disk files.");
    }
    candidatePaths = await expandWithCustomFs(partitioned, fsModule);
  }
  const allowedLiteralDirs = partitioned.literalDirectories.map((dir) => path2.resolve(dir)).filter((dir) => DEFAULT_IGNORED_DIRS.includes(path2.basename(dir)));
  const allowedLiteralFiles = partitioned.literalFiles.map((file) => path2.resolve(file));
  const resolvedLiteralDirs = new Set(allowedLiteralDirs);
  const allowedPaths = /* @__PURE__ */ new Set([...allowedLiteralDirs, ...allowedLiteralFiles]);
  const ignoredWhitelist = await buildIgnoredWhitelist(candidatePaths, cwd, fsModule);
  const ignoredLog = /* @__PURE__ */ new Set();
  const filteredCandidates = candidatePaths.filter((filePath) => {
    const ignoredDir = findIgnoredAncestor(filePath, cwd, resolvedLiteralDirs, allowedPaths, ignoredWhitelist);
    if (!ignoredDir) {
      return true;
    }
    const displayFile = relativePath(filePath, cwd);
    const key = `${ignoredDir}|${displayFile}`;
    if (!ignoredLog.has(key)) {
      console.log(`Skipping default-ignored path: ${displayFile} (matches ${ignoredDir})`);
      ignoredLog.add(key);
    }
    return false;
  });
  if (filteredCandidates.length === 0) {
    throw new FileValidationError("No files matched the provided --file patterns.", {
      patterns: partitioned.globPatterns,
      excludes: partitioned.excludePatterns
    });
  }
  const oversized = [];
  const accepted = [];
  for (const filePath of filteredCandidates) {
    let stats;
    try {
      stats = await fsModule.stat(filePath);
    } catch (error) {
      throw new FileValidationError(`Missing file or directory: ${relativePath(filePath, cwd)}`, { path: filePath }, error);
    }
    if (!stats.isFile()) {
      continue;
    }
    if (maxFileSizeBytes && typeof stats.size === "number" && stats.size > maxFileSizeBytes) {
      const relative = path2.relative(cwd, filePath) || filePath;
      oversized.push(`${relative} (${formatBytes(stats.size)})`);
      continue;
    }
    accepted.push(filePath);
  }
  if (oversized.length > 0) {
    throw new FileValidationError(`The following files exceed the 1 MB limit:
- ${oversized.join("\n- ")}`, {
      files: oversized,
      limitBytes: maxFileSizeBytes
    });
  }
  const files = [];
  for (const filePath of accepted) {
    const content = readContents ? await fsModule.readFile(filePath, "utf8") : "";
    files.push({ path: filePath, content });
  }
  return files;
}
async function partitionFileInputs(rawPaths, cwd, fsModule) {
  const result = {
    globPatterns: [],
    excludePatterns: [],
    literalFiles: [],
    literalDirectories: []
  };
  for (const entry of rawPaths) {
    const raw = entry?.trim();
    if (!raw) {
      continue;
    }
    if (raw.startsWith("!")) {
      const normalized = normalizeGlob(raw.slice(1), cwd);
      if (normalized) {
        result.excludePatterns.push(normalized);
      }
      continue;
    }
    if (fg.isDynamicPattern(raw)) {
      result.globPatterns.push(normalizeGlob(raw, cwd));
      continue;
    }
    const absolutePath = path2.isAbsolute(raw) ? raw : path2.resolve(cwd, raw);
    let stats;
    try {
      stats = await fsModule.stat(absolutePath);
    } catch (error) {
      throw new FileValidationError(`Missing file or directory: ${raw}`, { path: absolutePath }, error);
    }
    if (stats.isDirectory()) {
      result.literalDirectories.push(absolutePath);
    } else if (stats.isFile()) {
      result.literalFiles.push(absolutePath);
    } else {
      throw new FileValidationError(`Not a file or directory: ${raw}`, { path: absolutePath });
    }
  }
  return result;
}
async function expandWithNativeGlob(partitioned, cwd) {
  const patterns = [
    ...partitioned.globPatterns,
    ...partitioned.literalFiles.map((absPath) => toPosixRelativeOrBasename(absPath, cwd)),
    ...partitioned.literalDirectories.map((absDir) => makeDirectoryPattern(toPosixRelative(absDir, cwd)))
  ].filter(Boolean);
  if (patterns.length === 0) {
    return [];
  }
  const dotfileOptIn = patterns.some((pattern) => includesDotfileSegment(pattern));
  const gitignoreSets = await loadGitignoreSets(cwd);
  const matches = await fg(patterns, {
    cwd,
    absolute: false,
    dot: true,
    ignore: partitioned.excludePatterns,
    onlyFiles: true,
    followSymbolicLinks: false,
    suppressErrors: true
  });
  const resolved = matches.map((match) => path2.resolve(cwd, match));
  const filtered = resolved.filter((filePath) => !isGitignored(filePath, gitignoreSets));
  const finalFiles = dotfileOptIn ? filtered : filtered.filter((filePath) => !path2.basename(filePath).startsWith("."));
  return Array.from(new Set(finalFiles));
}
async function loadGitignoreSets(cwd) {
  const gitignorePaths = await fg("**/.gitignore", {
    cwd,
    dot: true,
    absolute: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    suppressErrors: true
  });
  const sets = [];
  for (const filePath of gitignorePaths) {
    try {
      const raw = await fs2.readFile(filePath, "utf8");
      const patterns = raw.split("\n").map((line) => line.trim()).filter((line) => line.length > 0 && !line.startsWith("#"));
      if (patterns.length > 0) {
        sets.push({ dir: path2.dirname(filePath), patterns });
      }
    } catch {
    }
  }
  return sets.sort((a, b) => a.dir.localeCompare(b.dir));
}
function isGitignored(filePath, sets) {
  for (const { dir, patterns } of sets) {
    if (!filePath.startsWith(dir)) {
      continue;
    }
    const relative = path2.relative(dir, filePath) || path2.basename(filePath);
    if (matchesAny(relative, patterns)) {
      return true;
    }
  }
  return false;
}
async function buildIgnoredWhitelist(filePaths, cwd, fsModule) {
  const whitelist = /* @__PURE__ */ new Set();
  for (const filePath of filePaths) {
    const absolute = path2.resolve(filePath);
    const rel = path2.relative(cwd, absolute);
    const parts = rel.split(path2.sep).filter(Boolean);
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i];
      if (!DEFAULT_IGNORED_DIRS.includes(part)) {
        continue;
      }
      const dirPath = path2.resolve(cwd, ...parts.slice(0, i + 1));
      if (whitelist.has(dirPath)) {
        continue;
      }
      try {
        const stats = await fsModule.stat(path2.join(dirPath, ".gitignore"));
        if (stats.isFile()) {
          whitelist.add(dirPath);
        }
      } catch {
      }
    }
  }
  return whitelist;
}
function findIgnoredAncestor(filePath, cwd, _literalDirs, allowedPaths, ignoredWhitelist) {
  const absolute = path2.resolve(filePath);
  if (Array.from(allowedPaths).some((allowed) => absolute === allowed || absolute.startsWith(`${allowed}${path2.sep}`))) {
    return null;
  }
  const rel = path2.relative(cwd, absolute);
  const parts = rel.split(path2.sep);
  for (let idx = 0; idx < parts.length; idx += 1) {
    const part = parts[idx];
    if (!DEFAULT_IGNORED_DIRS.includes(part)) {
      continue;
    }
    const ignoredDir = path2.resolve(cwd, parts.slice(0, idx + 1).join(path2.sep));
    if (ignoredWhitelist.has(ignoredDir)) {
      continue;
    }
    return part;
  }
  return null;
}
function matchesAny(relativePath2, patterns) {
  return patterns.some((pattern) => matchesPattern(relativePath2, pattern));
}
function matchesPattern(relativePath2, pattern) {
  if (!pattern) {
    return false;
  }
  const normalized = pattern.replace(/\\+/g, "/");
  if (normalized.endsWith("/")) {
    const dir = normalized.slice(0, -1);
    return relativePath2 === dir || relativePath2.startsWith(`${dir}/`);
  }
  const regex = globToRegex(normalized);
  return regex.test(relativePath2);
}
function globToRegex(pattern) {
  const withMarkers = pattern.replace(/\*\*/g, "\xA7\xA7DOUBLESTAR\xA7\xA7").replace(/\*/g, "\xA7\xA7SINGLESTAR\xA7\xA7");
  const escaped = withMarkers.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const restored = escaped.replace(/§§DOUBLESTAR§§/g, ".*").replace(/§§SINGLESTAR§§/g, "[^/]*");
  return new RegExp(`^${restored}$`);
}
function includesDotfileSegment(pattern) {
  const segments = pattern.split("/");
  return segments.some((segment) => segment.startsWith(".") && segment.length > 1);
}
async function expandWithCustomFs(partitioned, fsModule) {
  const paths = /* @__PURE__ */ new Set();
  partitioned.literalFiles.forEach((file) => {
    paths.add(file);
  });
  for (const directory of partitioned.literalDirectories) {
    const nested = await expandDirectoryRecursive(directory, fsModule);
    nested.forEach((entry) => {
      paths.add(entry);
    });
  }
  return Array.from(paths);
}
async function expandDirectoryRecursive(directory, fsModule) {
  const entries = await fsModule.readdir(directory);
  const results = [];
  for (const entry of entries) {
    const childPath = path2.join(directory, entry);
    const stats = await fsModule.stat(childPath);
    if (stats.isDirectory()) {
      results.push(...await expandDirectoryRecursive(childPath, fsModule));
    } else if (stats.isFile()) {
      results.push(childPath);
    }
  }
  return results;
}
function makeDirectoryPattern(relative) {
  if (relative === "." || relative === "") {
    return "**/*";
  }
  return `${stripTrailingSlashes(relative)}/**/*`;
}
function isNativeFsModule(fsModule) {
  return fsModule.__nativeFs === true || fsModule.readFile === DEFAULT_FS.readFile && fsModule.stat === DEFAULT_FS.stat && fsModule.readdir === DEFAULT_FS.readdir;
}
function normalizeGlob(pattern, cwd) {
  if (!pattern) {
    return "";
  }
  let normalized = pattern;
  if (path2.isAbsolute(normalized)) {
    normalized = path2.relative(cwd, normalized);
  }
  normalized = toPosix(normalized);
  if (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }
  return normalized;
}
function toPosix(value) {
  return value.replace(/\\/g, "/");
}
function toPosixRelative(absPath, cwd) {
  const relative = path2.relative(cwd, absPath);
  if (!relative) {
    return ".";
  }
  return toPosix(relative);
}
function toPosixRelativeOrBasename(absPath, cwd) {
  const relative = path2.relative(cwd, absPath);
  return toPosix(relative || path2.basename(absPath));
}
function stripTrailingSlashes(value) {
  const normalized = toPosix(value);
  return normalized.replace(/\/+$/g, "");
}
function formatBytes(size) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (size >= 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${size} B`;
}
function relativePath(targetPath, cwd) {
  const relative = path2.relative(cwd, targetPath);
  return relative || targetPath;
}
function createFileSections(files, cwd = process.cwd()) {
  return files.map((file, index) => {
    const relative = toPosix(path2.relative(cwd, file.path) || file.path);
    const sectionText = [
      `### File ${index + 1}: ${relative}`,
      "```",
      file.content.trimEnd(),
      "```"
    ].join("\n");
    return {
      index: index + 1,
      absolutePath: file.path,
      displayPath: relative,
      sectionText,
      content: file.content
    };
  });
}

// src/oracle/markdown.ts
import path3 from "node:path";
var EXT_TO_LANG = {
  ".ts": "ts",
  ".tsx": "tsx",
  ".js": "js",
  ".jsx": "jsx",
  ".json": "json",
  ".swift": "swift",
  ".md": "md",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".py": "python",
  ".rb": "ruby",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".hpp": "cpp",
  ".css": "css",
  ".scss": "scss",
  ".sql": "sql",
  ".yaml": "yaml",
  ".yml": "yaml"
};
function detectFenceLanguage(displayPath) {
  const ext = path3.extname(displayPath).toLowerCase();
  return EXT_TO_LANG[ext] ?? null;
}
function pickFence(content) {
  const matches = [...content.matchAll(/`+/g)];
  const maxTicks = matches.reduce((max, m) => Math.max(max, m[0].length), 0);
  const fenceLength = Math.max(3, maxTicks + 1);
  return "`".repeat(fenceLength);
}
function formatFileSection(displayPath, content) {
  const fence = pickFence(content);
  const lang = detectFenceLanguage(displayPath);
  const normalized = content.replace(/\s+$/u, "");
  const header = `### File: ${displayPath}`;
  const fenceOpen = lang ? `${fence}${lang}` : fence;
  return [header, fenceOpen, normalized, fence, ""].join("\n");
}

// src/oracle/fsAdapter.ts
function createFsAdapter(fsModule) {
  const adapter = {
    stat: (targetPath) => fsModule.stat(targetPath),
    readdir: (targetPath) => fsModule.readdir(targetPath),
    readFile: (targetPath, encoding) => fsModule.readFile(targetPath, encoding)
  };
  adapter.__nativeFs = true;
  return adapter;
}

// src/oracle/request.ts
function buildPrompt(basePrompt, files, cwd = process.cwd()) {
  if (!files.length) {
    return basePrompt;
  }
  const sections = createFileSections(files, cwd);
  const sectionText = sections.map((section) => section.sectionText).join("\n\n");
  return `${basePrompt.trim()}

${sectionText}`;
}
function buildRequestBody({
  modelConfig,
  systemPrompt,
  userPrompt,
  searchEnabled,
  maxOutputTokens,
  background,
  storeResponse
}) {
  const tools = modelConfig.searchTools ? modelConfig.searchTools.map((t) => ({ type: t })) : [{ type: modelConfig.searchToolType ?? "web_search_preview" }];
  return {
    model: modelConfig.apiModel ?? modelConfig.model,
    instructions: systemPrompt,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: userPrompt
          }
        ]
      }
    ],
    tools: searchEnabled ? tools : void 0,
    reasoning: modelConfig.reasoning || void 0,
    max_output_tokens: maxOutputTokens,
    background: background ? true : void 0,
    store: storeResponse ? true : void 0
  };
}

// src/oracle/tokenEstimate.ts
function estimateRequestTokens(requestBody, modelConfig, bufferTokens = 200) {
  const SEARCH_RESULT_BUFFER_TOKENS = 4e3;
  const parts = [];
  if (requestBody.instructions) {
    parts.push(requestBody.instructions);
  }
  for (const turn of requestBody.input ?? []) {
    for (const content of turn.content ?? []) {
      if (typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  if (requestBody.tools && requestBody.tools.length > 0) {
    parts.push(JSON.stringify(requestBody.tools));
  }
  if (requestBody.reasoning) {
    parts.push(JSON.stringify(requestBody.reasoning));
  }
  if (requestBody.background) {
    parts.push("background:true");
  }
  if (requestBody.store) {
    parts.push("store:true");
  }
  const concatenated = parts.join("\n");
  const baseEstimate = modelConfig.tokenizer(concatenated, TOKENIZER_OPTIONS);
  const hasWebSearch = requestBody.tools?.some((tool) => tool?.type === "web_search_preview");
  const searchBuffer = hasWebSearch ? SEARCH_RESULT_BUFFER_TOKENS : 0;
  return baseEstimate + bufferTokens + searchBuffer;
}

// src/oracle/tokenStats.ts
import chalk from "chalk";
function getFileTokenStats(files, {
  cwd = process.cwd(),
  tokenizer,
  tokenizerOptions,
  inputTokenBudget
}) {
  if (!files.length) {
    return { stats: [], totalTokens: 0 };
  }
  const sections = createFileSections(files, cwd);
  const stats = sections.map((section) => {
    const tokens = tokenizer(section.sectionText, tokenizerOptions);
    const percent = inputTokenBudget ? tokens / inputTokenBudget * 100 : void 0;
    return {
      path: section.absolutePath,
      displayPath: section.displayPath,
      tokens,
      percent
    };
  }).sort((a, b) => b.tokens - a.tokens);
  const totalTokens = stats.reduce((sum, entry) => sum + entry.tokens, 0);
  return { stats, totalTokens };
}
function printFileTokenStats({ stats, totalTokens }, { inputTokenBudget, log = console.log }) {
  if (!stats.length) {
    return;
  }
  log(chalk.bold("File Token Usage"));
  for (const entry of stats) {
    const percentLabel = inputTokenBudget && entry.percent != null ? `${entry.percent.toFixed(2)}%` : "n/a";
    log(`${entry.tokens.toLocaleString().padStart(10)}  ${percentLabel.padStart(8)}  ${entry.displayPath}`);
  }
  if (inputTokenBudget) {
    const totalPercent = totalTokens / inputTokenBudget * 100;
    log(
      `Total: ${totalTokens.toLocaleString()} tokens (${totalPercent.toFixed(
        2
      )}% of ${inputTokenBudget.toLocaleString()})`
    );
  } else {
    log(`Total: ${totalTokens.toLocaleString()} tokens`);
  }
}

// src/oracle/client.ts
import OpenAI from "openai";
import path4 from "node:path";
import { createRequire } from "node:module";

// src/oracle/gemini.ts
import {
  GoogleGenAI,
  HarmCategory,
  HarmBlockThreshold
} from "@google/genai";

// src/oracle/modelUtils.ts
function stripProviderPrefix(model) {
  return model.includes("/") ? model.split("/").slice(1).join("/") : model;
}

// src/oracle/gemini.ts
function createGeminiClient(apiKey, modelName = "gemini-3-pro", resolvedModelId) {
  const modelId = resolvedModelId ?? stripProviderPrefix(modelName);
  const genAI = new GoogleGenAI({ apiKey });
  const adaptBodyToGemini = (body) => {
    const contents = body.input.map((inputItem) => ({
      role: inputItem.role === "user" ? "user" : "model",
      parts: inputItem.content.map((contentPart) => {
        if (contentPart.type === "input_text") {
          return { text: contentPart.text };
        }
        return null;
      }).filter((part) => part !== null)
    }));
    const tools = body.tools?.map((tool) => {
      if (tool.type === "web_search_preview") {
        return {
          googleSearch: {}
        };
      }
      return {};
    }).filter((t) => Object.keys(t).length > 0);
    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE
      }
    ];
    const systemInstruction = body.instructions ? { role: "system", parts: [{ text: body.instructions }] } : void 0;
    return {
      model: modelId,
      contents,
      config: {
        maxOutputTokens: body.max_output_tokens,
        safetySettings,
        tools,
        systemInstruction
      }
    };
  };
  const adaptGeminiResponseToOracle = (geminiResponse) => {
    const outputText = [];
    const output = [];
    geminiResponse.candidates?.forEach((candidate) => {
      candidate.content?.parts?.forEach((part) => {
        if (part.text) {
          outputText.push(part.text);
          output.push({ type: "text", text: part.text });
        }
      });
    });
    const usage = {
      input_tokens: geminiResponse.usageMetadata?.promptTokenCount || 0,
      output_tokens: geminiResponse.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: (geminiResponse.usageMetadata?.promptTokenCount || 0) + (geminiResponse.usageMetadata?.candidatesTokenCount || 0)
    };
    return {
      id: geminiResponse.responseId ?? `gemini-${Date.now()}`,
      status: "completed",
      output_text: outputText,
      output,
      usage
    };
  };
  const adaptAggregatedTextToOracle = (text, usageMetadata, responseId) => {
    const usage = {
      input_tokens: usageMetadata?.promptTokenCount ?? 0,
      output_tokens: usageMetadata?.candidatesTokenCount ?? 0,
      total_tokens: (usageMetadata?.promptTokenCount ?? 0) + (usageMetadata?.candidatesTokenCount ?? 0)
    };
    return {
      id: responseId ?? `gemini-${Date.now()}`,
      status: "completed",
      output_text: [text],
      output: [{ type: "text", text }],
      usage
    };
  };
  const enrichGeminiError = (error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("404")) {
      return new Error(
        `Gemini model not available to this API key/region. Confirm preview access and model ID (${modelId}). Original: ${message}`
      );
    }
    return error instanceof Error ? error : new Error(message);
  };
  return {
    responses: {
      stream: (body) => {
        const geminiBody = adaptBodyToGemini(body);
        let finalResponsePromise = null;
        let aggregatedText = "";
        let lastUsage;
        let responseId;
        async function* iterator() {
          let streamingResp;
          try {
            streamingResp = await genAI.models.generateContentStream(geminiBody);
          } catch (error) {
            throw enrichGeminiError(error);
          }
          for await (const chunk of streamingResp) {
            const text = chunk.text;
            if (text) {
              aggregatedText += text;
              yield { type: "chunk", delta: text };
            }
            if (chunk.usageMetadata) {
              lastUsage = chunk.usageMetadata;
            }
            if (chunk.responseId) {
              responseId = chunk.responseId;
            }
          }
          finalResponsePromise = Promise.resolve(
            adaptAggregatedTextToOracle(aggregatedText, lastUsage, responseId)
          );
        }
        const generator = iterator();
        return {
          [Symbol.asyncIterator]: () => generator,
          finalResponse: async () => {
            if (!finalResponsePromise) {
              for await (const _ of generator) {
              }
            }
            if (!finalResponsePromise) {
              throw new Error("Response promise not initialized");
            }
            return finalResponsePromise;
          }
        };
      },
      create: async (body) => {
        const geminiBody = adaptBodyToGemini(body);
        let result;
        try {
          result = await genAI.models.generateContent(geminiBody);
        } catch (error) {
          throw enrichGeminiError(error);
        }
        return adaptGeminiResponseToOracle(result);
      },
      retrieve: async (id) => {
        return {
          id,
          status: "error",
          error: { message: "Retrieve by ID not supported for Gemini API yet." }
        };
      }
    }
  };
}

// src/oracle/modelResolver.ts
import { countTokens as countTokensGpt5Pro2 } from "gpt-tokenizer/model/gpt-5-pro";
import { pricingFromUsdPerMillion } from "tokentally";

// src/oracle/providerResolver.ts
function resolveProvider(model) {
  const bare = stripProviderPrefix(model).toLowerCase();
  const config = MODEL_CONFIGS[bare];
  if (config?.provider) return config.provider;
  if (bare.includes("gemini")) return "google";
  if (bare.includes("claude")) return "anthropic";
  if (bare.includes("grok")) return "xai";
  if (bare.includes("gpt") || bare.startsWith("o1-") || bare.startsWith("o3-") || bare.startsWith("o4-"))
    return "openai";
  return "other";
}

// src/oracle/modelResolver.ts
var OPENROUTER_DEFAULT_BASE = "https://openrouter.ai/api/v1";
var OPENROUTER_MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";
function isKnownModel(model) {
  return Object.hasOwn(MODEL_CONFIGS, model);
}
function isOpenRouterBaseUrl(baseUrl) {
  if (!baseUrl) return false;
  try {
    const url = new URL(baseUrl);
    return url.hostname.includes("openrouter.ai");
  } catch {
    return false;
  }
}
function defaultOpenRouterBaseUrl() {
  return OPENROUTER_DEFAULT_BASE;
}
function normalizeOpenRouterBaseUrl(baseUrl) {
  try {
    const url = new URL(baseUrl);
    if (url.pathname.endsWith("/responses")) {
      url.pathname = url.pathname.replace(/\/responses\/?$/, "");
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    return baseUrl;
  }
}
function safeModelSlug(model) {
  return model.replace(/[/\\]/g, "__").replace(/[:*?"<>|]/g, "_");
}
var catalogCache = /* @__PURE__ */ new Map();
var CACHE_TTL_MS = 5 * 60 * 1e3;
var MAX_CACHE_ENTRIES = 20;
function pruneCatalogCache(now) {
  for (const [key, entry] of catalogCache) {
    if (now - entry.fetchedAt >= CACHE_TTL_MS) {
      catalogCache.delete(key);
    }
  }
  if (catalogCache.size > MAX_CACHE_ENTRIES) {
    const entries = [...catalogCache.entries()].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);
    const toRemove = entries.slice(0, catalogCache.size - MAX_CACHE_ENTRIES);
    for (const [key] of toRemove) {
      catalogCache.delete(key);
    }
  }
}
async function fetchOpenRouterCatalog(apiKey, fetcher) {
  const now = Date.now();
  const cached = catalogCache.get(apiKey);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.models;
  }
  const response = await fetcher(OPENROUTER_MODELS_ENDPOINT, {
    headers: {
      authorization: `Bearer ${apiKey}`
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to load OpenRouter models (${response.status})`);
  }
  const json = await response.json();
  const models = json?.data ?? [];
  catalogCache.set(apiKey, { fetchedAt: now, models });
  pruneCatalogCache(now);
  return models;
}
function mapToOpenRouterId(candidate, catalog, providerHint) {
  if (candidate.includes("/")) return candidate;
  const byExact = catalog.find((entry) => entry.id === candidate);
  if (byExact) return byExact.id;
  const bySuffix = catalog.find((entry) => entry.id.endsWith(`/${candidate}`));
  if (bySuffix) return bySuffix.id;
  if (providerHint) {
    return `${providerHint}/${candidate}`;
  }
  return candidate;
}
async function resolveModelConfig(model, options = {}) {
  const known = isKnownModel(model) ? MODEL_CONFIGS[model] : null;
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const openRouterActive = isOpenRouterBaseUrl(options.baseUrl) || Boolean(options.openRouterApiKey);
  if (known && !openRouterActive) {
    return known;
  }
  if (openRouterActive && options.openRouterApiKey) {
    try {
      const catalog = await fetchOpenRouterCatalog(options.openRouterApiKey, fetcher);
      const targetId = mapToOpenRouterId(
        typeof model === "string" ? model : String(model),
        catalog,
        known?.provider
      );
      const info = catalog.find((entry) => entry.id === targetId) ?? null;
      if (info) {
        return {
          ...known ?? {
            model,
            tokenizer: countTokensGpt5Pro2,
            inputLimit: info.context_length ?? 2e5,
            reasoning: null
          },
          apiModel: targetId,
          openRouterId: targetId,
          provider: known?.provider ?? "other",
          inputLimit: info.context_length ?? known?.inputLimit ?? 2e5,
          pricing: info.pricing && info.pricing.prompt != null && info.pricing.completion != null ? (() => {
            const pricing = pricingFromUsdPerMillion({
              inputUsdPerMillion: info.pricing.prompt,
              outputUsdPerMillion: info.pricing.completion
            });
            return {
              inputPerToken: pricing.inputUsdPerToken,
              outputPerToken: pricing.outputUsdPerToken
            };
          })() : known?.pricing ?? null,
          supportsBackground: known?.supportsBackground ?? true,
          supportsSearch: known?.supportsSearch ?? true
        };
      }
      return {
        ...known ?? {
          model,
          tokenizer: countTokensGpt5Pro2,
          inputLimit: 2e5,
          reasoning: null
        },
        apiModel: targetId,
        openRouterId: targetId,
        provider: known?.provider ?? "other",
        supportsBackground: known?.supportsBackground ?? true,
        supportsSearch: known?.supportsSearch ?? true,
        pricing: known?.pricing ?? null
      };
    } catch {
    }
  }
  const provider = known?.provider ?? resolveProvider(model);
  return {
    ...known ?? {
      model,
      apiModel: model,
      tokenizer: countTokensGpt5Pro2,
      inputLimit: 2e5,
      reasoning: null
    },
    provider,
    searchToolType: known?.searchToolType ?? (provider === "xai" ? "web_search" : "web_search_preview"),
    searchTools: known?.searchTools ?? (provider === "xai" ? ["web_search", "x_search"] : void 0),
    supportsBackground: known?.supportsBackground ?? true,
    supportsSearch: known?.supportsSearch ?? true,
    pricing: known?.pricing ?? null
  };
}
function isProModel(model) {
  return isKnownModel(model) && PRO_MODELS.has(model);
}

// src/oracle/client.ts
function createDefaultClientFactory() {
  const customFactory = loadCustomClientFactory();
  if (customFactory) return customFactory;
  return (key, options) => {
    const modelProvider = options?.model ? resolveProvider(options.model) : "other";
    if (modelProvider === "google" && !isOpenRouterBaseUrl(options?.baseUrl)) {
      return createGeminiClient(key, options.model, options?.resolvedModelId);
    }
    const openRouter = isOpenRouterBaseUrl(options?.baseUrl);
    const defaultHeaders = openRouter ? buildOpenRouterHeaders() : void 0;
    const httpTimeoutMs = typeof options?.httpTimeoutMs === "number" && Number.isFinite(options.httpTimeoutMs) && options.httpTimeoutMs > 0 ? options.httpTimeoutMs : 20 * 60 * 1e3;
    const instance = new OpenAI({
      apiKey: key,
      timeout: httpTimeoutMs,
      baseURL: options?.baseUrl,
      defaultHeaders
    });
    if (openRouter) {
      return buildOpenRouterCompletionClient(instance);
    }
    return {
      responses: {
        stream: (body) => instance.responses.stream(body),
        create: (body) => instance.responses.create(body),
        retrieve: (id) => instance.responses.retrieve(id)
      }
    };
  };
}
function buildOpenRouterHeaders() {
  const headers = {};
  const referer = process.env.OPENROUTER_REFERER ?? process.env.OPENROUTER_HTTP_REFERER ?? "https://github.com/steipete/oracle";
  const title = process.env.OPENROUTER_TITLE ?? "Oracle CLI";
  if (referer) {
    headers["HTTP-Referer"] = referer;
  }
  if (title) {
    headers["X-Title"] = title;
  }
  return headers;
}
function loadCustomClientFactory() {
  const override = process.env.ORACLE_CLIENT_FACTORY;
  if (!override) {
    return null;
  }
  if (override === "INLINE_TEST_FACTORY") {
    return () => ({
      responses: {
        create: async () => ({ id: "inline-test", status: "completed" }),
        stream: async () => ({
          [Symbol.asyncIterator]: () => ({
            async next() {
              return { done: true, value: void 0 };
            }
          }),
          finalResponse: async () => ({ id: "inline-test", status: "completed" })
        }),
        retrieve: async (id) => ({ id, status: "completed" })
      }
    });
  }
  try {
    const require2 = createRequire(import.meta.url);
    const resolved = path4.isAbsolute(override) ? override : path4.resolve(process.cwd(), override);
    const moduleExports = require2(resolved);
    const factory = typeof moduleExports === "function" ? moduleExports : typeof moduleExports?.default === "function" ? moduleExports.default : typeof moduleExports?.createClientFactory === "function" ? moduleExports.createClientFactory : null;
    if (typeof factory === "function") {
      return factory;
    }
    console.warn(`Custom client factory at ${resolved} did not export a function.`);
  } catch (error) {
    console.warn(`Failed to load ORACLE_CLIENT_FACTORY module "${override}":`, error);
  }
  return null;
}
function buildOpenRouterCompletionClient(instance) {
  const adaptRequest = (body) => {
    const messages = [];
    if (body.instructions) {
      messages.push({ role: "system", content: body.instructions });
    }
    for (const entry of body.input) {
      const textParts = entry.content.map((c) => c.type === "input_text" ? c.text : "").filter((t) => t).join("\n\n");
      messages.push({
        role: entry.role ?? "user",
        content: textParts
      });
    }
    const base2 = {
      model: body.model,
      messages,
      max_tokens: body.max_output_tokens
    };
    const streaming = { ...base2, stream: true };
    const nonStreaming = { ...base2, stream: false };
    return { streaming, nonStreaming };
  };
  const adaptResponse = (response) => {
    const text = response.choices?.[0]?.message?.content ?? "";
    const usage = {
      input_tokens: response.usage?.prompt_tokens ?? 0,
      output_tokens: response.usage?.completion_tokens ?? 0,
      total_tokens: response.usage?.total_tokens ?? 0
    };
    return {
      id: response.id ?? `openrouter-${Date.now()}`,
      status: "completed",
      output_text: [text],
      output: [{ type: "text", text }],
      usage
    };
  };
  const stream = async (body) => {
    const { streaming } = adaptRequest(body);
    let finalUsage;
    let finalId;
    let aggregated = "";
    async function* iterator() {
      const completion = await instance.chat.completions.create(streaming);
      for await (const chunk of completion) {
        finalId = chunk.id ?? finalId;
        const delta = chunk.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          aggregated += delta;
          yield { type: "chunk", delta };
        }
        if (chunk.usage) {
          finalUsage = chunk.usage;
        }
      }
    }
    const gen = iterator();
    return {
      [Symbol.asyncIterator]() {
        return gen;
      },
      async finalResponse() {
        return adaptResponse({
          id: finalId ?? `openrouter-${Date.now()}`,
          choices: [{ message: { role: "assistant", content: aggregated } }],
          usage: finalUsage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          created: Math.floor(Date.now() / 1e3),
          model: "",
          object: "chat.completion"
        });
      }
    };
  };
  const create = async (body) => {
    const { nonStreaming } = adaptRequest(body);
    const response = await instance.chat.completions.create(nonStreaming);
    return adaptResponse(response);
  };
  return {
    responses: {
      stream,
      create,
      retrieve: async () => {
        throw new Error("retrieve is not supported for OpenRouter chat/completions fallback.");
      }
    }
  };
}

// src/oracle/run.ts
import chalk3 from "chalk";
import kleur from "kleur";
import fs3 from "node:fs/promises";
import path5 from "node:path";
import process3 from "node:process";
import { performance } from "node:perf_hooks";

// src/oracle/finishLine.ts
function formatElapsedCompact(ms) {
  if (!Number.isFinite(ms) || ms < 0) {
    return "unknown";
  }
  if (ms < 6e4) {
    return `${(ms / 1e3).toFixed(1)}s`;
  }
  if (ms < 60 * 6e4) {
    const minutes2 = Math.floor(ms / 6e4);
    const seconds = Math.floor(ms % 6e4 / 1e3);
    return `${minutes2}m${seconds.toString().padStart(2, "0")}s`;
  }
  const hours = Math.floor(ms / (60 * 6e4));
  const minutes = Math.floor(ms % (60 * 6e4) / 6e4);
  return `${hours}h${minutes.toString().padStart(2, "0")}m`;
}
function formatFinishLine({
  elapsedMs,
  model,
  costUsd,
  tokensPart,
  summaryExtraParts,
  detailParts
}) {
  const line1Parts = [
    formatElapsedCompact(elapsedMs),
    typeof costUsd === "number" ? formatUSD(costUsd) : null,
    model,
    tokensPart,
    ...summaryExtraParts ?? []
  ];
  const line1 = line1Parts.filter((part) => typeof part === "string" && part.length > 0).join(" \xB7 ");
  const line2Parts = (detailParts ?? []).filter(
    (part) => typeof part === "string" && part.length > 0
  );
  if (line2Parts.length === 0) {
    return { line1 };
  }
  return { line1, line2: line2Parts.join(" | ") };
}

// src/oracle/logging.ts
function maskApiKey(key) {
  if (!key) return null;
  if (key.length <= 8) return `${key[0] ?? ""}***${key[key.length - 1] ?? ""}`;
  const prefix = key.slice(0, 4);
  const suffix = key.slice(-4);
  return `${prefix}****${suffix}`;
}
function formatBaseUrlForLog(raw) {
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    const segments = parsed.pathname.split("/").filter(Boolean);
    let path14 = "";
    if (segments.length > 0) {
      path14 = `/${segments[0]}`;
      if (segments.length > 1) {
        path14 += "/...";
      }
    }
    const allowedQueryKeys = ["api-version"];
    const maskedQuery = allowedQueryKeys.filter((key) => parsed.searchParams.has(key)).map((key) => `${key}=***`);
    const query = maskedQuery.length > 0 ? `?${maskedQuery.join("&")}` : "";
    return `${parsed.protocol}//${parsed.host}${path14}${query}`;
  } catch {
    const trimmed = raw.trim();
    if (trimmed.length <= 64) return trimmed;
    return `${trimmed.slice(0, 32)}\u2026${trimmed.slice(-8)}`;
  }
}

// src/heartbeat.ts
function startHeartbeat(config) {
  const { intervalMs, log, isActive, makeMessage } = config;
  if (!intervalMs || intervalMs <= 0) {
    return () => {
    };
  }
  let stopped = false;
  let pending = false;
  const start = Date.now();
  const timer = setInterval(async () => {
    if (stopped || pending) {
      return;
    }
    if (!isActive()) {
      stop();
      return;
    }
    pending = true;
    try {
      const elapsed = Date.now() - start;
      const message = await makeMessage(elapsed);
      if (message && !stopped) {
        log(message);
      }
    } catch {
    } finally {
      pending = false;
    }
  }, intervalMs);
  timer.unref?.();
  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    clearInterval(timer);
  };
  return stop;
}

// src/oracle/oscProgress.ts
import process2 from "node:process";
import {
  startOscProgress as startOscProgressShared,
  supportsOscProgress as supportsOscProgressShared
} from "osc-progress";
function startOscProgress(options = {}) {
  const env = options.env ?? process2.env;
  if (env.CODEX_MANAGED_BY_NPM === "1" && env.ORACLE_FORCE_OSC_PROGRESS !== "1") {
    return () => {
    };
  }
  return startOscProgressShared({
    ...options,
    // Preserve Oracle's previous default: progress emits to stdout.
    write: options.write ?? ((text) => process2.stdout.write(text)),
    disableEnvVar: "ORACLE_NO_OSC_PROGRESS",
    forceEnvVar: "ORACLE_FORCE_OSC_PROGRESS"
  });
}

// node_modules/markdansi/dist/render.js
import stringWidth2 from "string-width";
import stripAnsi2 from "strip-ansi";

// node_modules/markdansi/dist/hyperlink.js
import supportsHyperlinks from "supports-hyperlinks";
function hyperlinkSupported(stream = process.stdout) {
  const helper = supportsHyperlinks;
  try {
    if (typeof supportsHyperlinks === "function") {
      return Boolean(supportsHyperlinks(stream));
    }
    if (helper.stdout)
      return Boolean(helper.stdout(stream));
    if (helper.default && typeof helper.default === "function")
      return Boolean(helper.default(stream));
  } catch {
    return false;
  }
  return false;
}
function osc8(url, text) {
  return `\x1B]8;;${url}\x07${text}\x1B]8;;\x07`;
}

// node_modules/markdansi/dist/parser.js
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm as gfmSyntax } from "micromark-extension-gfm";
function parse(markdown) {
  return fromMarkdown(markdown, {
    extensions: [gfmSyntax()],
    mdastExtensions: [gfmFromMarkdown()]
  });
}

// node_modules/markdansi/dist/theme.js
import { Chalk } from "chalk";
var base = {
  heading: { color: "yellow", bold: true },
  strong: { bold: true },
  emph: { italic: true },
  inlineCode: { color: "cyan" },
  blockCode: { color: "green" },
  link: { color: "blue", underline: true },
  quote: { dim: true },
  hr: { dim: true },
  listMarker: { color: "cyan" },
  tableHeader: { bold: true, color: "yellow" },
  tableCell: {}
};
var dim = {
  ...base,
  heading: { color: "white", bold: true, dim: true },
  link: { color: "blue", underline: true, dim: true }
};
var bright = {
  ...base,
  heading: { color: "magenta", bold: true },
  link: { color: "cyan", underline: true },
  inlineCode: { color: "green" },
  blockCode: { color: "green" }
};
var solarized = {
  heading: { color: "yellow", bold: true },
  strong: { bold: true },
  emph: { italic: true },
  inlineCode: { color: "cyan" },
  blockCode: { color: "#2aa198" },
  link: { color: "blue", underline: true },
  quote: { color: "white", dim: true },
  hr: { color: "white", dim: true },
  listMarker: { color: "cyan" },
  tableHeader: { color: "yellow", bold: true }
};
var monochrome = {
  heading: { bold: true },
  strong: { bold: true },
  emph: { italic: true },
  inlineCode: { dim: true },
  blockCode: { dim: true },
  link: { underline: true },
  quote: { dim: true },
  hr: { dim: true },
  listMarker: { dim: true },
  tableHeader: { bold: true }
};
var contrast = {
  heading: { color: "magenta", bold: true },
  strong: { color: "white", bold: true },
  emph: { color: "white", italic: true },
  inlineCode: { color: "cyan", bold: true },
  blockCode: { color: "green", bold: true },
  link: { color: "blue", underline: true },
  quote: { color: "white", dim: true },
  hr: { color: "white", dim: true },
  listMarker: { color: "yellow", bold: true },
  tableHeader: { color: "yellow", bold: true },
  tableCell: { color: "white" }
};
var themes = {
  default: Object.freeze(base),
  dim: Object.freeze(dim),
  bright: Object.freeze(bright),
  solarized: Object.freeze(solarized),
  monochrome: Object.freeze(monochrome),
  contrast: Object.freeze(contrast)
};
function createStyler({ color }) {
  const level = color ? 3 : 0;
  const chalk12 = new Chalk({ level });
  const apply = (text, style = {}) => {
    if (!color)
      return text;
    let fn = chalk12;
    if (style.color) {
      const indexed = fn;
      if (indexed[style.color])
        fn = indexed[style.color];
    }
    if (style.bgColor) {
      const indexed = fn;
      if (indexed[style.bgColor])
        fn = indexed[style.bgColor];
    }
    if (style.bold)
      fn = fn.bold;
    if (style.italic)
      fn = fn.italic;
    if (style.underline)
      fn = fn.underline;
    if (style.dim)
      fn = fn.dim;
    if (style.strike)
      fn = fn.strikethrough;
    return fn(text);
  };
  return apply;
}

// node_modules/markdansi/dist/wrap.js
import stringWidth from "string-width";
import stripAnsi from "strip-ansi";
function visibleWidth(text) {
  return stringWidth(stripAnsi(text));
}
function wrapText(text, width, wrap) {
  if (!wrap || width <= 0)
    return [text];
  const words = text.split(/(\s+)/).filter((w) => w.length > 0);
  const lines = [];
  let current = "";
  let currentWidth = 0;
  const trimEndSpaces = (s) => s.replace(/\s+$/, "");
  const orphanPhraseTail = (s) => {
    const trimmed = trimEndSpaces(s);
    const phrase = trimmed.match(/\b(with|in|on|of|to|for)\s+(a|an|the)$/i);
    if (phrase) {
      const preposition = phrase[1];
      const article = phrase[2];
      if (preposition && article)
        return `${preposition} ${article}`;
    }
    const single = trimmed.match(/\b(a|an|the|to|of|with|and|or|in|on|for)$/i);
    return single?.[1] ?? null;
  };
  for (const word of words) {
    const w = visibleWidth(word);
    if (current !== "" && currentWidth + w > width && !/^\s+$/.test(word)) {
      const nextWord = word.replace(/^\s+/, "");
      const currentNoTrail = trimEndSpaces(current);
      const tail = orphanPhraseTail(currentNoTrail);
      if (tail && currentNoTrail.length > tail.length) {
        const base2 = trimEndSpaces(currentNoTrail.slice(0, currentNoTrail.length - tail.length));
        if (base2 !== "") {
          lines.push(base2);
          current = `${tail} ${nextWord}`;
          currentWidth = visibleWidth(current);
          continue;
        }
      }
      lines.push(currentNoTrail);
      current = nextWord;
      currentWidth = visibleWidth(current);
      continue;
    }
    current += word;
    currentWidth = visibleWidth(current);
  }
  if (current !== "")
    lines.push(trimEndSpaces(current));
  if (lines.length === 0)
    lines.push("");
  return lines;
}
function wrapWithPrefix(text, width, wrap, prefix = "") {
  if (!wrap)
    return text.split("\n").map((line) => prefix + line);
  const out = [];
  const w = Math.max(1, width - visibleWidth(prefix));
  for (const line of text.split("\n")) {
    const parts = wrapText(line, w, wrap);
    for (const p of parts)
      out.push(prefix + p);
  }
  return out;
}

// node_modules/markdansi/dist/render.js
function dedent(markdown) {
  const lines = markdown.split("\n");
  const indents = lines.filter((l) => l.trim() !== "").map((l) => l.match(/^[ \t]*/)?.[0].length ?? 0);
  if (indents.length === 0)
    return markdown;
  const minIndent = Math.min(...indents);
  if (minIndent === 0)
    return markdown;
  return lines.map((l) => l.slice(Math.min(minIndent, l.length))).join("\n");
}
function resolveOptions(userOptions = {}) {
  const wrap = userOptions.wrap !== void 0 ? userOptions.wrap : true;
  const baseWidth = userOptions.width ?? (wrap ? process.stdout.columns || 80 : void 0);
  const color = userOptions.color !== void 0 ? userOptions.color : process.stdout.isTTY;
  const hyperlinks = userOptions.hyperlinks !== void 0 ? userOptions.hyperlinks : color && hyperlinkSupported();
  const effectiveHyperlinks = color ? hyperlinks : false;
  const baseTheme = themes.default ?? {};
  const userTheme = userOptions.theme && typeof userOptions.theme === "object" ? userOptions.theme : themes[userOptions.theme || "default"] || baseTheme;
  const mergedTheme = {
    ...baseTheme,
    ...userTheme || {},
    inlineCode: userTheme?.inlineCode || userTheme?.code || baseTheme.inlineCode || baseTheme.code || {},
    blockCode: userTheme?.blockCode || userTheme?.code || baseTheme.blockCode || baseTheme.code || {}
  };
  const highlighter = userOptions.highlighter;
  const listIndent = userOptions.listIndent ?? 2;
  const quotePrefix = userOptions.quotePrefix ?? "\u2502 ";
  const tableBorder = userOptions.tableBorder || "unicode";
  const tablePadding = userOptions.tablePadding ?? 1;
  const tableDense = userOptions.tableDense ?? false;
  const tableTruncate = userOptions.tableTruncate ?? true;
  const tableEllipsis = userOptions.tableEllipsis ?? "\u2026";
  const codeBox = userOptions.codeBox ?? true;
  const codeGutter = userOptions.codeGutter ?? false;
  const codeWrap = userOptions.codeWrap ?? true;
  const resolved = {
    wrap,
    color,
    hyperlinks: effectiveHyperlinks,
    theme: mergedTheme,
    highlighter,
    listIndent,
    quotePrefix,
    tableBorder,
    tablePadding,
    tableDense,
    tableTruncate,
    tableEllipsis,
    codeBox,
    codeGutter,
    codeWrap
  };
  if (baseWidth !== void 0)
    resolved.width = baseWidth;
  return resolved;
}
function extractText(node) {
  if (typeof node.value === "string")
    return node.value;
  if (Array.isArray(node.children)) {
    return node.children.map((child) => extractText(child)).join("");
  }
  return "";
}
function getParagraphText(node) {
  return extractText(node);
}
function normalizeNodes(tree) {
  const normalized = [];
  for (let i = 0; i < tree.children.length; i += 1) {
    const node = tree.children[i];
    if (node?.type === "paragraph" && node.children.length >= 1) {
      const text = getParagraphText(node);
      const defMatch = text.match(/^\[(\d+|\w+)]:\s+\S.*"\s*$/);
      const next = tree.children[i + 1];
      if (defMatch && next?.type === "code" && !next.lang) {
        const continuation = next.value.replace(/^[ \t>]+/gm, " ").replace(/\s+/g, " ").trim();
        const merged = `${text.replace(/\s+"$/, '"')} ${continuation ? continuation.replace(/^"+|"+$/g, "").trim() : ""}`.trim();
        normalized.push({
          type: "paragraph",
          children: [{ type: "text", value: merged }],
          position: node.position
        });
        i += 1;
        continue;
      }
    }
    if (node?.type === "code" && !node.lang) {
      const stripped = node.value.replace(/^[ \t>]+/gm, "").trim();
      if (/^\[(\d+|\w+)]:\s+\S+/.test(stripped)) {
        normalized.push({
          type: "paragraph",
          children: [{ type: "text", value: stripped }],
          position: node.position
        });
        continue;
      }
    }
    if (node)
      normalized.push(node);
  }
  const mergedCodes = mergeAdjacentCodeBlocks(normalized);
  const taggedDiffs = mergedCodes.map((child) => tagDiffBlock(child));
  return { ...tree, children: taggedDiffs };
}
function flattenCodeList(list) {
  if (!list.children.length || !list.children.every((item) => item.children.length === 1 && item.children[0]?.type === "code" && item.children[0].value !== void 0))
    return null;
  const codes = list.children.map((item) => item.children[0]);
  const sameLang = codes.every((c) => c.lang === codes[0]?.lang);
  const lang = sameLang ? codes[0]?.lang ?? void 0 : void 0;
  return {
    type: "code",
    lang: lang ?? void 0,
    value: codes.map((c) => c.value).join("\n"),
    position: list.position
  };
}
function mergeAdjacentCodeBlocks(nodes) {
  const out = [];
  let pending = null;
  const flush = () => {
    if (pending) {
      out.push(pending);
      pending = null;
    }
  };
  for (const node of nodes) {
    if (node?.type === "code") {
      if (pending && (pending.lang === node.lang || !pending.lang && !node.lang)) {
        const nextValue = `${pending.value}
${node.value}`;
        pending = {
          type: "code",
          lang: pending.lang,
          meta: pending.meta,
          value: nextValue,
          position: pending.position
        };
      } else {
        flush();
        pending = node;
      }
      continue;
    }
    if (node?.type === "list") {
      const flattened = flattenCodeList(node);
      if (flattened) {
        if (pending && (pending.lang === flattened.lang || !pending.lang && !flattened.lang)) {
          const nextValue = `${pending.value}
${flattened.value}`;
          pending = {
            type: "code",
            lang: pending.lang,
            meta: pending.meta,
            value: nextValue,
            position: pending.position
          };
        } else {
          flush();
          pending = flattened;
        }
        continue;
      }
    }
    flush();
    out.push(node);
  }
  flush();
  return out;
}
function looksLikeDiff(text) {
  const lines = text.split("\n").map((l) => l.trim());
  if (lines.some((l) => l.startsWith("diff --git") || l.startsWith("--- a/") || l.startsWith("+++ b/") || l.startsWith("@@ ")))
    return true;
  const nonEmpty = lines.filter((l) => l !== "");
  if (nonEmpty.length < 3)
    return false;
  const markers = nonEmpty.filter((l) => /^[+\-@]/.test(l)).length;
  return markers >= Math.max(3, Math.ceil(nonEmpty.length * 0.6));
}
function tagDiffBlock(node) {
  if (node?.type === "code" && !node.lang && looksLikeDiff(node.value)) {
    return { ...node, lang: "diff" };
  }
  return node;
}
var HR_WIDTH = 40;
var MAX_COL = 40;
var TABLE_BOX = {
  unicode: {
    topLeft: "\u250C",
    topRight: "\u2510",
    bottomLeft: "\u2514",
    bottomRight: "\u2518",
    hSep: "\u2500",
    vSep: "\u2502",
    tSep: "\u252C",
    mSep: "\u253C",
    bSep: "\u2534",
    mLeft: "\u251C",
    mRight: "\u2524"
  },
  ascii: {
    topLeft: "+",
    topRight: "+",
    bottomLeft: "+",
    bottomRight: "+",
    hSep: "-",
    vSep: "|",
    tSep: "+",
    mSep: "+",
    bSep: "+",
    mLeft: "+",
    mRight: "+"
  }
};
function render(markdown, userOptions = {}) {
  const options = resolveOptions(userOptions);
  const style = createStyler({ color: options.color });
  const tree = normalizeNodes(parse(dedent(markdown)));
  const ctx = { options, style };
  const body = renderChildren(tree.children, ctx, 0, true).join("");
  return options.color ? body : stripAnsi2(body);
}
function renderChildren(children, ctx, indentLevel = 0, isTightList = false) {
  const out = [];
  for (let i = 0; i < children.length; i += 1) {
    const node = children[i];
    if (!node)
      continue;
    if (node.type === "paragraph" && node.children.length === 1 && node.children[0]?.type === "text") {
      const langMatch = node.children[0]?.value.trim().match(/^\[([^\]]+)]$/);
      const next = children[i + 1];
      if (langMatch && next && next.type === "code" && !next.lang) {
        next.lang = langMatch[1];
        i += 1;
        out.push(renderNode(next, ctx, indentLevel, isTightList));
        continue;
      }
    }
    out.push(renderNode(node, ctx, indentLevel, isTightList));
  }
  return out.flat();
}
function renderNode(node, ctx, indentLevel, isTightList) {
  switch (node.type) {
    case "paragraph":
      return renderParagraph(node, ctx, indentLevel);
    case "heading":
      return renderHeading(node, ctx);
    case "thematicBreak":
      return renderHr(ctx);
    case "blockquote":
      return renderBlockquote(node, ctx, indentLevel);
    case "list":
      return renderList(node, ctx, indentLevel);
    case "listItem":
      return renderListItem(node, ctx, indentLevel, isTightList);
    case "code":
      return renderCodeBlock(node, ctx);
    case "table":
      return renderTable(node, ctx);
    case "definition":
      return renderDefinition(node, ctx);
    default:
      return [];
  }
}
function renderParagraph(node, ctx, indentLevel) {
  const text = normalizeParagraphInlineText(renderInline(node.children, ctx));
  const prefix = " ".repeat(ctx.options.listIndent * indentLevel);
  const rawLines = text.split("\n");
  const normalized = [];
  const defPattern = /^\[[^\]]+]:\s+\S/;
  let inDefinitions = false;
  for (const line of rawLines) {
    if (defPattern.test(line) && normalized.length > 0 && normalized.at(-1) !== "") {
      normalized.push("");
    }
    if (defPattern.test(line)) {
      inDefinitions = true;
      normalized.push(line);
      continue;
    }
    if (inDefinitions && line.trim() === "") {
      continue;
    }
    inDefinitions = false;
    normalized.push(line);
  }
  const lines = normalized.flatMap((l) => wrapWithPrefix(l, ctx.options.width ?? 80, ctx.options.wrap, prefix));
  return lines.map((l) => `${l}
`);
}
function renderHeading(node, ctx) {
  const text = renderInline(node.children, ctx);
  const styled = ctx.style(text, ctx.options.theme.heading);
  return [`
${styled}
`];
}
function renderHr(ctx) {
  const width = ctx.options.wrap ? Math.min(ctx.options.width ?? HR_WIDTH, HR_WIDTH) : HR_WIDTH;
  const line = "\u2014".repeat(width);
  return [`${ctx.style(line, ctx.options.theme.hr)}
`];
}
function renderBlockquote(node, ctx, indentLevel) {
  const inner = renderChildren(node.children, ctx, indentLevel);
  const prefix = ctx.style(ctx.options.quotePrefix, ctx.options.theme.quote);
  const text = inner.join("").trimEnd();
  const wrapped = wrapWithPrefix(text, ctx.options.width ?? 80, ctx.options.wrap, prefix);
  return wrapped.map((l) => `${l}
`);
}
function renderList(node, ctx, indentLevel) {
  const tight = node.spread === false;
  const items = node.children.flatMap((item, idx) => renderListItem(item, ctx, indentLevel, tight, Boolean(node.ordered), node.start ?? 1, idx));
  return items;
}
function renderListItem(node, ctx, indentLevel, tight, ordered = false, start = 1, idx = 0) {
  const marker = ordered ? `${start + idx}.` : "-";
  const markerStyled = ctx.style(marker, ctx.options.theme.listMarker);
  const content = renderChildren(node.children, ctx, indentLevel + 1, tight).join("").trimEnd().split("\n");
  while (content.length && (content[0]?.trim() ?? "") === "") {
    content.shift();
  }
  const isTask = typeof node.checked === "boolean";
  const box = isTask && node.checked ? "[x]" : "[ ]";
  const firstBullet = " ".repeat(ctx.options.listIndent * indentLevel) + (isTask ? `${ctx.style(box, ctx.options.theme.listMarker)} ` : `${markerStyled} `);
  const lines = [];
  content.forEach((line, i) => {
    const clean = line.replace(/^\s+/, "");
    const prefix = i === 0 ? firstBullet : `${" ".repeat(ctx.options.listIndent * indentLevel)}${" ".repeat(ctx.options.listIndent)}`;
    lines.push(prefix + clean);
  });
  if (!tight)
    lines.push("");
  return lines.map((l) => `${l}
`);
}
function renderDefinition(node, _ctx) {
  const title = node.title ? ` "${node.title}"` : "";
  const line = `[${node.identifier}]: ${node.url ?? ""}${title}`;
  return [`
${line}
`];
}
function renderCodeBlock(node, ctx) {
  const theme = ctx.options.theme.blockCode || ctx.options.theme.inlineCode;
  const lines = (node.value ?? "").split("\n");
  const isDiff = node.lang === "diff";
  const gutterWidth = ctx.options.codeGutter ? String(lines.length).length + 2 : 0;
  const shouldWrap = isDiff ? false : ctx.options.codeWrap;
  const useBox = ctx.options.codeBox && lines.length > 1;
  const boxPadding = useBox ? 4 : 0;
  const wrapLimit = shouldWrap && ctx.options.wrap && ctx.options.width ? Math.max(1, ctx.options.width - boxPadding - gutterWidth) : void 0;
  const contentLines = lines.flatMap((line, idx) => {
    const segments = wrapLimit !== void 0 ? wrapCodeLine(line, wrapLimit) : [line];
    return segments.map((segment, segIdx) => {
      const highlighted = ctx.options.highlighter?.(segment, node.lang ?? void 0) ?? ctx.style(segment, theme);
      if (!ctx.options.codeGutter)
        return highlighted;
      const num = segIdx === 0 ? String(idx + 1).padStart(gutterWidth - 2, " ") : " ".repeat(gutterWidth - 1);
      return `${ctx.style(num, { dim: true })} ${highlighted}`;
    });
  });
  if (!useBox) {
    return [`${contentLines.join("\n")}

`];
  }
  const maxLine = Math.max(...contentLines.map((l) => visibleWidth(l)), 0);
  const minInner = node.lang ? node.lang.length + 2 : 0;
  const wrapTarget = ctx.options.codeWrap && ctx.options.width ? Math.min(maxLine, Math.max(1, ctx.options.width - 4)) : maxLine;
  const labelRaw = node.lang ? `[${node.lang}]` : "";
  const labelStyled = labelRaw ? ctx.style(labelRaw, { dim: true }) : "";
  const innerWidth = Math.max(ctx.options.codeWrap ? wrapTarget : maxLine, minInner, labelRaw.length);
  const topPadding = Math.max(0, innerWidth - labelRaw.length + 1);
  const topRaw = labelRaw.length > 0 ? `\u250C ${labelStyled}${"\u2500".repeat(topPadding)}\u2510` : `\u250C ${"\u2500".repeat(innerWidth)} \u2510`;
  const bottomRaw = `\u2514${"\u2500".repeat(innerWidth + 2)}\u2518`;
  const top = ctx.style(topRaw, { dim: true });
  const bottom = ctx.style(bottomRaw, { dim: true });
  const boxLines = contentLines.map((ln) => {
    const pad = Math.max(0, innerWidth - visibleWidth(ln));
    const left = ctx.style("\u2502 ", { dim: true });
    const right = ctx.style(" \u2502", { dim: true });
    return `${left}${ln}${" ".repeat(pad)}${right}`;
  });
  return [`${top}
${boxLines.join("\n")}
${bottom}

`];
}
function renderInline(children, ctx) {
  let out = "";
  for (const node of children) {
    switch (node.type) {
      case "text":
        out += node.value;
        break;
      case "emphasis":
        out += ctx.style(renderInline(node.children, ctx), ctx.options.theme.emph);
        break;
      case "strong":
        out += ctx.style(renderInline(node.children, ctx), ctx.options.theme.strong);
        break;
      case "delete":
        out += ctx.style(renderInline(node.children, ctx), { strike: true });
        break;
      case "inlineCode": {
        const codeTheme = ctx.options.theme.inlineCode || ctx.options.theme.blockCode;
        const content = ctx.style(node.value, codeTheme);
        out += content;
        break;
      }
      case "link":
        out += renderLink(node, ctx);
        break;
      case "break":
        out += HARD_BREAK;
        break;
      default:
        if ("value" in node && typeof node.value === "string")
          out += node.value;
    }
  }
  return out;
}
var HARD_BREAK = "\v";
function normalizeParagraphInlineText(text) {
  if (!text.includes("\n") && !text.includes(HARD_BREAK))
    return text;
  const segments = [];
  let current = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "\n" || ch === HARD_BREAK) {
      segments.push({
        text: current,
        breakAfter: ch === HARD_BREAK ? "hard" : "soft"
      });
      current = "";
      continue;
    }
    current += ch;
  }
  segments.push({ text: current });
  const defPattern = /^\[[^\]]+]:\s+\S/;
  let out = segments[0]?.text ?? "";
  for (let i = 0; i < segments.length - 1; i += 1) {
    const kind = segments[i]?.breakAfter ?? "soft";
    const left = segments[i]?.text ?? "";
    const right = segments[i + 1]?.text ?? "";
    if (kind === "hard") {
      out += "\n";
      out += right;
      continue;
    }
    const leftTrim = left.trimStart();
    const rightTrim = right.trimStart();
    const keepNewline = left === "" || right === "" || defPattern.test(leftTrim) || defPattern.test(rightTrim);
    out += keepNewline ? "\n" : " ";
    out += rightTrim;
  }
  return out;
}
function renderLink(node, ctx) {
  const label = renderInline(node.children, ctx) || node.url;
  const url = node.url || "";
  if (url.startsWith("mailto:")) {
    return label;
  }
  if (ctx.options.hyperlinks && url) {
    return osc8(url, label);
  }
  if (url && label !== url) {
    return ctx.style(label, ctx.options.theme.link) + ctx.style(` (${url})`, { dim: true });
  }
  return ctx.style(label, ctx.options.theme.link);
}
function renderTable(node, ctx) {
  const header = node.children[0];
  if (!header)
    return [];
  const rows = node.children.slice(1);
  const cells = [header, ...rows].map((row) => row.children.map((cell) => renderInline(cell.children, ctx)));
  const colCount = Math.max(...cells.map((r) => r.length));
  const widths = new Array(colCount).fill(1);
  const aligns = node.align || [];
  const pad = ctx.options.tablePadding;
  const padStr = " ".repeat(Math.max(0, pad));
  const minContent = Math.max(1, ctx.options.tableEllipsis.length + 1);
  const minColWidth = Math.max(1, pad * 2 + minContent);
  cells.forEach((row) => {
    row.forEach((cell, idx) => {
      const padded = `${padStr}${cell}${padStr}`;
      widths[idx] = Math.max(widths[idx], Math.min(MAX_COL, visibleWidth(padded)));
    });
  });
  const totalWidth = widths.reduce((a, b) => a + b, 0) + 3 * colCount + 1;
  if (ctx.options.wrap && ctx.options.width && totalWidth > ctx.options.width) {
    let over = totalWidth - ctx.options.width;
    while (over > 0) {
      const i = widths.indexOf(Math.max(...widths));
      if (widths[i] <= minColWidth)
        break;
      widths[i] -= 1;
      over -= 1;
    }
  }
  for (let i = 0; i < widths.length; i += 1) {
    if (widths[i] < minColWidth)
      widths[i] = minColWidth;
  }
  const renderRow = (row, isHeader = false) => {
    const linesPerCol = row.map((cell, idx) => {
      const target = Math.max(minContent, widths[idx] - pad * 2);
      const content = ctx.options.tableTruncate ? truncateCell(cell, target, ctx.options.tableEllipsis) : cell;
      const wrapped = wrapText(content, ctx.options.wrap ? target : Number.MAX_SAFE_INTEGER, ctx.options.wrap);
      return wrapped.map((l) => {
        const aligned = padCell(l, target, aligns[idx] ?? "left");
        const padded = `${padStr}${aligned}${padStr}`;
        return padCell(padded, widths[idx], "left");
      });
    });
    const height = Math.max(...linesPerCol.map((c) => c.length));
    const out2 = [];
    for (let i = 0; i < height; i += 1) {
      const parts = linesPerCol.map((col, idx) => {
        const content = col[i] ?? padCell("", widths[idx], aligns[idx] ?? "left");
        return isHeader ? ctx.style(content, ctx.options.theme.tableHeader) : ctx.style(content, ctx.options.theme.tableCell);
      });
      out2.push(parts);
    }
    return out2;
  };
  const headerRows = renderRow(header.children.map((c) => renderInline(c.children, ctx)), true);
  const bodyRows = rows.flatMap((r) => renderRow(r.children.map((c) => renderInline(c.children, ctx))));
  if (ctx.options.tableBorder === "none") {
    const lines = [...headerRows, ...bodyRows].map((row) => row.join(" | ")).join("\n");
    return [`${lines}

`];
  }
  const box = TABLE_BOX[ctx.options.tableBorder] || TABLE_BOX.unicode;
  const hLine = (sepMid, sepLeft, sepRight) => `${sepLeft}${widths.map((w) => box.hSep.repeat(w)).join(sepMid)}${sepRight}
`;
  const top = hLine(box.tSep, box.topLeft, box.topRight);
  const mid = hLine(box.mSep, box.mLeft, box.mRight);
  const bottom = hLine(box.bSep, box.bottomLeft, box.bottomRight);
  const renderFlat = (rowsArr) => rowsArr.map((r) => `${box.vSep}${r.map((c) => c).join(box.vSep)}${box.vSep}
`).join("");
  const dense = ctx.options.tableDense;
  const out = [
    top,
    renderFlat(headerRows),
    dense ? "" : mid,
    renderFlat(bodyRows),
    bottom,
    "\n"
  ];
  return out;
}
function truncateCell(text, width, ellipsis) {
  if (stringWidth2(text) <= width)
    return text;
  if (width <= ellipsis.length)
    return ellipsis.slice(0, width);
  return text.slice(0, width - ellipsis.length) + ellipsis;
}
function wrapCodeLine(text, width) {
  if (width <= 0)
    return [text];
  const parts = [];
  let current = "";
  for (const ch of [...text]) {
    const chWidth = stringWidth2(ch);
    if (visibleWidth(current) + chWidth > width) {
      parts.push(current);
      current = ch;
      continue;
    }
    current += ch;
  }
  if (current !== "")
    parts.push(current);
  return parts.length ? parts : [""];
}
function padCell(text, width, align = "left", _padSpaces = 0) {
  const core = text;
  const pad = width - stringWidth2(stripAnsi2(core));
  if (pad <= 0)
    return core;
  if (align === "right")
    return `${" ".repeat(pad)}${core}`;
  if (align === "center") {
    const left = Math.floor(pad / 2);
    const right = pad - left;
    return `${" ".repeat(left)}${core}${" ".repeat(right)}`;
  }
  return `${core}${" ".repeat(pad)}`;
}

// node_modules/markdansi/dist/stream.js
function normalizeNewlines(input) {
  return input.replace(/\r\n?/g, "\n");
}
function isFenceStart(line) {
  const trimmed = line.trimStart();
  const match = trimmed.match(/^(```+|~~~+)/);
  if (!match?.[1])
    return null;
  const token = match[1];
  const char = token[0] === "~" ? "~" : "`";
  return { char, len: token.length };
}
function isFenceEnd(line, fence) {
  const trimmed = line.trimStart();
  const token = fence.char.repeat(fence.len);
  return trimmed.startsWith(token);
}
function looksLikeTableHeader(line) {
  if (!line.includes("|"))
    return false;
  return /[^\s|]/.test(line);
}
function isTableSeparator(line) {
  const trimmed = line.trim();
  if (!trimmed.includes("-"))
    return false;
  return /^\|?(?:\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(trimmed);
}
function looksLikeTableRow(line) {
  if (!line.includes("|"))
    return false;
  return /[^\s|]/.test(line);
}
function normalizeRenderedFragment(rendered) {
  const trimmedStart = rendered.replace(/^\n+/, "");
  const trimmedEnd = trimmedStart.replace(/\n+$/, "");
  return `${trimmedEnd}
`;
}
function createMarkdownStreamer(options) {
  const render2 = options.render;
  const spacing = options.spacing ?? "single";
  let buffer = "";
  let blankStreak = 0;
  let started = false;
  let heldTableHeader = null;
  let inTable = false;
  let tableBuffer = "";
  let fence = null;
  let fenceBuffer = "";
  const emitBlankLine = () => {
    if (!started)
      return "";
    if (spacing === "tight")
      return "";
    if (spacing === "single" && blankStreak >= 1)
      return "";
    blankStreak += 1;
    return "\n";
  };
  const emitRendered = (markdown) => {
    if (!markdown)
      return "";
    blankStreak = 0;
    started = true;
    return normalizeRenderedFragment(render2(markdown));
  };
  const flushHeldHeader = () => {
    if (!heldTableHeader)
      return "";
    const md = heldTableHeader;
    heldTableHeader = null;
    return emitRendered(md);
  };
  const flushTable = () => {
    if (!inTable)
      return "";
    inTable = false;
    const md = tableBuffer;
    tableBuffer = "";
    return emitRendered(md);
  };
  const flushFence = () => {
    if (!fence)
      return "";
    fence = null;
    const md = fenceBuffer;
    fenceBuffer = "";
    return emitRendered(md);
  };
  const processLine = (line) => {
    if (fence) {
      fenceBuffer += `${line}
`;
      if (isFenceEnd(line, fence)) {
        return flushFence();
      }
      return "";
    }
    if (inTable) {
      if (line.trim().length === 0) {
        return flushTable() + emitBlankLine();
      }
      if (!looksLikeTableRow(line)) {
        return flushTable() + processLine(line);
      }
      tableBuffer += `${line}
`;
      return "";
    }
    if (line.trim().length === 0) {
      return flushHeldHeader() + emitBlankLine();
    }
    const fenceStart = isFenceStart(line);
    if (fenceStart) {
      const out = flushHeldHeader();
      fence = fenceStart;
      fenceBuffer = `${line}
`;
      if (isFenceEnd(line, fenceStart) && line.trimStart().match(/^(```+|~~~+)\s*$/)) {
        return out + flushFence();
      }
      return out;
    }
    if (heldTableHeader) {
      if (isTableSeparator(line) && looksLikeTableHeader(heldTableHeader)) {
        inTable = true;
        tableBuffer = `${heldTableHeader}
${line}
`;
        heldTableHeader = null;
        return "";
      }
      const out = flushHeldHeader();
      return out + processLine(line);
    }
    if (looksLikeTableHeader(line)) {
      heldTableHeader = line;
      return "";
    }
    return emitRendered(line);
  };
  const push = (delta) => {
    if (!delta)
      return "";
    buffer += normalizeNewlines(delta);
    let out = "";
    while (true) {
      const idx = buffer.indexOf("\n");
      if (idx < 0)
        break;
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      out += processLine(line);
    }
    return out;
  };
  const finish = (finalDelta) => {
    let out = "";
    if (finalDelta)
      out += push(finalDelta);
    if (buffer.length > 0) {
      out += processLine(buffer);
      buffer = "";
    }
    out += flushHeldHeader();
    out += flushFence();
    out += flushTable();
    return out;
  };
  const reset = () => {
    buffer = "";
    blankStreak = 0;
    started = false;
    heldTableHeader = null;
    inTable = false;
    tableBuffer = "";
    fence = null;
    fenceBuffer = "";
  };
  return { push, finish, reset };
}

// src/cli/markdownRenderer.ts
function renderMarkdownAnsi(markdown) {
  try {
    const color = Boolean(process.stdout.isTTY);
    const width = process.stdout.columns;
    const hyperlinks = color;
    return render(markdown, {
      color,
      width,
      wrap: true,
      hyperlinks
    });
  } catch {
    return markdown;
  }
}

// src/oracle/background.ts
import { APIConnectionError as APIConnectionError2, APIConnectionTimeoutError as APIConnectionTimeoutError2 } from "openai";
import chalk2 from "chalk";
var BACKGROUND_POLL_INTERVAL_MS = 5e3;
var BACKGROUND_RETRY_BASE_MS = 3e3;
var BACKGROUND_RETRY_MAX_MS = 15e3;
async function executeBackgroundResponse(params) {
  const { client, requestBody, log, wait: wait2, heartbeatIntervalMs, now, maxWaitMs } = params;
  let initialResponse;
  try {
    initialResponse = await client.responses.create(requestBody);
  } catch (error) {
    const transportError = toTransportError(error, requestBody.model);
    log(chalk2.yellow(describeTransportError(transportError, maxWaitMs)));
    throw transportError;
  }
  if (!initialResponse || !initialResponse.id) {
    throw new OracleResponseError("API did not return a response ID for the background run.", initialResponse);
  }
  const responseId = initialResponse.id;
  log(
    chalk2.dim(
      `API scheduled background response ${responseId} (status=${initialResponse.status ?? "unknown"}). Monitoring up to ${Math.round(
        maxWaitMs / 6e4
      )} minutes for completion...`
    )
  );
  let heartbeatActive = false;
  let stopHeartbeat = null;
  const stopHeartbeatNow = () => {
    if (!heartbeatActive) return;
    heartbeatActive = false;
    stopHeartbeat?.();
    stopHeartbeat = null;
  };
  if (heartbeatIntervalMs && heartbeatIntervalMs > 0) {
    heartbeatActive = true;
    stopHeartbeat = startHeartbeat({
      intervalMs: heartbeatIntervalMs,
      log: (message) => log(message),
      isActive: () => heartbeatActive,
      makeMessage: (elapsedMs) => {
        const elapsedText = formatElapsed(elapsedMs);
        return `API background run still in progress \u2014 ${elapsedText} elapsed.`;
      }
    });
  }
  try {
    return await pollBackgroundResponse({
      client,
      responseId,
      initialResponse,
      log,
      wait: wait2,
      now,
      maxWaitMs
    });
  } finally {
    stopHeartbeatNow();
  }
}
async function pollBackgroundResponse(params) {
  const { client, responseId, initialResponse, log, wait: wait2, now, maxWaitMs } = params;
  const startMark = now();
  let response = initialResponse;
  let firstCycle = true;
  let lastStatus = response.status;
  while (true) {
    const status = response.status ?? "completed";
    if (firstCycle) {
      firstCycle = false;
      log(chalk2.dim(`API background response status=${status}. We'll keep retrying automatically.`));
    } else if (status !== lastStatus && status !== "completed") {
      log(chalk2.dim(`API background response status=${status}.`));
    }
    lastStatus = status;
    if (status === "completed") {
      return response;
    }
    if (status !== "in_progress" && status !== "queued") {
      const detail = response.error?.message || response.incomplete_details?.reason || status;
      throw new OracleResponseError(`Response did not complete: ${detail}`, response);
    }
    if (now() - startMark >= maxWaitMs) {
      throw new OracleTransportError("client-timeout", "Timed out waiting for API background response to finish.");
    }
    await wait2(BACKGROUND_POLL_INTERVAL_MS);
    if (now() - startMark >= maxWaitMs) {
      throw new OracleTransportError("client-timeout", "Timed out waiting for API background response to finish.");
    }
    const { response: nextResponse, reconnected } = await retrieveBackgroundResponseWithRetry({
      client,
      responseId,
      wait: wait2,
      now,
      maxWaitMs,
      startMark,
      log
    });
    if (reconnected) {
      const nextStatus = nextResponse.status ?? "in_progress";
      log(chalk2.dim(`Reconnected to API background response (status=${nextStatus}). API is still working...`));
    }
    response = nextResponse;
  }
}
async function retrieveBackgroundResponseWithRetry(params) {
  const { client, responseId, wait: wait2, now, maxWaitMs, startMark, log } = params;
  let retries = 0;
  while (true) {
    try {
      const next = await client.responses.retrieve(responseId);
      return { response: next, reconnected: retries > 0 };
    } catch (error) {
      const transportError = asRetryableTransportError(error);
      if (!transportError) {
        throw error;
      }
      retries += 1;
      const delay = Math.min(BACKGROUND_RETRY_BASE_MS * 2 ** (retries - 1), BACKGROUND_RETRY_MAX_MS);
      log(chalk2.yellow(`${describeTransportError(transportError, maxWaitMs)} Retrying in ${formatElapsed(delay)}...`));
      await wait2(delay);
      if (now() - startMark >= maxWaitMs) {
        throw new OracleTransportError("client-timeout", "Timed out waiting for API background response to finish.");
      }
    }
  }
}
function asRetryableTransportError(error) {
  if (error instanceof OracleTransportError) {
    return error;
  }
  if (error instanceof APIConnectionError2 || error instanceof APIConnectionTimeoutError2) {
    return toTransportError(error);
  }
  return null;
}

// src/oracle/runUtils.ts
function resolvePreviewMode(value) {
  const allowed = /* @__PURE__ */ new Set(["summary", "json", "full"]);
  if (typeof value === "string" && value.length > 0) {
    return allowed.has(value) ? value : "summary";
  }
  if (value) {
    return "summary";
  }
  return void 0;
}
function formatTokenCount(value) {
  if (Math.abs(value) >= 1e3) {
    const abbreviated = (value / 1e3).toFixed(2).replace(/\.0+$/, "").replace(/\.([1-9]*)0$/, ".$1");
    return `${abbreviated}k`;
  }
  return value.toLocaleString();
}
function formatTokenEstimate(value, format = (text) => text) {
  return format(formatTokenCount(value));
}
function formatTokenValue(value, usage, index) {
  const estimatedFlag = index === 0 && usage?.input_tokens == null || index === 1 && usage?.output_tokens == null || index === 2 && usage?.reasoning_tokens == null || index === 3 && usage?.total_tokens == null;
  const text = formatTokenCount(value);
  return estimatedFlag ? `${text}*` : text;
}

// src/oracle/run.ts
import { estimateUsdCost } from "tokentally";
var isStdoutTty = process3.stdout.isTTY && chalk3.level > 0;
var dim2 = (text) => isStdoutTty ? kleur.dim(text) : text;
var DEFAULT_TIMEOUT_NON_PRO_MS = 12e4;
var DEFAULT_TIMEOUT_PRO_MS = 60 * 60 * 1e3;
var defaultWait = (ms) => new Promise((resolve2) => {
  setTimeout(resolve2, ms);
});
async function runOracle(options, deps = {}) {
  const {
    apiKey: optionsApiKey = options.apiKey,
    cwd = process3.cwd(),
    fs: fsModule = createFsAdapter(fs3),
    log = console.log,
    write: sinkWrite = (_text) => true,
    allowStdout = true,
    stdoutWrite: stdoutWriteDep,
    now = () => performance.now(),
    clientFactory = createDefaultClientFactory(),
    client,
    wait: wait2 = defaultWait
  } = deps;
  const stdoutWrite = allowStdout ? stdoutWriteDep ?? process3.stdout.write.bind(process3.stdout) : () => true;
  const isTty4 = allowStdout && isStdoutTty;
  function resolveRouting(model, explicitBaseUrl, env = process3.env) {
    if (explicitBaseUrl) {
      const key = isOpenRouterBaseUrl(explicitBaseUrl) ? env.OPENROUTER_API_KEY?.trim() : env.OPENAI_API_KEY?.trim();
      return {
        baseUrl: explicitBaseUrl,
        apiKey: key ?? optionsApiKey,
        source: isOpenRouterBaseUrl(explicitBaseUrl) ? "OPENROUTER_API_KEY" : "OPENAI_API_KEY"
      };
    }
    if (model.includes("/")) {
      return {
        baseUrl: defaultOpenRouterBaseUrl(),
        apiKey: env.OPENROUTER_API_KEY?.trim() ?? optionsApiKey,
        source: "OPENROUTER_API_KEY"
      };
    }
    const provider = resolveProvider(model);
    switch (provider) {
      case "google":
        return {
          baseUrl: void 0,
          apiKey: optionsApiKey ?? env.GEMINI_API_KEY?.trim(),
          source: "GEMINI_API_KEY"
        };
      case "xai":
        return {
          baseUrl: env.XAI_BASE_URL?.trim() || "https://api.x.ai/v1",
          apiKey: optionsApiKey ?? env.XAI_API_KEY?.trim(),
          source: "XAI_API_KEY"
        };
      case "openai":
        return {
          baseUrl: env.OPENAI_BASE_URL?.trim(),
          apiKey: optionsApiKey ?? env.OPENAI_API_KEY?.trim(),
          source: "OPENAI_API_KEY"
        };
      case "anthropic":
      default:
        return {
          baseUrl: defaultOpenRouterBaseUrl(),
          apiKey: env.OPENROUTER_API_KEY?.trim() ?? optionsApiKey,
          source: "OPENROUTER_API_KEY"
        };
    }
  }
  const routing = resolveRouting(options.model, options.baseUrl?.trim());
  let baseUrl = routing.baseUrl;
  const apiKey = routing.apiKey;
  const envVar = routing.source;
  if (baseUrl && isOpenRouterBaseUrl(baseUrl)) {
    baseUrl = normalizeOpenRouterBaseUrl(baseUrl);
  }
  if (!apiKey) {
    throw new PromptValidationError(
      `Missing ${envVar}. Set it via the environment or a .env file.`,
      { env: envVar }
    );
  }
  const logVerbose = (message) => {
    if (options.verbose) {
      log(dim2(`[verbose] ${message}`));
    }
  };
  const previewMode = resolvePreviewMode(options.previewMode ?? options.preview);
  const isPreview = Boolean(previewMode);
  const minPromptLength = Number.parseInt(process3.env.ORACLE_MIN_PROMPT_CHARS ?? "10", 10);
  const promptLength = options.prompt?.trim().length ?? 0;
  const isProTierModel = isProModel(options.model);
  if (isProTierModel && !Number.isNaN(minPromptLength) && promptLength < minPromptLength) {
    throw new PromptValidationError(
      `Prompt is too short (<${minPromptLength} chars). This was likely accidental; please provide more detail.`,
      { minPromptLength, promptLength }
    );
  }
  const resolverOpenRouterApiKey = isOpenRouterBaseUrl(baseUrl) ? process3.env.OPENROUTER_API_KEY?.trim() ?? apiKey : void 0;
  const modelConfig = await resolveModelConfig(options.model, {
    baseUrl,
    openRouterApiKey: resolverOpenRouterApiKey
  });
  const isLongRunningModel = isProTierModel;
  const supportsBackground = modelConfig.supportsBackground !== false;
  const useBackground = supportsBackground ? options.background ?? isLongRunningModel : false;
  const inputTokenBudget = options.maxInput ?? modelConfig.inputLimit;
  const files = await readFiles(options.file ?? [], { cwd, fsModule });
  const searchEnabled = options.search !== false;
  logVerbose(`cwd: ${cwd}`);
  let pendingNoFilesTip = null;
  let pendingShortPromptTip = null;
  if (files.length > 0) {
    const displayPaths = files.map((file) => path5.relative(cwd, file.path) || file.path).slice(0, 10).join(", ");
    const extra = files.length > 10 ? ` (+${files.length - 10} more)` : "";
    logVerbose(`Attached files (${files.length}): ${displayPaths}${extra}`);
  } else {
    logVerbose("No files attached.");
    if (!isPreview) {
      pendingNoFilesTip = "Tip: no files attached \u2014 Oracle works best with project context. Add files via --file path/to/code or docs.";
    }
  }
  const shortPrompt = (options.prompt?.trim().length ?? 0) < 80;
  if (!isPreview && shortPrompt) {
    pendingShortPromptTip = "Tip: brief prompts often yield generic answers \u2014 aim for 6\u201330 sentences and attach key files.";
  }
  const fileTokenInfo = getFileTokenStats(files, {
    cwd,
    tokenizer: modelConfig.tokenizer,
    tokenizerOptions: TOKENIZER_OPTIONS,
    inputTokenBudget
  });
  const totalFileTokens = fileTokenInfo.totalTokens;
  logVerbose(`Attached files use ${totalFileTokens.toLocaleString()} tokens`);
  const systemPrompt = options.system?.trim() || DEFAULT_SYSTEM_PROMPT;
  const promptWithFiles = buildPrompt(options.prompt, files, cwd);
  const fileCount = files.length;
  const richTty = allowStdout && process3.stdout.isTTY && chalk3.level > 0;
  const renderPlain = Boolean(options.renderPlain);
  const timeoutSeconds = options.timeoutSeconds === void 0 || options.timeoutSeconds === "auto" ? isLongRunningModel ? DEFAULT_TIMEOUT_PRO_MS / 1e3 : DEFAULT_TIMEOUT_NON_PRO_MS / 1e3 : options.timeoutSeconds;
  const timeoutMs = timeoutSeconds * 1e3;
  const effectiveModelId = options.effectiveModelId ?? modelConfig.apiModel ?? modelConfig.model;
  const requestBody = buildRequestBody({
    modelConfig,
    systemPrompt,
    userPrompt: promptWithFiles,
    searchEnabled,
    maxOutputTokens: options.maxOutput,
    background: useBackground,
    storeResponse: useBackground
  });
  const estimatedInputTokens = estimateRequestTokens(requestBody, modelConfig);
  const tokenLabel = formatTokenEstimate(
    estimatedInputTokens,
    (text) => richTty ? chalk3.green(text) : text
  );
  const fileLabel = richTty ? chalk3.magenta(fileCount.toString()) : fileCount.toString();
  const filesPhrase = fileCount === 0 ? "no files" : `${fileLabel} files`;
  const headerModelLabelBase = richTty ? chalk3.cyan(modelConfig.model) : modelConfig.model;
  const headerModelSuffix = effectiveModelId !== modelConfig.model ? richTty ? chalk3.gray(` (API: ${effectiveModelId})`) : ` (API: ${effectiveModelId})` : "";
  const headerLine = `Calling ${headerModelLabelBase}${headerModelSuffix} \u2014 ${tokenLabel} tokens, ${filesPhrase}.`;
  const shouldReportFiles = (options.filesReport || fileTokenInfo.totalTokens > inputTokenBudget) && fileTokenInfo.stats.length > 0;
  if (!isPreview) {
    if (!options.suppressHeader) {
      log(headerLine);
    }
    const maskedKey = maskApiKey(apiKey);
    if (maskedKey && options.verbose) {
      const resolvedSuffix = effectiveModelId !== modelConfig.model ? ` (API: ${effectiveModelId})` : "";
      log(dim2(`Using ${envVar}=${maskedKey} for model ${modelConfig.model}${resolvedSuffix}`));
    }
    if (!options.suppressHeader && modelConfig.model === "gpt-5.1-pro" && effectiveModelId === "gpt-5.2-pro") {
      log(dim2("Note: `gpt-5.1-pro` is a stable CLI alias; OpenAI API uses `gpt-5.2-pro`."));
    }
    if (baseUrl) {
      log(dim2(`Base URL: ${formatBaseUrlForLog(baseUrl)}`));
    }
    if (effectiveModelId !== modelConfig.model) {
      log(dim2(`Resolved model: ${modelConfig.model} \u2192 ${effectiveModelId}`));
    }
    if (options.background && !supportsBackground) {
      log(
        dim2("Background runs are not supported for this model; streaming in foreground instead.")
      );
    }
    if (!options.suppressTips) {
      if (pendingNoFilesTip) {
        log(dim2(pendingNoFilesTip));
      }
      if (pendingShortPromptTip) {
        log(dim2(pendingShortPromptTip));
      }
    }
    if (isLongRunningModel) {
      log(dim2("This model can take up to 60 minutes (usually replies much faster)."));
    }
    if (options.verbose || isLongRunningModel) {
      log(dim2("Press Ctrl+C to cancel."));
    }
  }
  if (shouldReportFiles) {
    printFileTokenStats(fileTokenInfo, { inputTokenBudget, log });
  }
  if (estimatedInputTokens > inputTokenBudget) {
    throw new PromptValidationError(
      `Input too large (${estimatedInputTokens.toLocaleString()} tokens). Limit is ${inputTokenBudget.toLocaleString()} tokens.`,
      { estimatedInputTokens, inputTokenBudget }
    );
  }
  logVerbose(`Estimated tokens (request body): ${estimatedInputTokens.toLocaleString()}`);
  if (isPreview && previewMode) {
    if (previewMode === "json" || previewMode === "full") {
      log("Request JSON");
      log(JSON.stringify(requestBody, null, 2));
      log("");
    }
    if (previewMode === "full") {
      log("Assembled Prompt");
      log(promptWithFiles);
      log("");
    }
    log(
      `Estimated input tokens: ${estimatedInputTokens.toLocaleString()} / ${inputTokenBudget.toLocaleString()} (model: ${modelConfig.model})`
    );
    return {
      mode: "preview",
      previewMode,
      requestBody,
      estimatedInputTokens,
      inputTokenBudget
    };
  }
  const modelProviderForDispatch = resolveProvider(modelConfig.model);
  const useOpenRouter = isOpenRouterBaseUrl(baseUrl);
  const apiEndpoint = useOpenRouter ? baseUrl : modelProviderForDispatch === "google" ? void 0 : baseUrl;
  const clientInstance = client ?? clientFactory(apiKey, {
    baseUrl: apiEndpoint,
    model: options.model,
    resolvedModelId: effectiveModelId,
    httpTimeoutMs: options.httpTimeoutMs
  });
  logVerbose("Dispatching request to API...");
  if (options.verbose) {
    log("");
  }
  const stopOscProgress = startOscProgress({
    label: useBackground ? "Waiting for API (background)" : "Waiting for API",
    targetMs: useBackground ? timeoutMs : Math.min(timeoutMs, 10 * 6e4),
    indeterminate: true,
    write: sinkWrite
  });
  const runStart = now();
  let response = null;
  let elapsedMs = 0;
  let sawTextDelta = false;
  let answerHeaderPrinted = false;
  const allowAnswerHeader = options.suppressAnswerHeader !== true;
  const timeoutExceeded = () => now() - runStart >= timeoutMs;
  const throwIfTimedOut = () => {
    if (timeoutExceeded()) {
      throw new OracleTransportError(
        "client-timeout",
        `Timed out waiting for API response after ${formatElapsed(timeoutMs)}.`
      );
    }
  };
  const ensureAnswerHeader = () => {
    if (options.silent || answerHeaderPrinted) return;
    log("");
    if (allowAnswerHeader) {
      log(chalk3.bold("Answer:"));
    }
    answerHeaderPrinted = true;
  };
  try {
    if (useBackground) {
      response = await executeBackgroundResponse({
        client: clientInstance,
        requestBody,
        log,
        wait: wait2,
        heartbeatIntervalMs: options.heartbeatIntervalMs,
        now,
        maxWaitMs: timeoutMs
      });
      elapsedMs = now() - runStart;
    } else {
      let stream;
      try {
        stream = await clientInstance.responses.stream(requestBody);
      } catch (streamInitError) {
        const transportError = toTransportError(streamInitError, requestBody.model);
        log(chalk3.yellow(describeTransportError(transportError, timeoutMs)));
        throw transportError;
      }
      let heartbeatActive = false;
      let stopHeartbeat = null;
      const stopHeartbeatNow = () => {
        if (!heartbeatActive) {
          return;
        }
        heartbeatActive = false;
        stopHeartbeat?.();
        stopHeartbeat = null;
      };
      if (options.heartbeatIntervalMs && options.heartbeatIntervalMs > 0) {
        heartbeatActive = true;
        stopHeartbeat = startHeartbeat({
          intervalMs: options.heartbeatIntervalMs,
          log: (message) => log(message),
          isActive: () => heartbeatActive,
          makeMessage: (elapsedMs2) => {
            const elapsedText = formatElapsed(elapsedMs2);
            const remainingMs = Math.max(timeoutMs - elapsedMs2, 0);
            const remainingLabel = remainingMs >= 6e4 ? `${Math.ceil(remainingMs / 6e4)} min` : `${Math.max(1, Math.ceil(remainingMs / 1e3))}s`;
            return `API connection active \u2014 ${elapsedText} elapsed. Timeout in ~${remainingLabel} if no response.`;
          }
        });
      }
      let markdownStreamer = null;
      const flushMarkdownStreamer = () => {
        if (!markdownStreamer) return;
        const rendered = markdownStreamer.finish();
        markdownStreamer = null;
        if (rendered) {
          stdoutWrite(rendered);
        }
      };
      try {
        markdownStreamer = isTty4 && !renderPlain ? createMarkdownStreamer({
          render: renderMarkdownAnsi,
          spacing: "single",
          mode: "hybrid"
        }) : null;
        for await (const event of stream) {
          throwIfTimedOut();
          const isTextDelta = event.type === "chunk" || event.type === "response.output_text.delta";
          if (!isTextDelta) continue;
          stopOscProgress();
          stopHeartbeatNow();
          sawTextDelta = true;
          ensureAnswerHeader();
          if (options.silent || typeof event.delta !== "string") continue;
          sinkWrite(event.delta);
          if (renderPlain) {
            stdoutWrite(event.delta);
            continue;
          }
          if (markdownStreamer) {
            const rendered = markdownStreamer.push(event.delta);
            if (rendered) {
              stdoutWrite(rendered);
            }
            continue;
          }
          stdoutWrite(event.delta);
        }
        flushMarkdownStreamer();
        throwIfTimedOut();
      } catch (streamError) {
        flushMarkdownStreamer();
        stopHeartbeatNow();
        const transportError = toTransportError(streamError, requestBody.model);
        log(chalk3.yellow(describeTransportError(transportError, timeoutMs)));
        throw transportError;
      }
      response = await stream.finalResponse();
      throwIfTimedOut();
      stopHeartbeatNow();
      elapsedMs = now() - runStart;
    }
  } finally {
    stopOscProgress();
  }
  if (!response) {
    throw new Error("API did not return a response.");
  }
  if (sawTextDelta && !options.silent) {
    if (renderPlain) {
      stdoutWrite("\n");
    } else {
      log("");
    }
  }
  logVerbose(`Response status: ${response.status ?? "completed"}`);
  if (response.status && response.status !== "completed") {
    if (response.id && response.status === "in_progress") {
      const polishingStart = now();
      const pollIntervalMs = 2e3;
      const maxWaitMs = 18e4;
      log(chalk3.dim("Response still in_progress; polling until completion..."));
      while (now() - polishingStart < maxWaitMs) {
        throwIfTimedOut();
        await wait2(pollIntervalMs);
        const refreshed = await clientInstance.responses.retrieve(response.id);
        if (refreshed.status === "completed") {
          response = refreshed;
          break;
        }
      }
    }
    if (response.status !== "completed") {
      const detail = response.error?.message || response.incomplete_details?.reason || response.status;
      log(
        chalk3.yellow(
          `API ended the run early (status=${response.status}${response.incomplete_details?.reason ? `, reason=${response.incomplete_details.reason}` : ""}).`
        )
      );
      throw new OracleResponseError(`Response did not complete: ${detail}`, response);
    }
  }
  const answerText = extractTextOutput(response);
  if (!options.silent) {
    if (sawTextDelta) {
    } else {
      ensureAnswerHeader();
      const printable = answerText ? renderPlain || !richTty ? answerText : renderMarkdownAnsi(answerText) : chalk3.dim("(no text output)");
      sinkWrite(printable);
      if (!printable.endsWith("\n")) {
        sinkWrite("\n");
      }
      stdoutWrite(printable);
      if (!printable.endsWith("\n")) {
        stdoutWrite("\n");
      }
      log("");
    }
  }
  const usage = response.usage ?? {};
  const inputTokens = usage.input_tokens ?? estimatedInputTokens;
  const outputTokens = usage.output_tokens ?? 0;
  const reasoningTokens = usage.reasoning_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? inputTokens + outputTokens + reasoningTokens;
  const pricing = modelConfig.pricing ?? void 0;
  const cost = pricing ? estimateUsdCost({
    usage: { inputTokens, outputTokens, reasoningTokens, totalTokens },
    pricing: {
      inputUsdPerToken: pricing.inputPerToken,
      outputUsdPerToken: pricing.outputPerToken
    }
  })?.totalUsd : void 0;
  const effortLabel = modelConfig.reasoning?.effort;
  const modelLabel = effortLabel ? `${modelConfig.model}[${effortLabel}]` : modelConfig.model;
  const sessionIdContainsModel = typeof options.sessionId === "string" && options.sessionId.toLowerCase().includes(modelConfig.model.toLowerCase());
  const tokensDisplay = [inputTokens, outputTokens, reasoningTokens, totalTokens].map((value, index) => formatTokenValue(value, usage, index)).join("/");
  const tokensPart = (() => {
    const parts = tokensDisplay.split("/");
    if (parts.length !== 4) return tokensDisplay;
    return `\u2191${parts[0]} \u2193${parts[1]} \u21BB${parts[2]} \u0394${parts[3]}`;
  })();
  const modelPart = sessionIdContainsModel ? null : modelLabel;
  const actualInput = usage.input_tokens;
  const estActualPart = (() => {
    if (!options.verbose) return null;
    if (actualInput === void 0) return null;
    const delta = actualInput - estimatedInputTokens;
    const deltaText = delta === 0 ? "" : delta > 0 ? ` (+${delta.toLocaleString()})` : ` (${delta.toLocaleString()})`;
    return `est\u2192actual=${estimatedInputTokens.toLocaleString()}\u2192${actualInput.toLocaleString()}${deltaText}`;
  })();
  const { line1, line2 } = formatFinishLine({
    elapsedMs,
    model: modelPart,
    costUsd: cost ?? null,
    tokensPart,
    summaryExtraParts: options.sessionId ? [`sid=${options.sessionId}`] : null,
    detailParts: [
      estActualPart,
      !searchEnabled ? "search=off" : null,
      files.length > 0 ? `files=${files.length}` : null
    ]
  });
  if (!options.silent) {
    log("");
  }
  log(chalk3.blue(line1));
  if (line2) {
    log(dim2(line2));
  }
  return {
    mode: "live",
    response,
    usage: {
      inputTokens,
      outputTokens,
      reasoningTokens,
      totalTokens,
      ...cost != null ? { cost } : {}
    },
    elapsedMs
  };
}
function extractTextOutput(response) {
  if (Array.isArray(response.output_text) && response.output_text.length > 0) {
    return response.output_text.join("\n");
  }
  if (Array.isArray(response.output)) {
    const segments = [];
    for (const item of response.output) {
      if (Array.isArray(item.content)) {
        for (const chunk of item.content) {
          if (chunk && (chunk.type === "output_text" || chunk.type === "text") && chunk.text) {
            segments.push(chunk.text);
          }
        }
      } else if (typeof item.text === "string") {
        segments.push(item.text);
      }
    }
    return segments.join("\n");
  }
  return "";
}

// src/oracleHome.ts
import os2 from "node:os";
import path6 from "node:path";
var oracleHomeDirOverride = null;
function getOracleHomeDir() {
  return oracleHomeDirOverride ?? process.env.ORACLE_HOME_DIR ?? path6.join(os2.homedir(), ".oracle");
}

// src/sessionManager.ts
function getSessionsDir() {
  return path7.join(getOracleHomeDir(), "sessions");
}
var METADATA_FILENAME = "meta.json";
var LEGACY_SESSION_FILENAME = "session.json";
var LEGACY_REQUEST_FILENAME = "request.json";
var MODELS_DIRNAME = "models";
var MODEL_JSON_EXTENSION = ".json";
var MODEL_LOG_EXTENSION = ".log";
var MAX_STATUS_LIMIT = 1e3;
var ZOMBIE_MAX_AGE_MS = 60 * 60 * 1e3;
var DEFAULT_SLUG = "session";
var MAX_SLUG_WORDS = 5;
var MIN_CUSTOM_SLUG_WORDS = 3;
var MAX_SLUG_WORD_LENGTH = 10;
async function ensureDir(dirPath) {
  await fs4.mkdir(dirPath, { recursive: true });
}
async function ensureSessionStorage() {
  await ensureDir(getSessionsDir());
}
function slugify(text, maxWords = MAX_SLUG_WORDS) {
  const normalized = text?.toLowerCase() ?? "";
  const words = normalized.match(/[a-z0-9]+/g) ?? [];
  const trimmed = words.slice(0, maxWords).map((word) => word.slice(0, MAX_SLUG_WORD_LENGTH));
  return trimmed.length > 0 ? trimmed.join("-") : DEFAULT_SLUG;
}
function countSlugWords(slug) {
  return slug.split("-").filter(Boolean).length;
}
function normalizeCustomSlug(candidate) {
  const slug = slugify(candidate, MAX_SLUG_WORDS);
  const wordCount = countSlugWords(slug);
  if (wordCount < MIN_CUSTOM_SLUG_WORDS || wordCount > MAX_SLUG_WORDS) {
    throw new Error(
      `Custom slug must include between ${MIN_CUSTOM_SLUG_WORDS} and ${MAX_SLUG_WORDS} words.`
    );
  }
  return slug;
}
function createSessionId(prompt, customSlug) {
  if (customSlug) {
    return normalizeCustomSlug(customSlug);
  }
  return slugify(prompt);
}
function sessionDir(id) {
  return path7.join(getSessionsDir(), id);
}
function metaPath(id) {
  return path7.join(sessionDir(id), METADATA_FILENAME);
}
function requestPath(id) {
  return path7.join(sessionDir(id), LEGACY_REQUEST_FILENAME);
}
function legacySessionPath(id) {
  return path7.join(sessionDir(id), LEGACY_SESSION_FILENAME);
}
function logPath(id) {
  return path7.join(sessionDir(id), "output.log");
}
function modelsDir(id) {
  return path7.join(sessionDir(id), MODELS_DIRNAME);
}
function modelJsonPath(id, model) {
  const slug = safeModelSlug(model);
  return path7.join(modelsDir(id), `${slug}${MODEL_JSON_EXTENSION}`);
}
function modelLogPath(id, model) {
  const slug = safeModelSlug(model);
  return path7.join(modelsDir(id), `${slug}${MODEL_LOG_EXTENSION}`);
}
async function fileExists(targetPath) {
  try {
    await fs4.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
async function ensureUniqueSessionId(baseSlug) {
  let candidate = baseSlug;
  let suffix = 2;
  while (await fileExists(sessionDir(candidate))) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
async function listModelRunFiles(sessionId) {
  const dir = modelsDir(sessionId);
  const entries = await fs4.readdir(dir).catch(() => []);
  const result = [];
  for (const entry of entries) {
    if (!entry.endsWith(MODEL_JSON_EXTENSION)) {
      continue;
    }
    const jsonPath = path7.join(dir, entry);
    try {
      const raw = await fs4.readFile(jsonPath, "utf8");
      const parsed = JSON.parse(raw);
      const normalized = ensureModelLogReference(sessionId, parsed);
      result.push(normalized);
    } catch {
    }
  }
  return result;
}
function ensureModelLogReference(sessionId, record) {
  const logPathRelative = record.log?.path ?? path7.relative(sessionDir(sessionId), modelLogPath(sessionId, record.model));
  return {
    ...record,
    log: { path: logPathRelative, bytes: record.log?.bytes }
  };
}
async function readModelRunFile(sessionId, model) {
  try {
    const raw = await fs4.readFile(modelJsonPath(sessionId, model), "utf8");
    const parsed = JSON.parse(raw);
    return ensureModelLogReference(sessionId, parsed);
  } catch {
    return null;
  }
}
async function updateModelRunMetadata(sessionId, model, updates) {
  await ensureDir(modelsDir(sessionId));
  const existing = await readModelRunFile(sessionId, model) ?? {
    model,
    status: "pending"
  };
  const next = ensureModelLogReference(sessionId, {
    ...existing,
    ...updates,
    model
  });
  await fs4.writeFile(modelJsonPath(sessionId, model), JSON.stringify(next, null, 2), "utf8");
  return next;
}
async function initializeSession(options, cwd, baseSlugOverride) {
  await ensureSessionStorage();
  const baseSlug = baseSlugOverride || createSessionId(options.prompt || DEFAULT_SLUG, options.slug);
  const sessionId = await ensureUniqueSessionId(baseSlug);
  const dir = sessionDir(sessionId);
  await ensureDir(dir);
  const mode = "api";
  const modelList = Array.isArray(options.models) && options.models.length > 0 ? options.models : options.model ? [options.model] : [];
  const metadata = {
    id: sessionId,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    status: "pending",
    promptPreview: (options.prompt || "").slice(0, 160),
    model: modelList[0] ?? options.model,
    models: modelList.map((modelName) => ({
      model: modelName,
      status: "pending"
    })),
    cwd,
    mode,
    options: {
      prompt: options.prompt,
      file: options.file ?? [],
      model: options.model,
      models: modelList,
      effectiveModelId: options.effectiveModelId,
      maxInput: options.maxInput,
      system: options.system,
      maxOutput: options.maxOutput,
      silent: options.silent,
      filesReport: options.filesReport,
      slug: sessionId,
      mode,
      verbose: options.verbose,
      heartbeatIntervalMs: options.heartbeatIntervalMs,
      background: options.background,
      search: options.search,
      baseUrl: options.baseUrl,
      timeoutSeconds: options.timeoutSeconds,
      httpTimeoutMs: options.httpTimeoutMs,
      zombieTimeoutMs: options.zombieTimeoutMs,
      zombieUseLastActivity: options.zombieUseLastActivity,
      writeOutputPath: options.writeOutputPath,
      waitPreference: options.waitPreference,
      youtube: options.youtube,
      generateImage: options.generateImage,
      editImage: options.editImage,
      outputPath: options.outputPath,
      aspectRatio: options.aspectRatio,
      geminiShowThoughts: options.geminiShowThoughts
    }
  };
  await ensureDir(modelsDir(sessionId));
  await fs4.writeFile(metaPath(sessionId), JSON.stringify(metadata, null, 2), "utf8");
  await Promise.all(
    (modelList.length > 0 ? modelList : [metadata.model ?? DEFAULT_MODEL]).map(
      async (modelName) => {
        const jsonPath = modelJsonPath(sessionId, modelName);
        const logFilePath = modelLogPath(sessionId, modelName);
        const modelRecord = {
          model: modelName,
          status: "pending",
          log: { path: path7.relative(sessionDir(sessionId), logFilePath) }
        };
        await fs4.writeFile(jsonPath, JSON.stringify(modelRecord, null, 2), "utf8");
        await fs4.writeFile(logFilePath, "", "utf8");
      }
    )
  );
  await fs4.writeFile(logPath(sessionId), "", "utf8");
  return metadata;
}
async function readSessionMetadata(sessionId) {
  const modern = await readModernSessionMetadata(sessionId);
  if (modern) {
    return modern;
  }
  const legacy = await readLegacySessionMetadata(sessionId);
  if (legacy) {
    return legacy;
  }
  return null;
}
async function updateSessionMetadata(sessionId, updates) {
  const existing = await readModernSessionMetadata(sessionId) ?? await readLegacySessionMetadata(sessionId) ?? { id: sessionId };
  const next = { ...existing, ...updates };
  await fs4.writeFile(metaPath(sessionId), JSON.stringify(next, null, 2), "utf8");
  return next;
}
async function readModernSessionMetadata(sessionId) {
  try {
    const raw = await fs4.readFile(metaPath(sessionId), "utf8");
    const parsed = JSON.parse(raw);
    if (!isSessionMetadataRecord(parsed)) {
      return null;
    }
    const enriched = await attachModelRuns(parsed, sessionId);
    return await markZombie(enriched, { persist: false });
  } catch {
    return null;
  }
}
async function readLegacySessionMetadata(sessionId) {
  try {
    const raw = await fs4.readFile(legacySessionPath(sessionId), "utf8");
    const parsed = JSON.parse(raw);
    const enriched = await attachModelRuns(parsed, sessionId);
    return await markZombie(enriched, { persist: false });
  } catch {
    return null;
  }
}
function isSessionMetadataRecord(value) {
  return Boolean(
    value && typeof value.id === "string" && value.status
  );
}
async function attachModelRuns(meta, sessionId) {
  const runs = await listModelRunFiles(sessionId);
  if (runs.length === 0) {
    return meta;
  }
  return { ...meta, models: runs };
}
function createSessionLogWriter(sessionId, model) {
  const targetPath = model ? modelLogPath(sessionId, model) : logPath(sessionId);
  if (model) {
    void ensureDir(modelsDir(sessionId));
  }
  const stream = createWriteStream(targetPath, { flags: "a" });
  const logLine = (line = "") => {
    stream.write(`${line}
`);
  };
  const writeChunk = (chunk) => {
    stream.write(chunk);
    return true;
  };
  return { stream, logLine, writeChunk, logPath: targetPath };
}
async function listSessionsMetadata() {
  await ensureSessionStorage();
  const entries = await fs4.readdir(getSessionsDir()).catch(() => []);
  const metas = [];
  for (const entry of entries) {
    let meta = await readSessionMetadata(entry);
    if (meta) {
      meta = await markZombie(meta, { persist: true });
      metas.push(meta);
    }
  }
  return metas.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
function filterSessionsByRange(metas, {
  hours = 24,
  includeAll = false,
  limit = 100
}) {
  const maxLimit = Math.min(limit, MAX_STATUS_LIMIT);
  let filtered = metas;
  if (!includeAll) {
    const cutoff = Date.now() - hours * 60 * 60 * 1e3;
    filtered = metas.filter((meta) => new Date(meta.createdAt).getTime() >= cutoff);
  }
  const limited = filtered.slice(0, maxLimit);
  const truncated = filtered.length > maxLimit;
  return { entries: limited, truncated, total: filtered.length };
}
async function readSessionLog(sessionId) {
  const runs = await listModelRunFiles(sessionId);
  if (runs.length === 0) {
    try {
      return await fs4.readFile(logPath(sessionId), "utf8");
    } catch {
      return "";
    }
  }
  const sections = [];
  let hasContent = false;
  const ordered = runs.slice().sort(
    (a, b) => a.startedAt && b.startedAt ? a.startedAt.localeCompare(b.startedAt) : a.model.localeCompare(b.model)
  );
  for (const run of ordered) {
    const logFile = run.log?.path ? path7.isAbsolute(run.log.path) ? run.log.path : path7.join(sessionDir(sessionId), run.log.path) : modelLogPath(sessionId, run.model);
    let body = "";
    try {
      body = await fs4.readFile(logFile, "utf8");
    } catch {
      body = "";
    }
    if (body.length > 0) {
      hasContent = true;
    }
    sections.push(`=== ${run.model} ===
${body}`.trimEnd());
  }
  if (!hasContent) {
    try {
      return await fs4.readFile(logPath(sessionId), "utf8");
    } catch {
    }
  }
  return sections.join("\n\n");
}
async function readModelLog(sessionId, model) {
  try {
    return await fs4.readFile(modelLogPath(sessionId, model), "utf8");
  } catch {
    return "";
  }
}
async function readSessionRequest(sessionId) {
  const modern = await readModernSessionMetadata(sessionId);
  if (modern?.options) {
    return modern.options;
  }
  try {
    const raw = await fs4.readFile(requestPath(sessionId), "utf8");
    const parsed = JSON.parse(raw);
    if (isSessionMetadataRecord(parsed)) {
      return parsed.options ?? null;
    }
    return parsed;
  } catch {
    return null;
  }
}
async function deleteSessionsOlderThan({
  hours = 24,
  includeAll = false
} = {}) {
  await ensureSessionStorage();
  const entries = await fs4.readdir(getSessionsDir()).catch(() => []);
  if (!entries.length) {
    return { deleted: 0, remaining: 0 };
  }
  const cutoff = includeAll ? Number.NEGATIVE_INFINITY : Date.now() - hours * 60 * 60 * 1e3;
  let deleted = 0;
  for (const entry of entries) {
    const dir = sessionDir(entry);
    let createdMs;
    const meta = await readSessionMetadata(entry);
    if (meta?.createdAt) {
      const parsed = Date.parse(meta.createdAt);
      if (!Number.isNaN(parsed)) {
        createdMs = parsed;
      }
    }
    if (createdMs == null) {
      try {
        const stats = await fs4.stat(dir);
        createdMs = stats.birthtimeMs || stats.mtimeMs;
      } catch {
        continue;
      }
    }
    if (includeAll || createdMs != null && createdMs < cutoff) {
      await fs4.rm(dir, { recursive: true, force: true });
      deleted += 1;
    }
  }
  const remaining = Math.max(entries.length - deleted, 0);
  return { deleted, remaining };
}
async function wait(ms) {
  return new Promise((resolve2) => setTimeout(resolve2, ms));
}
async function getSessionPaths(sessionId) {
  const dir = sessionDir(sessionId);
  const metadata = metaPath(sessionId);
  const log = logPath(sessionId);
  const request = requestPath(sessionId);
  const required = [metadata, log];
  const missing = [];
  for (const file of required) {
    if (!await fileExists(file)) {
      missing.push(path7.basename(file));
    }
  }
  if (missing.length > 0) {
    throw new Error(`Session "${sessionId}" is missing: ${missing.join(", ")}`);
  }
  return { dir, metadata, log, request };
}
async function markZombie(meta, { persist }) {
  if (!await isZombie(meta)) {
    return meta;
  }
  const maxAgeMs = resolveZombieMaxAgeMs(meta);
  const updated = {
    ...meta,
    status: "error",
    errorMessage: `Session marked as zombie (> ${formatElapsed(maxAgeMs)} stale)`,
    completedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (persist) {
    await fs4.writeFile(metaPath(meta.id), JSON.stringify(updated, null, 2), "utf8");
  }
  return updated;
}
async function isZombie(meta) {
  if (meta.status !== "running") {
    return false;
  }
  const reference = meta.startedAt ?? meta.createdAt;
  if (!reference) {
    return false;
  }
  const startedMs = Date.parse(reference);
  if (Number.isNaN(startedMs)) {
    return false;
  }
  const useLastActivity = meta.options?.zombieUseLastActivity === true;
  const lastActivityMs = useLastActivity ? await getLastActivityMs(meta) : null;
  const anchorMs = lastActivityMs ?? startedMs;
  const maxAgeMs = resolveZombieMaxAgeMs(meta);
  return Date.now() - anchorMs > maxAgeMs;
}
function resolveZombieMaxAgeMs(meta) {
  const explicit = meta.options?.zombieTimeoutMs;
  const hasExplicit = typeof explicit === "number" && Number.isFinite(explicit) && explicit > 0;
  let maxAgeMs = hasExplicit ? explicit : ZOMBIE_MAX_AGE_MS;
  if (!hasExplicit) {
    const timeoutSeconds = meta.options?.timeoutSeconds;
    if (typeof timeoutSeconds === "number" && Number.isFinite(timeoutSeconds) && timeoutSeconds > 0) {
      const timeoutMs = timeoutSeconds * 1e3;
      if (timeoutMs > maxAgeMs) {
        maxAgeMs = timeoutMs;
      }
    }
  }
  return maxAgeMs;
}
async function getLastActivityMs(meta) {
  const candidates = /* @__PURE__ */ new Set();
  candidates.add(logPath(meta.id));
  const modelNames = /* @__PURE__ */ new Set();
  if (typeof meta.model === "string" && meta.model.length > 0) {
    modelNames.add(meta.model);
  }
  if (Array.isArray(meta.models)) {
    for (const entry of meta.models) {
      if (entry?.model) {
        modelNames.add(entry.model);
      }
    }
  }
  for (const modelName of modelNames) {
    candidates.add(modelLogPath(meta.id, modelName));
  }
  let latest = 0;
  let sawStat = false;
  for (const candidate of candidates) {
    try {
      const stats = await fs4.stat(candidate);
      const mtimeMs = Number.isFinite(stats.mtimeMs) ? stats.mtimeMs : stats.mtime.getTime();
      if (Number.isFinite(mtimeMs)) {
        latest = Math.max(latest, mtimeMs);
        sawStat = true;
      }
    } catch {
    }
  }
  return sawStat ? latest : null;
}

// src/sessionStore.ts
var FileSessionStore = class {
  ensureStorage() {
    return ensureSessionStorage();
  }
  createSession(options, cwd, baseSlugOverride) {
    return initializeSession(options, cwd, baseSlugOverride);
  }
  readSession(sessionId) {
    return readSessionMetadata(sessionId);
  }
  updateSession(sessionId, updates) {
    return updateSessionMetadata(sessionId, updates);
  }
  createLogWriter(sessionId, model) {
    return createSessionLogWriter(sessionId, model);
  }
  updateModelRun(sessionId, model, updates) {
    return updateModelRunMetadata(sessionId, model, updates);
  }
  readLog(sessionId) {
    return readSessionLog(sessionId);
  }
  readModelLog(sessionId, model) {
    return readModelLog(sessionId, model);
  }
  readRequest(sessionId) {
    return readSessionRequest(sessionId);
  }
  listSessions() {
    return listSessionsMetadata();
  }
  filterSessions(metas, options) {
    return filterSessionsByRange(metas, options);
  }
  deleteOlderThan(options) {
    return deleteSessionsOlderThan(options);
  }
  getPaths(sessionId) {
    return getSessionPaths(sessionId);
  }
  sessionsDir() {
    return getSessionsDir();
  }
};
var sessionStore = new FileSessionStore();
async function pruneOldSessions(hours, log) {
  if (typeof hours !== "number" || Number.isNaN(hours) || hours <= 0) {
    return;
  }
  const result = await sessionStore.deleteOlderThan({ hours });
  if (result.deleted > 0) {
    log?.(`Pruned ${result.deleted} stored sessions older than ${hours}h.`);
  }
}

// src/cli/help.ts
import kleur2 from "kleur";
var createColorWrapper = (isTty4) => (styler) => (text) => isTty4 ? styler(text) : text;
function applyHelpStyling(program2, version, isTty4) {
  const wrap = createColorWrapper(isTty4);
  const colors = {
    banner: wrap((text) => kleur2.bold().blue(text)),
    subtitle: wrap((text) => kleur2.dim(text)),
    section: wrap((text) => kleur2.bold().white(text)),
    bullet: wrap((text) => kleur2.blue(text)),
    command: wrap((text) => kleur2.bold().blue(text)),
    option: wrap((text) => kleur2.cyan(text)),
    argument: wrap((text) => kleur2.magenta(text)),
    description: wrap((text) => kleur2.white(text)),
    muted: wrap((text) => kleur2.gray(text)),
    accent: wrap((text) => kleur2.cyan(text))
  };
  program2.configureHelp({
    styleTitle(title) {
      return colors.section(title);
    },
    styleDescriptionText(text) {
      return colors.description(text);
    },
    styleCommandText(text) {
      return colors.command(text);
    },
    styleSubcommandText(text) {
      return colors.command(text);
    },
    styleOptionText(text) {
      return colors.option(text);
    },
    styleArgumentText(text) {
      return colors.argument(text);
    }
  });
  program2.addHelpText("beforeAll", () => renderHelpBanner(version, colors));
  program2.addHelpText("after", () => renderHelpFooter(program2, colors));
}
function renderHelpBanner(version, colors) {
  const dash = "\u2014";
  const arrow = "\u2192";
  const subtitle = `Prompt + files ${arrow} multi-model LLM answers with full context.`;
  return `${colors.banner(`Oracle CLI v${version}`)} ${colors.subtitle(`${dash} ${subtitle}`)}
`;
}
function renderHelpFooter(program2, colors) {
  const bullet = "\u2022";
  const ellipsis = "\u2026";
  const dash = "\u2014";
  const arrow = "\u2192";
  const tips = [
    `${colors.bullet(bullet)} Required: always pass a prompt AND ${colors.accent("--file " + ellipsis)} (directories/globs are fine); Oracle cannot see your project otherwise.`,
    `${colors.bullet(bullet)} Attach lots of source (whole directories beat single files) and keep total input under ~196k tokens.`,
    `${colors.bullet(bullet)} Oracle is one-shot: start fresh each time with full context (project briefing + key files + question).`,
    `${colors.bullet(bullet)} Run ${colors.accent("--files-report")} to inspect token spend before hitting the API.`,
    `${colors.bullet(bullet)} If a session times out, do not re-run ${dash} reattach with ${colors.accent("oracle session <slug>")} to resume.`,
    `${colors.bullet(bullet)} Duplicate prompt guard: same prompt already running ${arrow} blocked unless you pass ${colors.accent("--force")}.`,
    `${colors.bullet(bullet)} Hidden flags: run ${colors.accent(`${program2.name()} --help --verbose`)} to list search/token overrides.`,
    `${colors.bullet(bullet)} Use ${colors.accent("-P/--prompt-file")} for complex prompts to avoid shell escaping.`,
    `${colors.bullet(bullet)} Native API keys (GEMINI_API_KEY, XAI_API_KEY) used when available; OPENROUTER_API_KEY as primary fallback.`
  ].join("\n");
  const formatExample = (command, description) => `${colors.command(`  ${command}`)}
${colors.muted(`    ${description}`)}`;
  const examples = [
    formatExample(
      `${program2.name()} -p "Summarize the risk register" --file docs/risk-register.md`,
      "Quick single-model run with the default model."
    ),
    formatExample(
      `${program2.name()} --models "google/gemini-3.1-pro-preview,x-ai/grok-4.1-fast" -p "Cross-check assumptions" --file "src/**/*.ts"`,
      `Multi-model run ${dash} query two models in parallel.`
    ),
    formatExample(
      `${program2.name()} --dry-run -p "Check release notes" --file docs/CHANGELOG.md`,
      "Preview token usage without calling the API."
    ),
    formatExample(`${program2.name()} session <id>`, "Reattach to a running or completed session.")
  ].join("\n\n");
  return `
${colors.section("Tips")}
${tips}

${colors.section("Examples")}
${examples}
`;
}

// src/cli/options.ts
import { InvalidArgumentError } from "commander";

// src/utils/duration.ts
function parseDuration(input, fallback) {
  if (!input) {
    return fallback;
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return fallback;
  }
  const lowercase = trimmed.toLowerCase();
  if (/^[0-9]+$/.test(lowercase)) {
    return Number(lowercase);
  }
  const normalized = lowercase.replace(/\s+/g, "");
  const singleMatch = /^([0-9]+)(ms|s|m|h)$/i.exec(normalized);
  if (singleMatch && singleMatch[0].length === normalized.length) {
    const value = Number(singleMatch[1]);
    return convertUnit(value, singleMatch[2]);
  }
  const multiDuration = /([0-9]+)(ms|h|m|s)/g;
  let total = 0;
  let lastIndex = 0;
  let match = multiDuration.exec(normalized);
  while (match !== null) {
    total += convertUnit(Number(match[1]), match[2]);
    lastIndex = multiDuration.lastIndex;
    match = multiDuration.exec(normalized);
  }
  if (total > 0 && lastIndex === normalized.length) {
    return total;
  }
  return fallback;
}
function convertUnit(value, unitRaw) {
  const unit = unitRaw?.toLowerCase();
  switch (unit) {
    case "ms":
      return value;
    case "s":
      return value * 1e3;
    case "m":
      return value * 6e4;
    case "h":
      return value * 36e5;
    default:
      return value;
  }
}

// src/cli/options.ts
import path8 from "node:path";
import fg2 from "fast-glob";
function collectPaths(value, previous = []) {
  if (!value) {
    return previous;
  }
  const nextValues = Array.isArray(value) ? value : [value];
  return previous.concat(
    nextValues.flatMap((entry) => entry.split(",")).map((entry) => entry.trim()).filter(Boolean)
  );
}
function mergePathLikeOptions(file, include, filesAlias, pathAlias, pathsAlias) {
  const withFile = collectPaths(file, []);
  const withInclude = collectPaths(include, withFile);
  const withFilesAlias = collectPaths(filesAlias, withInclude);
  const withPathAlias = collectPaths(pathAlias, withFilesAlias);
  return collectPaths(pathsAlias, withPathAlias);
}
function dedupePathInputs(inputs, { cwd = process.cwd() } = {}) {
  const deduped = [];
  const duplicates = [];
  const seen = /* @__PURE__ */ new Set();
  for (const entry of inputs ?? []) {
    const raw = entry?.trim();
    if (!raw) continue;
    let key = raw;
    if (!raw.startsWith("!") && !fg2.isDynamicPattern(raw)) {
      const absolute = path8.isAbsolute(raw) ? raw : path8.resolve(cwd, raw);
      key = `path:${path8.normalize(absolute)}`;
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
function collectModelList(value, previous = []) {
  if (!value) {
    return previous;
  }
  const entries = value.split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  return previous.concat(entries);
}
function parseFloatOption(value) {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    throw new InvalidArgumentError("Value must be a number.");
  }
  return parsed;
}
function parseIntOption(value) {
  if (value == null) {
    return void 0;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new InvalidArgumentError("Value must be an integer.");
  }
  return parsed;
}
function parseHeartbeatOption(value) {
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
function usesDefaultStatusFilters(cmd) {
  const hoursSource = cmd.getOptionValueSource?.("hours") ?? "default";
  const limitSource = cmd.getOptionValueSource?.("limit") ?? "default";
  const allSource = cmd.getOptionValueSource?.("all") ?? "default";
  return hoursSource === "default" && limitSource === "default" && allSource === "default";
}
function parseSearchOption(value) {
  const normalized = value.trim().toLowerCase();
  if (["on", "true", "1", "yes"].includes(normalized)) {
    return true;
  }
  if (["off", "false", "0", "no"].includes(normalized)) {
    return false;
  }
  throw new InvalidArgumentError('Search mode must be "on" or "off".');
}
function normalizeModelOption(value) {
  return (value ?? "").trim();
}
function normalizeBaseUrl(value) {
  const trimmed = value?.trim();
  return trimmed?.length ? trimmed : void 0;
}
function parseTimeoutOption(value) {
  if (value == null) return void 0;
  const normalized = value.trim().toLowerCase();
  if (normalized === "auto") return "auto";
  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new InvalidArgumentError('Timeout must be a positive number of seconds or "auto".');
  }
  return parsed;
}
function parseDurationOption(value, label) {
  if (value == null) return void 0;
  const trimmed = value.trim();
  if (!trimmed) {
    throw new InvalidArgumentError(`${label} must be a duration like 30m, 10s, 500ms, or 2h.`);
  }
  const parsed = parseDuration(trimmed, Number.NaN);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new InvalidArgumentError(
      `${label} must be a positive duration like 30m, 10s, 500ms, or 2h.`
    );
  }
  return parsed;
}
function resolveApiModel(modelValue) {
  const normalized = normalizeModelOption(modelValue).toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("/")) return normalized;
  if (normalized in MODEL_CONFIGS) return normalized;
  return normalized;
}

// src/cli/markdownBundle.ts
import fs5 from "node:fs/promises";

// src/oracle/promptAssembly.ts
function buildPromptMarkdown(systemPrompt, userPrompt, sections) {
  const lines = ["[SYSTEM]", systemPrompt, "", "[USER]", userPrompt, ""];
  sections.forEach((section) => {
    lines.push(formatFileSection(section.displayPath, section.content));
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

// src/cli/markdownBundle.ts
async function buildMarkdownBundle(options, deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  const fsModule = deps.fs ?? createFsAdapter(fs5);
  const files = await readFiles(options.file ?? [], { cwd, fsModule });
  const sections = createFileSections(files, cwd);
  const systemPrompt = options.system?.trim() || DEFAULT_SYSTEM_PROMPT;
  const userPrompt = (options.prompt ?? "").trim();
  const markdown = buildPromptMarkdown(systemPrompt, userPrompt, sections);
  const promptWithFiles = buildPrompt(userPrompt, files, cwd);
  return { markdown, promptWithFiles, systemPrompt, files };
}

// src/cli/detach.ts
function shouldDetachSession({
  engine,
  model,
  waitPreference: _waitPreference,
  disableDetachEnv
}) {
  if (disableDetachEnv) return false;
  if (isProModel(model) && engine === "api") return true;
  return false;
}

// src/cli/hiddenAliases.ts
function applyHiddenAliases(options, setOptionValue) {
  if (options.include && options.include.length > 0) {
    const mergedFiles = [...options.file ?? [], ...options.include];
    options.file = mergedFiles;
    setOptionValue?.("file", mergedFiles);
  }
  if (!options.prompt && options.message) {
    options.prompt = options.message;
    setOptionValue?.("prompt", options.message);
  }
  if (!options.engine && options.mode) {
    options.engine = options.mode;
    setOptionValue?.("engine", options.mode);
  }
}

// src/cli/sessionRunner.ts
import kleur5 from "kleur";
import fs7 from "node:fs/promises";
import path10 from "node:path";

// src/cli/sessionDisplay.ts
import chalk5 from "chalk";
import kleur4 from "kleur";

// src/cli/sessionTable.ts
import chalk4 from "chalk";
import kleur3 from "kleur";
import { estimateUsdCost as estimateUsdCost2 } from "tokentally";
var isRich = (rich) => rich ?? Boolean(process.stdout.isTTY && chalk4.level > 0);
var dim3 = (text, rich) => rich ? kleur3.dim(text) : text;
var STATUS_PAD = 9;
var MODEL_PAD = 13;
var MODE_PAD = 7;
var TIMESTAMP_PAD = 19;
var CHARS_PAD = 5;
var COST_PAD = 7;
function formatSessionTableHeader(rich) {
  const header = `${"Status".padEnd(STATUS_PAD)} ${"Model".padEnd(MODEL_PAD)} ${"Mode".padEnd(
    MODE_PAD
  )} ${"Timestamp".padEnd(TIMESTAMP_PAD)} ${"Chars".padStart(CHARS_PAD)} ${"Cost".padStart(COST_PAD)}  Slug`;
  return dim3(header, isRich(rich));
}
function formatSessionTableRow(meta, options) {
  const rich = isRich(options?.rich);
  const status = colorStatus(meta.status ?? "unknown", rich);
  const modelLabel = (meta.model ?? "n/a").padEnd(MODEL_PAD);
  const model = rich ? chalk4.white(modelLabel) : modelLabel;
  const modeLabel = (meta.mode ?? meta.options?.mode ?? "api").padEnd(MODE_PAD);
  const mode = rich ? chalk4.gray(modeLabel) : modeLabel;
  const timestampLabel = formatTimestampAligned(meta.createdAt).padEnd(TIMESTAMP_PAD);
  const timestamp = rich ? chalk4.gray(timestampLabel) : timestampLabel;
  const charsValue = meta.options?.prompt?.length ?? meta.promptPreview?.length ?? 0;
  const charsRaw = charsValue > 0 ? String(charsValue).padStart(CHARS_PAD) : `${"".padStart(CHARS_PAD - 1)}-`;
  const chars = rich ? chalk4.gray(charsRaw) : charsRaw;
  const costValue = resolveSessionCost(meta);
  const costRaw = costValue != null ? formatCostTable(costValue) : `${"".padStart(COST_PAD - 1)}-`;
  const cost = rich ? chalk4.gray(costRaw) : costRaw;
  const slug = rich ? chalk4.cyan(meta.id) : meta.id;
  return `${status} ${model} ${mode} ${timestamp} ${chars} ${cost}  ${slug}`;
}
function resolveSessionCost(meta) {
  if (meta.usage?.cost != null) {
    return meta.usage.cost;
  }
  if (!meta.model || !meta.usage) {
    return null;
  }
  const pricing = MODEL_CONFIGS[meta.model]?.pricing;
  if (!pricing) {
    return null;
  }
  const input = meta.usage.inputTokens ?? 0;
  const output = meta.usage.outputTokens ?? 0;
  const cost = estimateUsdCost2({
    usage: { inputTokens: input, outputTokens: output },
    pricing: { inputUsdPerToken: pricing.inputPerToken, outputUsdPerToken: pricing.outputPerToken }
  })?.totalUsd ?? 0;
  return cost > 0 ? cost : null;
}
function formatTimestampAligned(iso) {
  const date = new Date(iso);
  const locale = "en-US";
  const opts = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: void 0,
    hour12: true
  };
  let formatted = date.toLocaleString(locale, opts);
  formatted = formatted.replace(", ", "  ");
  return formatted.replace(/(\s)(\d:)/, "$1 $2");
}
function formatCostTable(cost) {
  return `$${cost.toFixed(3)}`.padStart(COST_PAD);
}
function colorStatus(status, rich) {
  const padded = status.padEnd(STATUS_PAD);
  if (!rich) {
    return padded;
  }
  switch (status) {
    case "completed":
      return chalk4.green(padded);
    case "error":
      return chalk4.red(padded);
    case "running":
      return chalk4.yellow(padded);
    default:
      return padded;
  }
}

// src/cli/sessionDisplay.ts
var isTty = () => Boolean(process.stdout.isTTY);
var dim4 = (text) => isTty() ? kleur4.dim(text) : text;
var MAX_RENDER_BYTES = 2e5;
var CLEANUP_TIP = 'Tip: Run "oracle session --clear --hours 24" to prune cached runs (add --all to wipe everything).';
async function showStatus({
  hours,
  includeAll,
  limit,
  showExamples = false,
  modelFilter
}) {
  const metas = await sessionStore.listSessions();
  const { entries, truncated, total } = sessionStore.filterSessions(metas, { hours, includeAll, limit });
  const filteredEntries = modelFilter ? entries.filter((entry) => matchesModel(entry, modelFilter)) : entries;
  const richTty = process.stdout.isTTY && chalk5.level > 0;
  if (!filteredEntries.length) {
    console.log(CLEANUP_TIP);
    if (showExamples) {
      printStatusExamples();
    }
    return;
  }
  console.log(chalk5.bold("Recent Sessions"));
  console.log(formatSessionTableHeader(richTty));
  for (const entry of filteredEntries) {
    console.log(formatSessionTableRow(entry, { rich: richTty }));
  }
  if (truncated) {
    const sessionsDir = sessionStore.sessionsDir();
    console.log(
      chalk5.yellow(
        `Showing ${entries.length} of ${total} sessions from the requested range. Run "oracle session --clear" or delete entries in ${sessionsDir} to free space, or rerun with --status-limit/--status-all.`
      )
    );
  }
  if (showExamples) {
    printStatusExamples();
  }
}
async function attachSession(sessionId, options) {
  let metadata = await sessionStore.readSession(sessionId);
  if (!metadata) {
    console.error(chalk5.red(`No session found with ID ${sessionId}`));
    process.exitCode = 1;
    return;
  }
  const normalizedModelFilter = options?.model?.trim().toLowerCase();
  if (normalizedModelFilter) {
    const availableModels = metadata.models?.map((model) => model.model.toLowerCase()) ?? (metadata.model ? [metadata.model.toLowerCase()] : []);
    if (!availableModels.includes(normalizedModelFilter)) {
      console.error(chalk5.red(`Model "${options?.model}" not found in session ${sessionId}.`));
      process.exitCode = 1;
      return;
    }
  }
  const initialStatus = metadata.status;
  const wantsRender = Boolean(options?.renderMarkdown);
  const isVerbose = Boolean(process.env.ORACLE_VERBOSE_RENDER);
  if (!options?.suppressMetadata) {
    const reattachLine = buildReattachLine(metadata);
    if (reattachLine) {
      console.log(chalk5.blue(reattachLine));
    }
    console.log(`Created: ${metadata.createdAt}`);
    console.log(`Status: ${metadata.status}`);
    if (metadata.models && metadata.models.length > 0) {
      console.log("Models:");
      for (const run of metadata.models) {
        const usage = run.usage ? ` tok=${formatTokenCount(run.usage.outputTokens ?? 0)}/${formatTokenCount(run.usage.totalTokens ?? 0)}` : "";
        console.log(`- ${chalk5.cyan(run.model)} \u2014 ${run.status}${usage}`);
      }
    } else if (metadata.model) {
      console.log(`Model: ${metadata.model}`);
    }
    const responseSummary = formatResponseMetadata(metadata.response);
    if (responseSummary) {
      console.log(dim4(`Response: ${responseSummary}`));
    }
    const transportSummary = formatTransportMetadata(metadata.transport);
    if (transportSummary) {
      console.log(dim4(`Transport: ${transportSummary}`));
    }
    const userErrorSummary = formatUserErrorMetadata(metadata.error);
    if (userErrorSummary) {
      console.log(dim4(`User error: ${userErrorSummary}`));
    }
  }
  const shouldTrimIntro = initialStatus === "completed" || initialStatus === "error";
  if (options?.renderPrompt !== false) {
    const prompt = await readStoredPrompt(sessionId);
    if (prompt) {
      console.log(chalk5.bold("Prompt:"));
      console.log(renderMarkdownAnsi(prompt));
      console.log(dim4("---"));
    }
  }
  if (shouldTrimIntro) {
    const fullLog = await buildSessionLogForDisplay(sessionId, metadata, normalizedModelFilter);
    const trimmed = trimBeforeFirstAnswer(fullLog);
    const size = Buffer.byteLength(trimmed, "utf8");
    const canRender = wantsRender && isTty() && size <= MAX_RENDER_BYTES;
    if (wantsRender && size > MAX_RENDER_BYTES) {
      const msg = `Render skipped (log too large: ${size} bytes > ${MAX_RENDER_BYTES}). Showing raw text.`;
      console.log(dim4(msg));
      if (isVerbose) {
        console.log(dim4(`Verbose: renderMarkdown=true tty=${isTty()} size=${size}`));
      }
    } else if (wantsRender && !isTty()) {
      const msg = "Render requested but stdout is not a TTY; showing raw text.";
      console.log(dim4(msg));
      if (isVerbose) {
        console.log(dim4(`Verbose: renderMarkdown=true tty=${isTty()} size=${size}`));
      }
    }
    if (canRender) {
      if (isVerbose) {
        console.log(dim4(`Verbose: rendering markdown (size=${size}, tty=${isTty()})`));
      }
      process.stdout.write(renderMarkdownAnsi(trimmed));
    } else {
      process.stdout.write(trimmed);
    }
    const summary = formatCompletionSummary(metadata, { includeSlug: true });
    if (summary) {
      console.log(`
${chalk5.green.bold(summary)}`);
    }
    return;
  }
  if (wantsRender) {
    console.log(dim4("Render will apply after completion; streaming raw text meanwhile..."));
    if (isVerbose) {
      console.log(dim4(`Verbose: streaming phase renderMarkdown=true tty=${isTty()}`));
    }
  }
  const liveRenderState = wantsRender && isTty() ? { pending: "", inFence: false, inTable: false, renderedBytes: 0, fallback: false, noticedFallback: false } : null;
  let lastLength = 0;
  const renderLiveChunk = (chunk) => {
    if (!liveRenderState || chunk.length === 0) {
      process.stdout.write(chunk);
      return;
    }
    if (liveRenderState.fallback) {
      process.stdout.write(chunk);
      return;
    }
    liveRenderState.pending += chunk;
    const { chunks, remainder } = extractRenderableChunks(liveRenderState.pending, liveRenderState);
    liveRenderState.pending = remainder;
    for (const candidate of chunks) {
      const projected = liveRenderState.renderedBytes + Buffer.byteLength(candidate, "utf8");
      if (projected > MAX_RENDER_BYTES) {
        if (!liveRenderState.noticedFallback) {
          console.log(dim4(`Render skipped (log too large: > ${MAX_RENDER_BYTES} bytes). Showing raw text.`));
          liveRenderState.noticedFallback = true;
        }
        liveRenderState.fallback = true;
        process.stdout.write(candidate + liveRenderState.pending);
        liveRenderState.pending = "";
        return;
      }
      process.stdout.write(renderMarkdownAnsi(candidate));
      liveRenderState.renderedBytes += Buffer.byteLength(candidate, "utf8");
    }
  };
  const flushRemainder = () => {
    if (!liveRenderState || liveRenderState.fallback) {
      return;
    }
    if (liveRenderState.pending.length === 0) {
      return;
    }
    const text = liveRenderState.pending;
    liveRenderState.pending = "";
    const projected = liveRenderState.renderedBytes + Buffer.byteLength(text, "utf8");
    if (projected > MAX_RENDER_BYTES) {
      if (!liveRenderState.noticedFallback) {
        console.log(dim4(`Render skipped (log too large: > ${MAX_RENDER_BYTES} bytes). Showing raw text.`));
      }
      process.stdout.write(text);
      liveRenderState.fallback = true;
      return;
    }
    process.stdout.write(renderMarkdownAnsi(text));
  };
  const printNew = async () => {
    const text = await buildSessionLogForDisplay(sessionId, metadata, normalizedModelFilter);
    const nextChunk = text.slice(lastLength);
    if (nextChunk.length > 0) {
      renderLiveChunk(nextChunk);
      lastLength = text.length;
    }
  };
  await printNew();
  while (true) {
    const latest = await sessionStore.readSession(sessionId);
    if (!latest) {
      break;
    }
    if (latest.status === "completed" || latest.status === "error") {
      await printNew();
      flushRemainder();
      if (!options?.suppressMetadata) {
        if (latest.status === "error" && latest.errorMessage) {
          console.log("\nResult:");
          console.log(`Session failed: ${latest.errorMessage}`);
        }
        if (latest.status === "completed" && latest.usage) {
          const summary = formatCompletionSummary(latest, { includeSlug: true });
          if (summary) {
            console.log(`
${chalk5.green.bold(summary)}`);
          } else {
            const usage = latest.usage;
            console.log(
              `
Finished (tok i/o/r/t: ${usage.inputTokens}/${usage.outputTokens}/${usage.reasoningTokens}/${usage.totalTokens})`
            );
          }
        }
      }
      break;
    }
    await wait(1e3);
    await printNew();
  }
}
function formatResponseMetadata(metadata) {
  if (!metadata) {
    return null;
  }
  const parts = [];
  if (metadata.responseId) {
    parts.push(`response=${metadata.responseId}`);
  }
  if (metadata.requestId) {
    parts.push(`request=${metadata.requestId}`);
  }
  if (metadata.status) {
    parts.push(`status=${metadata.status}`);
  }
  if (metadata.incompleteReason) {
    parts.push(`incomplete=${metadata.incompleteReason}`);
  }
  return parts.length > 0 ? parts.join(" | ") : null;
}
function formatTransportMetadata(metadata) {
  if (!metadata?.reason) {
    return null;
  }
  const reasonLabels = {
    "client-timeout": "client timeout (deadline exceeded)",
    "connection-lost": "connection lost before completion",
    "client-abort": "request aborted locally",
    unknown: "unknown transport failure"
  };
  const label = reasonLabels[metadata.reason] ?? "transport error";
  return `${metadata.reason} \u2014 ${label}`;
}
function formatUserErrorMetadata(metadata) {
  if (!metadata) {
    return null;
  }
  const parts = [];
  if (metadata.category) {
    parts.push(metadata.category);
  }
  if (metadata.message) {
    parts.push(`message=${metadata.message}`);
  }
  if (metadata.details && Object.keys(metadata.details).length > 0) {
    parts.push(`details=${JSON.stringify(metadata.details)}`);
  }
  return parts.length > 0 ? parts.join(" | ") : null;
}
function buildReattachLine(metadata) {
  if (!metadata.id) {
    return null;
  }
  const referenceTime = metadata.startedAt ?? metadata.createdAt;
  if (!referenceTime) {
    return null;
  }
  const elapsedLabel = formatRelativeDuration(referenceTime);
  if (!elapsedLabel) {
    return null;
  }
  if (metadata.status === "running") {
    return `Session ${metadata.id} reattached, request started ${elapsedLabel} ago.`;
  }
  return null;
}
function trimBeforeFirstAnswer(logText) {
  const marker = "Answer:";
  const index = logText.indexOf(marker);
  if (index === -1) {
    return logText;
  }
  return logText.slice(index);
}
function formatRelativeDuration(referenceIso) {
  const timestamp = Date.parse(referenceIso);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) {
    return null;
  }
  const seconds = Math.max(1, Math.round(diffMs / 1e3));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    const parts2 = [`${hours}h`];
    if (remainingMinutes > 0) {
      parts2.push(`${remainingMinutes}m`);
    }
    return parts2.join(" ");
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  const parts = [`${days}d`];
  if (remainingHours > 0) {
    parts.push(`${remainingHours}h`);
  }
  if (remainingMinutes > 0 && days === 0) {
    parts.push(`${remainingMinutes}m`);
  }
  return parts.join(" ");
}
function printStatusExamples() {
  console.log("");
  console.log(chalk5.bold("Usage Examples"));
  console.log(`${chalk5.bold("  oracle status --hours 72 --limit 50")}`);
  console.log(dim4("    Show 72h of history capped at 50 entries."));
  console.log(`${chalk5.bold("  oracle status --clear --hours 168")}`);
  console.log(dim4("    Delete sessions older than 7 days (use --all to wipe everything)."));
  console.log(`${chalk5.bold("  oracle session <session-id>")}`);
  console.log(dim4("    Attach to a specific running/completed session to stream its output."));
  console.log(dim4(CLEANUP_TIP));
}
function matchesModel(entry, filter) {
  const normalized = filter.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  const models = entry.models?.map((model) => model.model.toLowerCase()) ?? (entry.model ? [entry.model.toLowerCase()] : []);
  return models.includes(normalized);
}
async function buildSessionLogForDisplay(sessionId, fallbackMeta, modelFilter) {
  const normalizedFilter = modelFilter?.trim().toLowerCase();
  const freshMetadata = await sessionStore.readSession(sessionId) ?? fallbackMeta;
  const models = freshMetadata.models ?? fallbackMeta.models ?? [];
  if (models.length === 0) {
    if (normalizedFilter) {
      return await sessionStore.readModelLog(sessionId, modelFilter);
    }
    return await sessionStore.readLog(sessionId);
  }
  const candidates = normalizedFilter ? models.filter((model) => model.model.toLowerCase() === normalizedFilter) : models;
  if (candidates.length === 0) {
    return "";
  }
  const sections = [];
  let hasContent = false;
  for (const model of candidates) {
    const body = await sessionStore.readModelLog(sessionId, model.model) ?? "";
    if (body.trim().length > 0) {
      hasContent = true;
    }
    sections.push(`=== ${model.model} ===
${body}`.trimEnd());
  }
  if (!hasContent) {
    return await sessionStore.readLog(sessionId);
  }
  return sections.join("\n\n");
}
function extractRenderableChunks(text, state) {
  const chunks = [];
  let buffer = "";
  const lines = text.split(/(\n)/);
  for (let i = 0; i < lines.length; i += 1) {
    const segment = lines[i];
    if (segment === "\n") {
      buffer += segment;
      const prev = lines[i - 1] ?? "";
      const fenceMatch = prev.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
      if (!state.inFence && fenceMatch) {
        state.inFence = true;
        state.fenceDelimiter = fenceMatch[2];
      } else if (state.inFence && state.fenceDelimiter && prev.startsWith(state.fenceDelimiter)) {
        state.inFence = false;
        state.fenceDelimiter = void 0;
      }
      const trimmed = prev.trim();
      if (!state.inFence) {
        if (!state.inTable && trimmed.startsWith("|") && trimmed.includes("|")) {
          state.inTable = true;
        }
        if (state.inTable && trimmed === "") {
          state.inTable = false;
        }
      }
      const safeBreak = !state.inFence && !state.inTable && trimmed === "";
      if (safeBreak) {
        chunks.push(buffer);
        buffer = "";
      }
      continue;
    }
    buffer += segment;
  }
  return { chunks, remainder: buffer };
}
function formatCompletionSummary(metadata, options = {}) {
  if (!metadata.usage || metadata.elapsedMs == null) {
    return null;
  }
  const modeLabel = metadata.model ?? "n/a";
  const usage = metadata.usage;
  const cost = resolveSessionCost(metadata);
  const tokensDisplay = [
    usage.inputTokens ?? 0,
    usage.outputTokens ?? 0,
    usage.reasoningTokens ?? 0,
    usage.totalTokens ?? 0
  ].map(
    (value, index) => formatTokenValue(value, {
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      reasoning_tokens: usage.reasoningTokens,
      total_tokens: usage.totalTokens
    }, index)
  ).join("/");
  const tokensPart = (() => {
    const parts = tokensDisplay.split("/");
    if (parts.length !== 4) return tokensDisplay;
    return `\u2191${parts[0]} \u2193${parts[1]} \u21BB${parts[2]} \u0394${parts[3]}`;
  })();
  const filesCount = metadata.options?.file?.length ?? 0;
  const filesPart = filesCount > 0 ? `files=${filesCount}` : null;
  const slugPart = options.includeSlug ? `slug=${metadata.id}` : null;
  const { line1, line2 } = formatFinishLine({
    elapsedMs: metadata.elapsedMs,
    model: modeLabel,
    costUsd: cost ?? null,
    tokensPart,
    detailParts: [filesPart, slugPart]
  });
  return line2 ? `${line1} | ${line2}` : line1;
}
async function readStoredPrompt(sessionId) {
  const request = await sessionStore.readRequest(sessionId);
  if (request?.prompt && request.prompt.trim().length > 0) {
    return request.prompt;
  }
  const meta = await sessionStore.readSession(sessionId);
  if (meta?.options?.prompt && meta.options.prompt.trim().length > 0) {
    return meta.options.prompt;
  }
  return null;
}

// src/cli/errorUtils.ts
var LOGGED_SYMBOL = /* @__PURE__ */ Symbol("oracle.alreadyLogged");
function markErrorLogged(error) {
  if (error instanceof Error) {
    error[LOGGED_SYMBOL] = true;
  }
}
function isErrorLogged(error) {
  return Boolean(error instanceof Error && error[LOGGED_SYMBOL]);
}

// src/oracle/multiModelRunner.ts
import fs6 from "node:fs/promises";
import path9 from "node:path";
import { findOscProgressSequences, OSC_PROGRESS_PREFIX } from "osc-progress";
function forwardOscProgress(chunk, shouldForward) {
  if (!shouldForward || !chunk.includes(OSC_PROGRESS_PREFIX)) {
    return;
  }
  for (const seq of findOscProgressSequences(chunk)) {
    process.stdout.write(seq.raw);
  }
}
var defaultDeps = {
  store: sessionStore,
  runOracleImpl: runOracle,
  now: () => Date.now()
};
async function runMultiModelApiSession(params, deps = defaultDeps) {
  const { sessionMeta, runOptions, models, cwd } = params;
  const { onModelDone } = params;
  const store = deps.store ?? sessionStore;
  const runOracleImpl = deps.runOracleImpl ?? runOracle;
  const now = deps.now ?? (() => Date.now());
  const startMark = now();
  const executions = models.map(
    (model) => startModelExecution({
      sessionMeta,
      runOptions,
      model,
      cwd,
      store,
      runOracleImpl
    })
  );
  const settled = await Promise.allSettled(
    executions.map(
      (exec) => exec.promise.then(
        async (value) => {
          if (onModelDone) {
            await onModelDone(value);
          }
          return value;
        },
        (error) => {
          throw error;
        }
      )
    )
  );
  const fulfilled = [];
  const rejected = [];
  settled.forEach((result, index) => {
    const exec = executions[index];
    if (result.status === "fulfilled") {
      fulfilled.push(result.value);
    } else {
      rejected.push({ model: exec.model, reason: result.reason });
    }
  });
  return {
    fulfilled,
    rejected,
    elapsedMs: now() - startMark
  };
}
function startModelExecution({
  sessionMeta,
  runOptions,
  model,
  cwd,
  store,
  runOracleImpl
}) {
  const logWriter = store.createLogWriter(sessionMeta.id, model);
  const perModelOptions = {
    ...runOptions,
    model,
    models: void 0,
    sessionId: `${sessionMeta.id}:${model}`
  };
  const perModelLog = (message) => {
    logWriter.logLine(message ?? "");
  };
  const mirrorOscProgress = process.stdout.isTTY === true;
  const perModelWrite = (chunk) => {
    logWriter.writeChunk(chunk);
    forwardOscProgress(chunk, mirrorOscProgress);
    return true;
  };
  const promise = (async () => {
    await store.updateModelRun(sessionMeta.id, model, {
      status: "running",
      queuedAt: (/* @__PURE__ */ new Date()).toISOString(),
      startedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    const result = await runOracleImpl(
      {
        ...perModelOptions,
        effectiveModelId: model,
        // Drop per-model preamble; the aggregate runner prints the shared header and tips once.
        suppressHeader: true,
        suppressAnswerHeader: true,
        suppressTips: true
      },
      {
        cwd,
        log: perModelLog,
        write: perModelWrite
      }
    );
    if (result.mode !== "live") {
      throw new Error("Unexpected preview result while running a session.");
    }
    const answerText = extractTextOutput(result.response);
    await store.updateModelRun(sessionMeta.id, model, {
      status: "completed",
      completedAt: (/* @__PURE__ */ new Date()).toISOString(),
      usage: result.usage,
      response: extractResponseMetadata(result.response),
      transport: void 0,
      error: void 0,
      log: await describeLog(sessionMeta.id, logWriter.logPath, store)
    });
    return {
      model,
      usage: result.usage,
      answerText,
      logPath: logWriter.logPath
    };
  })().catch(async (error) => {
    const userError = asOracleUserError(error);
    const responseMetadata = error instanceof OracleResponseError ? error.metadata : void 0;
    const transportMetadata = error instanceof OracleTransportError ? { reason: error.reason } : void 0;
    await store.updateModelRun(sessionMeta.id, model, {
      status: "error",
      completedAt: (/* @__PURE__ */ new Date()).toISOString(),
      response: responseMetadata,
      transport: transportMetadata,
      error: userError ? {
        category: userError.category,
        message: userError.message,
        details: userError.details
      } : void 0,
      log: await describeLog(sessionMeta.id, logWriter.logPath, store)
    });
    throw error;
  }).finally(() => {
    logWriter.stream.end();
  });
  return { model, promise };
}
async function describeLog(sessionId, logFilePath, store) {
  const { dir } = await store.getPaths(sessionId);
  const relative = path9.relative(dir, logFilePath);
  try {
    const stats = await fsStat(logFilePath);
    return { path: relative, bytes: stats.size };
  } catch {
    return { path: relative };
  }
}
async function fsStat(target) {
  const stats = await fs6.stat(target);
  return { size: stats.size };
}

// src/cli/oscUtils.ts
import { sanitizeOscProgress } from "osc-progress";

// src/cli/sessionRunner.ts
import { cwd as getCwd } from "node:process";
function buildMultiModelJson(prompt, results) {
  return {
    prompt,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    models: results.map((r) => ({
      model: r.model,
      response: r.text,
      tokens: { in: r.inputTokens, out: r.outputTokens },
      duration_ms: r.durationMs
    }))
  };
}
var isTty2 = process.stdout.isTTY;
var dim5 = (text) => isTty2 ? kleur5.dim(text) : text;
async function performSessionRun({
  sessionMeta,
  runOptions,
  cwd,
  log,
  write,
  version,
  muteStdout = false
}) {
  const writeInline = (chunk) => {
    write(chunk);
    return muteStdout ? true : process.stdout.write(chunk);
  };
  const mode = "api";
  await sessionStore.updateSession(sessionMeta.id, {
    status: "running",
    startedAt: (/* @__PURE__ */ new Date()).toISOString(),
    mode
  });
  const modelForStatus = runOptions.model ?? sessionMeta.model;
  try {
    const multiModels = Array.isArray(runOptions.models) ? runOptions.models.filter(Boolean) : [];
    if (multiModels.length > 1) {
      const [primaryModel] = multiModels;
      if (!primaryModel) {
        throw new Error("Missing model name for multi-model run.");
      }
      const modelConfig = await resolveModelConfig(primaryModel, {
        baseUrl: runOptions.baseUrl,
        openRouterApiKey: process.env.OPENROUTER_API_KEY
      });
      const files = await readFiles(runOptions.file ?? [], { cwd });
      const promptWithFiles = buildPrompt(runOptions.prompt, files, cwd);
      const requestBody = buildRequestBody({
        modelConfig,
        systemPrompt: runOptions.system ?? DEFAULT_SYSTEM_PROMPT,
        userPrompt: promptWithFiles,
        searchEnabled: runOptions.search !== false,
        maxOutputTokens: runOptions.maxOutput,
        background: runOptions.background,
        storeResponse: runOptions.background
      });
      const estimatedTokens = estimateRequestTokens(requestBody, modelConfig);
      const tokenLabel = formatTokenEstimate(
        estimatedTokens,
        (text) => isTty2 ? kleur5.green(text) : text
      );
      const filesPhrase = files.length === 0 ? "no files" : `${files.length} files`;
      const modelsLabel = multiModels.join(", ");
      log(
        `Calling ${isTty2 ? kleur5.cyan(modelsLabel) : modelsLabel} \u2014 ${tokenLabel} tokens, ${filesPhrase}.`
      );
      const multiRunTips = [];
      if (files.length === 0) {
        multiRunTips.push(
          "Tip: no files attached \u2014 Oracle works best with project context. Add files via --file path/to/code or docs."
        );
      }
      const shortPrompt = (runOptions.prompt?.trim().length ?? 0) < 80;
      if (shortPrompt) {
        multiRunTips.push(
          "Tip: brief prompts often yield generic answers \u2014 aim for 6\u201330 sentences and attach key files."
        );
      }
      for (const tip of multiRunTips) {
        log(dim5(tip));
      }
      const longRunningModels = multiModels.filter(
        (model) => isKnownModel(model) && MODEL_CONFIGS[model]?.reasoning?.effort === "high"
      );
      if (longRunningModels.length > 0) {
        for (const model of longRunningModels) {
          log("");
          const headingLabel = `[${model}]`;
          log(isTty2 ? kleur5.bold(headingLabel) : headingLabel);
          log(dim5("This model can take up to 60 minutes (usually replies much faster)."));
          log(dim5("Press Ctrl+C to cancel."));
        }
      }
      const shouldStreamInline = !muteStdout && process.stdout.isTTY;
      const shouldRenderMarkdown = shouldStreamInline && runOptions.renderPlain !== true;
      const printedModels = /* @__PURE__ */ new Set();
      const answerFallbacks = /* @__PURE__ */ new Map();
      const stripOscProgress = (text) => sanitizeOscProgress(text, shouldStreamInline);
      const printModelLog = async (model) => {
        if (printedModels.has(model)) return;
        printedModels.add(model);
        const body = stripOscProgress(await sessionStore.readModelLog(sessionMeta.id, model));
        log("");
        const fallback = answerFallbacks.get(model);
        const hasBody = body.length > 0;
        if (!hasBody && !fallback) {
          log(dim5(`${model}: (no output recorded)`));
          return;
        }
        const headingLabel = `[${model}]`;
        const heading = shouldStreamInline ? kleur5.bold(headingLabel) : headingLabel;
        log(heading);
        const content = hasBody ? body : fallback ?? "";
        const printable = shouldRenderMarkdown ? renderMarkdownAnsi(content) : content;
        writeInline(printable);
        if (!printable.endsWith("\n")) {
          log("");
        }
      };
      const summary = await runMultiModelApiSession(
        {
          sessionMeta,
          runOptions,
          models: multiModels,
          cwd,
          version,
          onModelDone: shouldStreamInline ? async (result2) => {
            if (result2.answerText) {
              answerFallbacks.set(result2.model, result2.answerText);
            }
            await printModelLog(result2.model);
          } : void 0
        },
        {
          runOracleImpl: muteStdout ? (opts, deps) => runOracle(opts, { ...deps, allowStdout: false }) : void 0
        }
      );
      if (!shouldStreamInline) {
        for (const [index, result2] of summary.fulfilled.entries()) {
          if (index > 0) {
            log("");
          }
          await printModelLog(result2.model);
        }
      }
      const aggregateUsage = summary.fulfilled.reduce(
        (acc, entry) => ({
          inputTokens: acc.inputTokens + entry.usage.inputTokens,
          outputTokens: acc.outputTokens + entry.usage.outputTokens,
          reasoningTokens: acc.reasoningTokens + entry.usage.reasoningTokens,
          totalTokens: acc.totalTokens + entry.usage.totalTokens,
          cost: (acc.cost ?? 0) + (entry.usage.cost ?? 0)
        }),
        { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0, cost: 0 }
      );
      const tokensDisplay = [
        aggregateUsage.inputTokens,
        aggregateUsage.outputTokens,
        aggregateUsage.reasoningTokens,
        aggregateUsage.totalTokens
      ].map(
        (v, idx) => formatTokenValue(
          v,
          {
            input_tokens: aggregateUsage.inputTokens,
            output_tokens: aggregateUsage.outputTokens,
            reasoning_tokens: aggregateUsage.reasoningTokens,
            total_tokens: aggregateUsage.totalTokens
          },
          idx
        )
      ).join("/");
      const tokensPart = (() => {
        const parts = tokensDisplay.split("/");
        if (parts.length !== 4) return tokensDisplay;
        return `\u2191${parts[0]} \u2193${parts[1]} \u21BB${parts[2]} \u0394${parts[3]}`;
      })();
      const statusColor = summary.rejected.length === 0 ? kleur5.green : summary.fulfilled.length > 0 ? kleur5.yellow : kleur5.red;
      const overallText = `${summary.fulfilled.length}/${multiModels.length} models`;
      const { line1 } = formatFinishLine({
        elapsedMs: summary.elapsedMs,
        model: overallText,
        costUsd: aggregateUsage.cost ?? null,
        tokensPart
      });
      log(statusColor(line1));
      const hasFailure = summary.rejected.length > 0;
      await sessionStore.updateSession(sessionMeta.id, {
        status: hasFailure ? "error" : "completed",
        completedAt: (/* @__PURE__ */ new Date()).toISOString(),
        usage: aggregateUsage,
        elapsedMs: summary.elapsedMs,
        response: void 0,
        transport: void 0,
        error: void 0
      });
      const totalCharacters = summary.fulfilled.reduce(
        (sum, entry) => sum + entry.answerText.length,
        0
      );
      if (runOptions.writeOutputPath) {
        const jsonOutput = buildMultiModelJson(
          runOptions.prompt ?? "",
          summary.fulfilled.map((entry) => ({
            model: entry.model,
            text: entry.answerText,
            inputTokens: entry.usage.inputTokens,
            outputTokens: entry.usage.outputTokens,
            durationMs: 0
          }))
        );
        const jsonPath = runOptions.writeOutputPath.replace(/\.[^.]+$/, "") + ".json";
        const savedPath = await writeAssistantOutput(
          jsonPath,
          JSON.stringify(jsonOutput, null, 2),
          log
        );
        if (savedPath) {
          log(dim5(`Saved multi-model JSON output to ${savedPath}`));
        }
      }
      if (hasFailure) {
        throw summary.rejected[0].reason;
      }
      return {
        answers: summary.fulfilled.map((entry) => ({
          model: entry.model,
          text: entry.answerText,
          usage: entry.usage
        }))
      };
    }
    const singleModelOverride = multiModels.length === 1 ? multiModels[0] : void 0;
    const apiRunOptions = singleModelOverride ? { ...runOptions, model: singleModelOverride, models: void 0 } : runOptions;
    if (modelForStatus && singleModelOverride == null) {
      await sessionStore.updateModelRun(sessionMeta.id, modelForStatus, {
        status: "running",
        startedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    const result = await runOracle(apiRunOptions, {
      cwd,
      log,
      write,
      allowStdout: !muteStdout
    });
    if (result.mode !== "live") {
      throw new Error("Unexpected preview result while running a session.");
    }
    await sessionStore.updateSession(sessionMeta.id, {
      status: "completed",
      completedAt: (/* @__PURE__ */ new Date()).toISOString(),
      usage: result.usage,
      elapsedMs: result.elapsedMs,
      response: extractResponseMetadata(result.response),
      transport: void 0,
      error: void 0
    });
    if (modelForStatus && singleModelOverride == null) {
      await sessionStore.updateModelRun(sessionMeta.id, modelForStatus, {
        status: "completed",
        completedAt: (/* @__PURE__ */ new Date()).toISOString(),
        usage: result.usage
      });
    }
    const answerText = extractTextOutput(result.response);
    await writeAssistantOutput(runOptions.writeOutputPath, answerText, log);
    return {
      answers: [
        {
          model: apiRunOptions.model,
          text: answerText,
          usage: result.usage
        }
      ]
    };
  } catch (error) {
    const message = formatError(error);
    log(`ERROR: ${message}`);
    markErrorLogged(error);
    const userError = asOracleUserError(error);
    if (userError) {
      log(dim5(`User error (${userError.category}): ${userError.message}`));
    }
    const responseMetadata = error instanceof OracleResponseError ? error.metadata : void 0;
    const metadataLine = formatResponseMetadata(responseMetadata);
    if (metadataLine) {
      log(dim5(`Response metadata: ${metadataLine}`));
    }
    const transportMetadata = error instanceof OracleTransportError ? { reason: error.reason } : void 0;
    const transportLine = formatTransportMetadata(transportMetadata);
    if (transportLine) {
      log(dim5(`Transport: ${transportLine}`));
    }
    await sessionStore.updateSession(sessionMeta.id, {
      status: "error",
      completedAt: (/* @__PURE__ */ new Date()).toISOString(),
      errorMessage: message,
      mode,
      response: responseMetadata,
      transport: transportMetadata,
      error: userError ? {
        category: userError.category,
        message: userError.message,
        details: userError.details
      } : void 0
    });
    if (modelForStatus) {
      await sessionStore.updateModelRun(sessionMeta.id, modelForStatus, {
        status: "error",
        completedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    throw error;
  }
}
function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
async function writeAssistantOutput(targetPath, content, log) {
  if (!targetPath) return;
  if (!content || content.trim().length === 0) {
    log(dim5("write-output skipped: no assistant content to save."));
    return;
  }
  const normalizedTarget = path10.resolve(targetPath);
  const normalizedSessionsDir = path10.resolve(sessionStore.sessionsDir());
  if (normalizedTarget === normalizedSessionsDir || normalizedTarget.startsWith(`${normalizedSessionsDir}${path10.sep}`)) {
    log(
      dim5(
        `write-output skipped: refusing to write inside session storage (${normalizedSessionsDir}).`
      )
    );
    return;
  }
  try {
    await fs7.mkdir(path10.dirname(normalizedTarget), { recursive: true });
    const payload = content.endsWith("\n") ? content : `${content}
`;
    await fs7.writeFile(normalizedTarget, payload, "utf8");
    log(dim5(`Saved assistant output to ${normalizedTarget}`));
    return normalizedTarget;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (isPermissionError(error)) {
      const fallbackPath = buildFallbackPath(normalizedTarget);
      if (fallbackPath) {
        try {
          await fs7.mkdir(path10.dirname(fallbackPath), { recursive: true });
          const payload = content.endsWith("\n") ? content : `${content}
`;
          await fs7.writeFile(fallbackPath, payload, "utf8");
          log(dim5(`write-output fallback to ${fallbackPath} (original failed: ${reason})`));
          return fallbackPath;
        } catch (innerError) {
          const innerReason = innerError instanceof Error ? innerError.message : String(innerError);
          log(
            dim5(
              `write-output failed (${reason}); fallback failed (${innerReason}); session completed anyway.`
            )
          );
          return;
        }
      }
    }
    log(dim5(`write-output failed (${reason}); session completed anyway.`));
  }
}
function isPermissionError(error) {
  if (!(error instanceof Error)) return false;
  const code = error.code;
  return code === "EACCES" || code === "EPERM";
}
function buildFallbackPath(original) {
  const ext = path10.extname(original);
  const stem = path10.basename(original, ext);
  const dir = getCwd();
  const candidate = ext ? `${stem}.fallback${ext}` : `${stem}.fallback`;
  const fallback = path10.join(dir, candidate);
  const normalizedSessionsDir = path10.resolve(sessionStore.sessionsDir());
  const normalizedFallback = path10.resolve(fallback);
  if (normalizedFallback === normalizedSessionsDir || normalizedFallback.startsWith(`${normalizedSessionsDir}${path10.sep}`)) {
    return null;
  }
  return fallback;
}

// src/cli/tagline.ts
import chalk6 from "chalk";
var TAGLINES = [
  "Whispering your tokens to the silicon sage.",
  "Turning scattered files into one sharp question.",
  "One slug to gather them all.",
  "Token thrift, oracle lift.",
  "Globs to gospel, minus the incense.",
  "Your repo, neatly bottled, gently shaken.",
  "Clarity, with a hint of smoke.",
  "Questions in, clarity out.",
  "Globs become guidance.",
  "Token-aware, omen-ready.",
  "Globs go in; citations and costs come out.",
  "Keeps 196k tokens feeling roomy, not risky.",
  "Remembers your paths, forgets your past runs.",
  "A TUI when you want it, a one-liner when you do not.",
  "Less ceremony, more certainty.",
  "Guidance without the guesswork.",
  "One prompt fanned out, no echoes wasted.",
  "Detached runs, tethered results.",
  "Calm CLI, loud answers.",
  "Single scroll, many seers.",
  "Background magic with foreground receipts.",
  "Paths aligned, models attuned.",
  "Light spell, heavy insight.",
  "Signal first, sorcery second.",
  "One command, several seers; results stay grounded.",
  "Context braided, answers sharpened.",
  "Short incantation, long provenance.",
  "Attach, cast, reattach later.",
  "Spell once, cite always.",
  "Edge cases foretold, receipts attached.",
  "Silent run, loud receipts.",
  "Detours gone; clarity walks in.",
  "Tokens tallied, omens tallied.",
  "Calm prompt, converged truths.",
  "Single spell, multiple verdicts.",
  "Prompt once, harvest many omens.",
  "Light on ceremony, heavy on receipts.",
  "From globs to guidance in one breath.",
  "Quiet prompt, thunderous answers.",
  "Balanced mystique, measurable results.",
  "Debugger by day, oracle by night.",
  "Your code's confessional booth.",
  "Edge cases fear this inbox.",
  "Slop in, sharp answers out.",
  "Your AI coworker's quality control.",
  "Because vibes aren't a deliverable.",
  "When the other agents shrug, the oracle ships.",
  "Hallucinations checked at the door.",
  "Context police for overeager LLMs.",
  "Turns prompt spaghetti into ship-ready sauce.",
  "Lint for large language models.",
  "Slaps wrists before they hit 'ship'.",
  "Because 'let the model figure it out' is not QA.",
  "Fine, I'll write the test for the AI too.",
  "We bring receipts; they bring excuses.",
  "Less swagger, more citations.",
  "LLM babysitter with a shipping agenda.",
  "Ships facts, not vibes.",
  "Context sanitizer for reckless prompts.",
  "AI babysitter with merge rights.",
  "Stops the hallucination before it hits prod.",
  "Slop filter set to aggressive.",
  "We debug the debugger.",
  "Model said maybe; oracle says ship/no.",
  "Less lorem, more logic.",
  "Your prompt's adult supervision.",
  "Cleanup crew for AI messes.",
  "AI wrote it? Oracle babysits it.",
  "Turning maybe into mergeable.",
  "The AI said vibes; we said tests.",
  "Cleanup crew for model-made messes\u2014now with citations.",
  "Less hallucination, more escalation.",
  "Your AI's ghostwriter, but with citations.",
  "Where prompt soup becomes production code.",
  "From shruggy agents to shippable PRs.",
  "Token mop for agent spillover.",
  "We QA the AI so you can ship the code.",
  "Less improv, more implementation.",
  "Ships facts faster than agents make excuses.",
  "From prompt chaos to PR-ready prose.",
  "Your AI's hot take, fact-checked.",
  "Cleanup crew for LLM loose ends.",
  "We babysit the bot; you ship the build.",
  "Prompt drama in; release notes out.",
  "AI confidence filtered through reality.",
  "From 'it told me so' to 'tests say so'.",
  "We refactor the model's hubris before it hits prod.",
  "Prompt chaos triaged, answers discharged.",
  "Oracle babysits; you merge.",
  "Vibes quarantined; facts admitted.",
  "The cleanup crew for speculative stack traces.",
  "Ship-ready answers, minus the AI improv.",
  "We pre-empt the hallucination so you don't triage it at 2am.",
  "AI confidence monitored, citations required.",
  "Ship logs, not lore.",
  "Hallucinations flagged, reality shipped.",
  "We lint the lore so you can ship the code.",
  "Hallucination hotline: we answer, not the pager.",
  "Less mystique, more mergeability.",
  "Slop filter set past 11.",
  "Bottled prompt chaos, filtered answers.",
  "Your AI's swagger, audited.",
  "New year, same oracle: resolutions shipped, not wished.",
  "Lunar New Year sweep: clear caches, invite good deploys.",
  "Eid Mubarak: feast on clarity, fast from hallucinations.",
  "Diwali: lights on, incident lights off.",
  "Holi colors on dashboards, not in logs.",
  "Workers' Day: let oracle haul the heavy context.",
  "Earth Day: trim carbon, trim token waste.",
  "Halloween: ship treats, not trick exceptions.",
  "Independence Day: sparkles in the sky, not in the error console.",
  "Christmas: all is calm, all is shipped.",
  "Nowruz reset: sweep caches, welcome clean deploys.",
  "Hanukkah lights, zero prod fires.",
  "Ramadan focus: fast from scope creep, feast on clarity.",
  "Pride Month: more color on the streets, less red in CI.",
  "Thanksgiving: grateful for green builds, no turkey outages.",
  "Solstice deploy: longest day, shortest incident list."
];
var DAY_MS = 24 * 60 * 60 * 1e3;
function utcParts(date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate()
  };
}
var onMonthDay = (month, day) => (date) => {
  const parts = utcParts(date);
  return parts.month === month && parts.day === day;
};
var onSpecificDates = (dates, durationDays = 1) => (date) => {
  const parts = utcParts(date);
  return dates.some(([year, month, day]) => {
    if (parts.year !== year) return false;
    const start = Date.UTC(year, month, day);
    const current = Date.UTC(parts.year, parts.month, parts.day);
    return current >= start && current < start + durationDays * DAY_MS;
  });
};
var inYearWindow = (windows) => (date) => {
  const parts = utcParts(date);
  const window = windows.find((entry) => entry.year === parts.year);
  if (!window) return false;
  const start = Date.UTC(window.year, window.month, window.day);
  const current = Date.UTC(parts.year, parts.month, parts.day);
  return current >= start && current < start + window.duration * DAY_MS;
};
var isFourthThursdayOfNovember = (date) => {
  const parts = utcParts(date);
  if (parts.month !== 10) return false;
  const firstDay = new Date(Date.UTC(parts.year, 10, 1)).getUTCDay();
  const offsetToThursday = (4 - firstDay + 7) % 7;
  const fourthThursday = 1 + offsetToThursday + 21;
  return parts.day === fourthThursday;
};
var HOLIDAY_RULES = /* @__PURE__ */ new Map([
  ["New year, same oracle: resolutions shipped, not wished.", onMonthDay(0, 1)],
  [
    "Lunar New Year sweep: clear caches, invite good deploys.",
    onSpecificDates(
      [
        [2025, 0, 29],
        [2026, 1, 17],
        [2027, 1, 6]
      ],
      1
    )
  ],
  [
    "Eid Mubarak: feast on clarity, fast from hallucinations.",
    onSpecificDates(
      [
        [2025, 2, 31],
        [2026, 2, 20],
        [2027, 2, 10]
      ],
      1
    )
  ],
  [
    "Diwali: lights on, incident lights off.",
    onSpecificDates(
      [
        [2025, 9, 20],
        [2026, 10, 8],
        [2027, 9, 29]
      ],
      1
    )
  ],
  [
    "Holi colors on dashboards, not in logs.",
    onSpecificDates(
      [
        [2025, 2, 14],
        [2026, 2, 3],
        [2027, 2, 23]
      ],
      1
    )
  ],
  ["Workers' Day: let oracle haul the heavy context.", onMonthDay(4, 1)],
  ["Earth Day: trim carbon, trim token waste.", onMonthDay(3, 22)],
  ["Halloween: ship treats, not trick exceptions.", onMonthDay(9, 31)],
  [
    "Independence Day: sparkles in the sky, not in the error console.",
    onMonthDay(6, 4)
  ],
  ["Christmas: all is calm, all is shipped.", onMonthDay(11, 25)],
  ["Nowruz reset: sweep caches, welcome clean deploys.", onMonthDay(2, 20)],
  [
    "Hanukkah lights, zero prod fires.",
    inYearWindow([
      { year: 2025, month: 11, day: 14, duration: 8 },
      { year: 2026, month: 11, day: 4, duration: 8 },
      { year: 2027, month: 10, day: 24, duration: 8 }
    ])
  ],
  [
    "Ramadan focus: fast from scope creep, feast on clarity.",
    inYearWindow([
      { year: 2025, month: 1, day: 28, duration: 30 },
      { year: 2026, month: 1, day: 17, duration: 30 },
      { year: 2027, month: 1, day: 7, duration: 30 }
    ])
  ],
  ["Pride Month: more color on the streets, less red in CI.", (date) => utcParts(date).month === 5],
  ["Thanksgiving: grateful for green builds, no turkey outages.", isFourthThursdayOfNovember],
  ["Solstice deploy: longest day, shortest incident list.", onMonthDay(5, 21)]
]);
function isTaglineActive(tagline, date) {
  const rule = HOLIDAY_RULES.get(tagline);
  if (!rule) return true;
  return rule(date);
}
function activeTaglines(options = {}) {
  const today = options.now ? options.now() : /* @__PURE__ */ new Date();
  const filtered = TAGLINES.filter((tagline) => isTaglineActive(tagline, today));
  return filtered.length > 0 ? filtered : TAGLINES;
}
function pickTagline(options = {}) {
  const env = options.env ?? process.env;
  const override = env?.ORACLE_TAGLINE_INDEX;
  if (override !== void 0) {
    const parsed = Number.parseInt(override, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      return TAGLINES[parsed % TAGLINES.length];
    }
  }
  const pool = activeTaglines(options);
  const rand = options.random ?? Math.random;
  const index = Math.floor(rand() * pool.length) % pool.length;
  return pool[index];
}
function formatIntroLine(version, options = {}) {
  const tagline = pickTagline(options);
  const rich = options.richTty ?? true;
  if (rich && chalk6.level > 0) {
    return `${chalk6.bold("\u{1F9FF} oracle")} ${version} \u2014 ${tagline}`;
  }
  return `\u{1F9FF} oracle ${version} \u2014 ${tagline}`;
}

// src/cli/bundleWarnings.ts
import chalk7 from "chalk";
function warnIfOversizeBundle(estimatedTokens, threshold = 196e3, log = console.log) {
  if (Number.isNaN(estimatedTokens) || estimatedTokens <= threshold) {
    return false;
  }
  const msg = `Warning: bundle is ~${estimatedTokens.toLocaleString()} tokens (>${threshold.toLocaleString()}); may exceed model limits.`;
  log(chalk7.red(msg));
  return true;
}

// src/cli/renderOutput.ts
function shouldRenderRich(options = {}) {
  return options.richTty ?? Boolean(process.stdout.isTTY);
}
async function formatRenderedMarkdown(markdown, options = {}) {
  const richTty = shouldRenderRich(options);
  if (!richTty) return markdown;
  try {
    return renderMarkdownAnsi(markdown);
  } catch {
    return markdown;
  }
}

// src/cli/renderFlags.ts
function resolveRenderFlag(render2, renderMarkdown) {
  return Boolean(renderMarkdown || render2);
}
function resolveRenderPlain(renderPlain, render2, renderMarkdown) {
  if (!renderPlain) return false;
  return Boolean(renderMarkdown || render2 || renderPlain);
}

// src/cli/sessionCommand.ts
import chalk8 from "chalk";
var defaultDependencies = {
  showStatus,
  attachSession,
  usesDefaultStatusFilters,
  deleteSessionsOlderThan: (options) => sessionStore.deleteOlderThan(options),
  getSessionPaths: (sessionId) => sessionStore.getPaths(sessionId)
};
var SESSION_OPTION_KEYS = /* @__PURE__ */ new Set(["hours", "limit", "all", "clear", "clean", "render", "renderMarkdown", "path", "model"]);
async function handleSessionCommand(sessionId, command, deps = defaultDependencies) {
  const sessionOptions = command.opts();
  if (sessionOptions.verboseRender) {
    process.env.ORACLE_VERBOSE_RENDER = "1";
  }
  const renderSource = command.getOptionValueSource?.("render");
  const renderMarkdownSource = command.getOptionValueSource?.("renderMarkdown");
  const renderExplicit = renderSource === "cli" || renderMarkdownSource === "cli";
  const autoRender = !renderExplicit && process.stdout.isTTY;
  const pathRequested = Boolean(sessionOptions.path);
  const clearRequested = Boolean(sessionOptions.clear || sessionOptions.clean);
  if (clearRequested) {
    if (sessionId) {
      console.error("Cannot combine a session ID with --clear. Remove the ID to delete cached sessions.");
      process.exitCode = 1;
      return;
    }
    const hours = sessionOptions.hours;
    const includeAll = sessionOptions.all;
    const result = await deps.deleteSessionsOlderThan({ hours, includeAll });
    const scope = includeAll ? "all stored sessions" : `sessions older than ${hours}h`;
    console.log(formatSessionCleanupMessage(result, scope));
    return;
  }
  if (sessionId === "clear" || sessionId === "clean") {
    console.error('Session cleanup now uses --clear. Run "oracle session --clear --hours <n>" instead.');
    process.exitCode = 1;
    return;
  }
  if (pathRequested) {
    if (!sessionId) {
      console.error("The --path flag requires a session ID.");
      process.exitCode = 1;
      return;
    }
    try {
      const paths = await deps.getSessionPaths(sessionId);
      const richTty = Boolean(process.stdout.isTTY && chalk8.level > 0);
      const label = (text) => richTty ? chalk8.cyan(text) : text;
      const value = (text) => richTty ? chalk8.dim(text) : text;
      console.log(`${label("Session dir:")} ${value(paths.dir)}`);
      console.log(`${label("Metadata:")} ${value(paths.metadata)}`);
      console.log(`${label("Request:")} ${value(paths.request)}`);
      console.log(`${label("Log:")} ${value(paths.log)}`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
    return;
  }
  if (!sessionId) {
    const showExamples = deps.usesDefaultStatusFilters(command);
    await deps.showStatus({
      hours: sessionOptions.all ? Infinity : sessionOptions.hours,
      includeAll: sessionOptions.all,
      limit: sessionOptions.limit,
      showExamples,
      modelFilter: sessionOptions.model
    });
    return;
  }
  const ignoredFlags = listIgnoredFlags(command);
  if (ignoredFlags.length > 0) {
    console.log(`Ignoring flags on session attach: ${ignoredFlags.join(", ")}`);
  }
  const renderMarkdown = Boolean(sessionOptions.render || sessionOptions.renderMarkdown || autoRender);
  await deps.attachSession(sessionId, {
    renderMarkdown,
    renderPrompt: !sessionOptions.hidePrompt,
    model: sessionOptions.model
  });
}
function formatSessionCleanupMessage(result, scope) {
  const deletedLabel = `${result.deleted} ${result.deleted === 1 ? "session" : "sessions"}`;
  const remainingLabel = `${result.remaining} ${result.remaining === 1 ? "session" : "sessions"} remain`;
  const hint = 'Run "oracle session --clear --all" to delete everything.';
  return `Deleted ${deletedLabel} (${scope}). ${remainingLabel}.
${hint}`;
}
function listIgnoredFlags(command) {
  const opts = command.optsWithGlobals();
  const ignored = [];
  for (const key of Object.keys(opts)) {
    if (SESSION_OPTION_KEYS.has(key)) {
      continue;
    }
    const source = command.getOptionValueSource?.(key);
    if (source !== "cli" && source !== "env") {
      continue;
    }
    const value = opts[key];
    if (value === void 0 || value === false || value === null) {
      continue;
    }
    ignored.push(key);
  }
  return ignored;
}

// src/cli/rootAlias.ts
var defaultDeps2 = {
  attachSession,
  showStatus
};
async function handleStatusFlag(options, deps = defaultDeps2) {
  if (!options.status) {
    return false;
  }
  if (options.session) {
    await deps.attachSession(options.session);
    return true;
  }
  await deps.showStatus({ hours: 24, includeAll: false, limit: 100, showExamples: true });
  return true;
}
var defaultSessionDeps = {
  attachSession
};
async function handleSessionAlias(options, deps = defaultSessionDeps) {
  if (!options.session) {
    return false;
  }
  await deps.attachSession(options.session);
  return true;
}

// src/cli/writeOutputPath.ts
import os3 from "node:os";
import path11 from "node:path";
function resolveOutputPath(input, cwd) {
  if (!input || input.trim().length === 0) {
    return void 0;
  }
  const expanded = input.startsWith("~/") ? path11.join(os3.homedir(), input.slice(2)) : input;
  if (expanded === "-" || expanded === "/dev/stdout") {
    return expanded;
  }
  const absolute = path11.isAbsolute(expanded) ? expanded : path11.resolve(cwd, expanded);
  const sessionsDir = sessionStore.sessionsDir();
  const normalizedSessionsDir = path11.resolve(sessionsDir);
  const normalizedTarget = path11.resolve(absolute);
  if (normalizedTarget === normalizedSessionsDir || normalizedTarget.startsWith(`${normalizedSessionsDir}${path11.sep}`)) {
    throw new Error(`Refusing to write output inside session storage (${normalizedSessionsDir}). Choose another path.`);
  }
  return absolute;
}

// src/version.ts
import { readFileSync } from "node:fs";
import path12 from "node:path";
import { fileURLToPath } from "node:url";
var cachedVersion = null;
function getCliVersion() {
  if (cachedVersion) {
    return cachedVersion;
  }
  cachedVersion = readVersionFromPackage();
  return cachedVersion;
}
function readVersionFromPackage() {
  const modulePath = fileURLToPath(import.meta.url);
  let currentDir = path12.dirname(modulePath);
  const filesystemRoot = path12.parse(currentDir).root;
  while (true) {
    const candidate = path12.join(currentDir, "package.json");
    try {
      const raw = readFileSync(candidate, "utf8");
      const parsed = JSON.parse(raw);
      const version = typeof parsed.version === "string" && parsed.version.trim().length > 0 ? parsed.version.trim() : "0.0.0";
      return version;
    } catch (error) {
      const code = error instanceof Error && "code" in error ? error.code : void 0;
      if (code && code !== "ENOENT") {
        break;
      }
    }
    if (currentDir === filesystemRoot) {
      break;
    }
    currentDir = path12.dirname(currentDir);
  }
  return "0.0.0";
}

// src/cli/dryRun.ts
import chalk9 from "chalk";
async function runDryRunSummary({
  runOptions,
  cwd,
  version,
  log
}, deps = {}) {
  await runApiDryRun({ runOptions, cwd, version, log }, deps);
}
async function runApiDryRun({
  runOptions,
  cwd,
  version,
  log
}, deps) {
  const readFilesImpl = deps.readFilesImpl ?? readFiles;
  const files = await readFilesImpl(runOptions.file ?? [], { cwd });
  const systemPrompt = runOptions.system?.trim() || DEFAULT_SYSTEM_PROMPT;
  const combinedPrompt = buildPrompt(runOptions.prompt ?? "", files, cwd);
  const modelConfig = isKnownModel(runOptions.model) ? MODEL_CONFIGS[runOptions.model] : MODEL_CONFIGS["gpt-5.1"];
  const tokenizer = modelConfig.tokenizer;
  const estimatedInputTokens = tokenizer(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: combinedPrompt }
    ],
    TOKENIZER_OPTIONS
  );
  const modelLabel = runOptions.models?.length ? runOptions.models.join(", ") : runOptions.model;
  const headerLine = `[dry-run] Oracle (${version}) would call ${modelLabel} with ~${estimatedInputTokens.toLocaleString()} tokens and ${files.length} files.`;
  log(chalk9.cyan(headerLine));
  if (files.length === 0) {
    log(chalk9.dim("[dry-run] No files matched the provided --file patterns."));
    return;
  }
  const inputBudget = runOptions.maxInput ?? modelConfig.inputLimit;
  const stats = getFileTokenStats(files, {
    cwd,
    tokenizer,
    tokenizerOptions: TOKENIZER_OPTIONS,
    inputTokenBudget: inputBudget
  });
  printFileTokenStats(stats, { inputTokenBudget: inputBudget, log });
}

// src/config.ts
import fs8 from "node:fs/promises";
import path13 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
var __dirname = path13.dirname(fileURLToPath2(import.meta.url));
async function loadDefaultModels(env = process.env) {
  if (env.ORACLE_MODEL) return [env.ORACLE_MODEL];
  const modelsPath = path13.resolve(__dirname, "../MODELS.md");
  try {
    const raw = await fs8.readFile(modelsPath, "utf8");
    return raw.split("\n").map((l) => l.replace(/#.*$/, "").trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// src/cli/duplicatePromptGuard.ts
import chalk10 from "chalk";
async function shouldBlockDuplicatePrompt({
  prompt,
  force,
  sessionStore: sessionStore2,
  log = console.log
}) {
  if (force) return false;
  const normalized = prompt?.trim();
  if (!normalized) return false;
  const running = (await sessionStore2.listSessions()).filter((entry) => entry.status === "running");
  const duplicate = running.find(
    (entry) => (entry.options?.prompt?.trim?.() ?? "") === normalized
  );
  if (!duplicate) return false;
  log(
    chalk10.yellow(
      `A session with the same prompt is already running (${duplicate.id}). Reattach with "oracle session ${duplicate.id}" or rerun with --force to start another run.`
    )
  );
  return true;
}

// bin/oracle-cli.ts
var VERSION = getCliVersion();
var CLI_ENTRYPOINT = fileURLToPath3(import.meta.url);
var LEGACY_FLAG_ALIASES = /* @__PURE__ */ new Map([["--[no-]background", "--background"]]);
var normalizedArgv = process.argv.map((arg, index) => {
  if (index < 2) return arg;
  return LEGACY_FLAG_ALIASES.get(arg) ?? arg;
});
var rawCliArgs = normalizedArgv.slice(2);
var userCliArgs = rawCliArgs[0] === CLI_ENTRYPOINT ? rawCliArgs.slice(1) : rawCliArgs;
var isTty3 = process.stdout.isTTY;
var program = new Command();
var introPrinted = false;
program.hook("preAction", () => {
  if (introPrinted) return;
  const opts = program.optsWithGlobals();
  if (opts.json) return;
  console.log(formatIntroLine(VERSION, { env: process.env, richTty: isTty3 }));
  introPrinted = true;
});
applyHelpStyling(program, VERSION, isTty3);
program.hook("preAction", (thisCommand) => {
  if (thisCommand !== program) {
    return;
  }
  if (userCliArgs.some((arg) => arg === "--help" || arg === "-h")) {
    return;
  }
  if (userCliArgs.length === 0) {
    return;
  }
  const opts = thisCommand.optsWithGlobals();
  applyHiddenAliases(opts, (key, value) => thisCommand.setOptionValue(key, value));
  const positional = thisCommand.args?.[0];
  if (!opts.prompt && positional) {
    opts.prompt = positional;
    thisCommand.setOptionValue("prompt", positional);
  }
  if (shouldRequirePrompt(userCliArgs, opts)) {
    console.log(
      chalk11.yellow('Prompt is required. Provide it via --prompt "<text>" or positional [prompt].')
    );
    thisCommand.help({ error: false });
    process.exitCode = 1;
    return;
  }
});
program.name("oracle").description("Multi-model LLM CLI \u2014 bundles prompt + files for API queries.").version(VERSION).argument("[prompt]", "Prompt text (shorthand for --prompt).").option("-p, --prompt <text>", "User prompt to send to the model.").option("-P, --prompt-file <path>", "Read prompt from a file (avoids shell escaping).").addOption(new Option("--message <text>", "Alias for --prompt.").hideHelp()).option(
  "-f, --file <paths...>",
  "Files/directories or glob patterns to attach (prefix with !pattern to exclude). Files larger than 1 MB are rejected automatically.",
  collectPaths,
  []
).addOption(
  new Option("--include <paths...>", "Alias for --file.").argParser(collectPaths).default([]).hideHelp()
).addOption(
  new Option("--files <paths...>", "Alias for --file.").argParser(collectPaths).default([]).hideHelp()
).addOption(
  new Option("--path <paths...>", "Alias for --file.").argParser(collectPaths).default([]).hideHelp()
).addOption(
  new Option("--paths <paths...>", "Alias for --file.").argParser(collectPaths).default([]).hideHelp()
).option("-s, --slug <words>", "Custom session slug (3-5 words).").option(
  "-m, --model <model>",
  "Model to target (default from config or google/gemini-3.1-pro-preview). Any OpenRouter model ID works (e.g. x-ai/grok-4.1-fast).",
  normalizeModelOption
).addOption(
  new Option(
    "--models <models>",
    'Comma-separated model list to query in parallel (e.g., "google/gemini-3.1-pro-preview,x-ai/grok-4.1-fast").'
  ).argParser(collectModelList).default([])
).option(
  "--files-report",
  "Show token usage per attached file (also prints automatically when files exceed the token budget).",
  false
).option("-v, --verbose", "Enable verbose logging for all operations.", false).addOption(
  new Option(
    "--timeout <seconds|auto>",
    "Overall timeout before aborting the API call (auto = 60m for pro models, 120s otherwise)."
  ).argParser(parseTimeoutOption).default("auto")
).addOption(
  new Option(
    "--background",
    "Use Responses API background mode (create + retrieve) for API runs."
  ).default(void 0)
).addOption(
  new Option("--no-background", "Disable Responses API background mode.").default(void 0)
).addOption(
  new Option("--http-timeout <ms|s|m|h>", "HTTP client timeout for API requests (default 20m).").argParser((value) => parseDurationOption(value, "HTTP timeout")).default(void 0)
).addOption(
  new Option(
    "--zombie-timeout <ms|s|m|h>",
    "Override stale-session cutoff used by `oracle status` (default 60m)."
  ).argParser((value) => parseDurationOption(value, "Zombie timeout")).default(void 0)
).option(
  "--zombie-last-activity",
  "Base stale-session detection on last log activity instead of start time.",
  false
).addOption(
  new Option(
    "--preview [mode]",
    "(alias) Preview the request without calling the model (summary | json | full). Deprecated: use --dry-run instead."
  ).hideHelp().choices(["summary", "json", "full"]).preset("summary")
).addOption(
  new Option("--dry-run [mode]", "Preview without calling the model (summary | json | full).").choices(["summary", "json", "full"]).preset("summary").default(false)
).addOption(new Option("--exec-session <id>").hideHelp()).addOption(new Option("--session <id>").hideHelp()).addOption(
  new Option("--status", "Show stored sessions (alias for `oracle status`).").default(false).hideHelp()
).option(
  "--render-markdown",
  "Print the assembled markdown bundle for prompt + files and exit.",
  false
).option("--render", "Alias for --render-markdown.", false).option(
  "--render-plain",
  "Render markdown without ANSI/highlighting (use plain text even in a TTY).",
  false
).option(
  "--write-output <path>",
  "Write only the final assistant message to this file (overwrites; multi-model appends .<model> before the extension)."
).option("--verbose-render", "Show render/TTY diagnostics when replaying sessions.", false).addOption(
  new Option("--search <mode>", "Set server-side search behavior (on/off).").argParser(parseSearchOption).hideHelp()
).addOption(
  new Option("--max-input <tokens>", "Override the input token budget for the selected model.").argParser(parseIntOption).hideHelp()
).addOption(
  new Option("--max-output <tokens>", "Override the max output tokens for the selected model.").argParser(parseIntOption).hideHelp()
).option(
  "--base-url <url>",
  "Override the OpenAI-compatible base URL for API runs (e.g. LiteLLM proxy endpoint)."
).option(
  "--retain-hours <hours>",
  "Prune stored sessions older than this many hours before running (set 0 to disable).",
  parseFloatOption
).option(
  "--force",
  "Force start a new session even if an identical prompt is already running.",
  false
).option("--debug-help", "Show the advanced/debug option set and exit.", false).option(
  "--heartbeat <seconds>",
  "Emit periodic in-progress updates (0 to disable).",
  parseHeartbeatOption,
  30
).addOption(new Option("--wait").default(void 0)).addOption(new Option("--no-wait").default(void 0).hideHelp()).option("--json", "Output a single JSON object (for programmatic/agent use).", false).showHelpAfterError("(use --help for usage)");
program.addHelpText(
  "after",
  `
Examples:
  # Single-model run
  oracle -p "Summarize the risk register" --file docs/risk-register.md

  # Multi-model via OpenRouter
  oracle --models "google/gemini-3.1-pro-preview,x-ai/grok-4.1-fast" \\
    -p "Review the TS data layer" --file "src/**/*.ts"

  # Read prompt from a file (avoids shell escaping)
  oracle -P prompt.md --file "src/**/*.ts"
`
);
var sessionCommand = program.command("session [id]").description("Attach to a stored session or list recent sessions when no ID is provided.").option(
  "--hours <hours>",
  "Look back this many hours when listing sessions (default 24).",
  parseFloatOption,
  24
).option(
  "--limit <count>",
  "Maximum sessions to show when listing (max 1000).",
  parseIntOption,
  100
).option("--all", "Include all stored sessions regardless of age.", false).option("--clear", "Delete stored sessions older than the provided window (24h default).", false).option("--hide-prompt", "Hide stored prompt when displaying a session.", false).option("--render", "Render completed session output as markdown (rich TTY only).", false).option("--render-markdown", "Alias for --render.", false).option("--model <name>", "Filter sessions/output for a specific model.", "").option("--path", "Print the stored session paths instead of attaching.", false).addOption(new Option("--clean", "Deprecated alias for --clear.").default(false).hideHelp()).action(async (sessionId, _options, cmd) => {
  await handleSessionCommand(sessionId, cmd);
});
var statusCommand = program.command("status [id]").description(
  "List recent sessions (24h window by default) or attach to a session when an ID is provided."
).option("--hours <hours>", "Look back this many hours (default 24).", parseFloatOption, 24).option("--limit <count>", "Maximum sessions to show (max 1000).", parseIntOption, 100).option("--all", "Include all stored sessions regardless of age.", false).option("--clear", "Delete stored sessions older than the provided window (24h default).", false).option("--render", "Render completed session output as markdown (rich TTY only).", false).option("--render-markdown", "Alias for --render.", false).option("--model <name>", "Filter sessions/output for a specific model.", "").option("--hide-prompt", "Hide stored prompt when displaying a session.", false).addOption(new Option("--clean", "Deprecated alias for --clear.").default(false).hideHelp()).action(async (sessionId, _options, command) => {
  const statusOptions = command.opts();
  const clearRequested = Boolean(statusOptions.clear || statusOptions.clean);
  if (clearRequested) {
    if (sessionId) {
      console.error(
        "Cannot combine a session ID with --clear. Remove the ID to delete cached sessions."
      );
      process.exitCode = 1;
      return;
    }
    const hours = statusOptions.hours;
    const includeAll = statusOptions.all;
    const result = await sessionStore.deleteOlderThan({ hours, includeAll });
    const scope = includeAll ? "all stored sessions" : `sessions older than ${hours}h`;
    console.log(formatSessionCleanupMessage(result, scope));
    return;
  }
  if (sessionId === "clear" || sessionId === "clean") {
    console.error(
      'Session cleanup now uses --clear. Run "oracle status --clear --hours <n>" instead.'
    );
    process.exitCode = 1;
    return;
  }
  if (sessionId) {
    const autoRender = !command.getOptionValueSource?.("render") && !command.getOptionValueSource?.("renderMarkdown") ? process.stdout.isTTY : false;
    const renderMarkdown = Boolean(
      statusOptions.render || statusOptions.renderMarkdown || autoRender
    );
    await attachSession(sessionId, { renderMarkdown, renderPrompt: !statusOptions.hidePrompt });
    return;
  }
  const showExamples = usesDefaultStatusFilters(command);
  await showStatus({
    hours: statusOptions.all ? Infinity : statusOptions.hours,
    includeAll: statusOptions.all,
    limit: statusOptions.limit,
    showExamples
  });
});
function buildRunOptions(options, overrides = {}) {
  if (!options.prompt) {
    throw new Error("Prompt is required.");
  }
  const normalizedBaseUrl = normalizeBaseUrl(overrides.baseUrl ?? options.baseUrl);
  return {
    prompt: options.prompt,
    model: options.model,
    models: overrides.models ?? options.models,
    effectiveModelId: overrides.effectiveModelId ?? options.effectiveModelId ?? options.model,
    file: overrides.file ?? options.file ?? [],
    slug: overrides.slug ?? options.slug,
    filesReport: overrides.filesReport ?? options.filesReport,
    maxInput: overrides.maxInput ?? options.maxInput,
    maxOutput: overrides.maxOutput ?? options.maxOutput,
    system: overrides.system ?? options.system,
    timeoutSeconds: overrides.timeoutSeconds ?? options.timeout,
    httpTimeoutMs: overrides.httpTimeoutMs ?? options.httpTimeout,
    zombieTimeoutMs: overrides.zombieTimeoutMs ?? options.zombieTimeout,
    zombieUseLastActivity: overrides.zombieUseLastActivity ?? options.zombieLastActivity,
    silent: overrides.silent ?? options.silent,
    search: overrides.search ?? options.search,
    preview: overrides.preview ?? void 0,
    previewMode: overrides.previewMode ?? options.previewMode,
    apiKey: overrides.apiKey ?? options.apiKey,
    baseUrl: normalizedBaseUrl,
    sessionId: overrides.sessionId ?? options.sessionId,
    verbose: overrides.verbose ?? options.verbose,
    heartbeatIntervalMs: overrides.heartbeatIntervalMs ?? resolveHeartbeatIntervalMs(options.heartbeat),
    background: overrides.background ?? void 0,
    renderPlain: overrides.renderPlain ?? options.renderPlain ?? false,
    writeOutputPath: overrides.writeOutputPath ?? options.writeOutputPath
  };
}
function resolveHeartbeatIntervalMs(seconds) {
  if (typeof seconds !== "number" || seconds <= 0) {
    return void 0;
  }
  return Math.round(seconds * 1e3);
}
function buildRunOptionsFromMetadata(metadata) {
  const stored = metadata.options ?? {};
  return {
    prompt: stored.prompt ?? "",
    model: stored.model ?? DEFAULT_MODEL,
    models: stored.models,
    effectiveModelId: stored.effectiveModelId ?? stored.model,
    file: stored.file ?? [],
    slug: stored.slug,
    filesReport: stored.filesReport,
    maxInput: stored.maxInput,
    maxOutput: stored.maxOutput,
    system: stored.system,
    silent: stored.silent,
    search: stored.search,
    preview: false,
    previewMode: void 0,
    apiKey: void 0,
    baseUrl: normalizeBaseUrl(stored.baseUrl),
    timeoutSeconds: stored.timeoutSeconds,
    httpTimeoutMs: stored.httpTimeoutMs,
    zombieTimeoutMs: stored.zombieTimeoutMs,
    zombieUseLastActivity: stored.zombieUseLastActivity,
    sessionId: metadata.id,
    verbose: stored.verbose,
    heartbeatIntervalMs: stored.heartbeatIntervalMs,
    background: stored.background,
    renderPlain: stored.renderPlain,
    writeOutputPath: stored.writeOutputPath
  };
}
async function runRootCommand(options) {
  const defaultModels = await loadDefaultModels();
  const jsonOutput = Boolean(options.json);
  const helpRequested = rawCliArgs.some((arg) => arg === "--help" || arg === "-h");
  const optionUsesDefault = (name) => {
    const source = program.getOptionValueSource?.(name);
    return source == null || source === "default";
  };
  if (helpRequested) {
    if (options.verbose) {
      console.log("");
      printDebugHelp(program.name());
      console.log("");
    }
    program.help({ error: false });
    return;
  }
  if (options.promptFile) {
    if (options.prompt) {
      throw new Error("--prompt-file cannot be combined with --prompt or positional prompt.");
    }
    options.prompt = (await readFile(resolve(options.promptFile), "utf8")).trim();
    if (!options.prompt) throw new Error(`Prompt file is empty: ${options.promptFile}`);
  }
  const previewMode = resolvePreviewMode(options.dryRun || options.preview);
  const mergedFileInputs = mergePathLikeOptions(
    options.file,
    options.include,
    options.files,
    options.path,
    options.paths
  );
  if (mergedFileInputs.length > 0) {
    const { deduped, duplicates } = dedupePathInputs(mergedFileInputs, { cwd: process.cwd() });
    if (duplicates.length > 0) {
      const preview = duplicates.slice(0, 8).join(", ");
      const suffix = duplicates.length > 8 ? ` (+${duplicates.length - 8} more)` : "";
      if (!jsonOutput)
        console.log(chalk11.dim(`Ignoring duplicate --file inputs: ${preview}${suffix}`));
    }
    options.file = deduped;
  }
  const renderMarkdown = resolveRenderFlag(options.render, options.renderMarkdown);
  const renderPlain = resolveRenderPlain(
    options.renderPlain,
    options.render,
    options.renderMarkdown
  );
  const applyRetentionOption = () => {
    const envRetention = process.env.ORACLE_RETAIN_HOURS;
    if (optionUsesDefault("retainHours") && envRetention) {
      const parsed = Number.parseFloat(envRetention);
      if (!Number.isNaN(parsed)) {
        options.retainHours = parsed;
      }
    }
  };
  applyRetentionOption();
  if (userCliArgs.length === 0) {
    console.log(chalk11.yellow("No prompt or subcommand supplied. Run `oracle --help` for usage."));
    program.outputHelp();
    return;
  }
  const retentionHours = typeof options.retainHours === "number" ? options.retainHours : void 0;
  await sessionStore.ensureStorage();
  await pruneOldSessions(
    retentionHours,
    jsonOutput ? () => {
    } : (message) => console.log(chalk11.dim(message))
  );
  if (options.debugHelp) {
    printDebugHelp(program.name());
    return;
  }
  if (options.dryRun && options.renderMarkdown) {
    throw new Error("--dry-run cannot be combined with --render-markdown.");
  }
  const engine = "api";
  const cliModelsExplicit = !optionUsesDefault("models");
  const cliModelExplicit = !optionUsesDefault("model");
  if (cliModelsExplicit && cliModelExplicit) {
    throw new Error("--models cannot be combined with --model.");
  }
  if (!cliModelsExplicit && !cliModelExplicit && defaultModels.length > 0) {
    options.models = defaultModels;
  }
  const multiModelProvided = Array.isArray(options.models) && options.models.length > 0;
  const normalizedMultiModels = multiModelProvided ? Array.from(new Set(options.models.map((entry) => resolveApiModel(entry)))) : [];
  const cliModelArg = normalizeModelOption(options.model) || (multiModelProvided ? "" : DEFAULT_MODEL);
  const resolvedModelCandidate = multiModelProvided ? normalizedMultiModels[0] : resolveApiModel(cliModelArg || DEFAULT_MODEL);
  const resolvedModel = normalizedMultiModels[0] ?? resolvedModelCandidate;
  const effectiveModelId = MODEL_CONFIGS[resolvedModel]?.apiModel ?? resolvedModel;
  const resolvedBaseUrl = normalizeBaseUrl(options.baseUrl ?? process.env.OPENAI_BASE_URL);
  const { models: _rawModels, ...optionsWithoutModels } = options;
  const resolvedOptions = { ...optionsWithoutModels, model: resolvedModel };
  if (normalizedMultiModels.length > 0) {
    resolvedOptions.models = normalizedMultiModels;
  }
  resolvedOptions.baseUrl = resolvedBaseUrl;
  resolvedOptions.effectiveModelId = effectiveModelId;
  resolvedOptions.writeOutputPath = resolveOutputPath(options.writeOutput, process.cwd());
  if (jsonOutput) options.heartbeat = 0;
  const waitPreference = jsonOutput ? true : resolveWaitFlag({
    waitFlag: options.wait,
    model: resolvedModel
  });
  if (await handleStatusFlag(options, { attachSession, showStatus })) {
    return;
  }
  if (await handleSessionAlias(options, { attachSession })) {
    return;
  }
  if (options.execSession) {
    await executeSession(options.execSession);
    return;
  }
  if (renderMarkdown) {
    if (!options.prompt) {
      throw new Error("Prompt is required when using --render-markdown.");
    }
    const bundle = await buildMarkdownBundle(
      { prompt: options.prompt, file: options.file, system: options.system },
      { cwd: process.cwd() }
    );
    const modelConfig = isKnownModel(resolvedModel) ? MODEL_CONFIGS[resolvedModel] : MODEL_CONFIGS["gpt-5.1"];
    const requestBody = buildRequestBody({
      modelConfig,
      systemPrompt: bundle.systemPrompt,
      userPrompt: bundle.promptWithFiles,
      searchEnabled: options.search !== false,
      background: false,
      storeResponse: false
    });
    const estimatedTokens = estimateRequestTokens(requestBody, modelConfig);
    const warnThreshold = Math.min(196e3, modelConfig.inputLimit ?? 196e3);
    warnIfOversizeBundle(estimatedTokens, warnThreshold, console.log);
    const output = renderPlain ? bundle.markdown : await formatRenderedMarkdown(bundle.markdown, { richTty: isTty3 });
    console.log(output.replace(/\n+$/u, ""));
    return;
  }
  if (previewMode) {
    if (!options.prompt) {
      throw new Error("Prompt is required when using --dry-run/preview.");
    }
    resolvedOptions.prompt = options.prompt;
    const runOptions = buildRunOptions(resolvedOptions, {
      preview: true,
      previewMode,
      baseUrl: resolvedBaseUrl
    });
    await runDryRunSummary(
      {
        runOptions,
        cwd: process.cwd(),
        version: VERSION,
        log: console.log
      },
      {}
    );
    return;
  }
  if (!options.prompt) {
    throw new Error("Prompt is required when starting a new session.");
  }
  resolvedOptions.prompt = options.prompt;
  const duplicateBlocked = await shouldBlockDuplicatePrompt({
    prompt: resolvedOptions.prompt,
    force: options.force,
    sessionStore,
    log: jsonOutput ? () => {
    } : console.log
  });
  if (duplicateBlocked) {
    process.exitCode = 1;
    return;
  }
  if (options.file && options.file.length > 0) {
    await readFiles(options.file, { cwd: process.cwd() });
  }
  await sessionStore.ensureStorage();
  const baseRunOptions = buildRunOptions(resolvedOptions, {
    preview: false,
    previewMode: void 0,
    background: resolvedOptions.background,
    baseUrl: resolvedBaseUrl
  });
  const sessionMeta = await sessionStore.createSession(
    {
      ...baseRunOptions,
      mode: "api",
      waitPreference
    },
    process.cwd()
  );
  const liveRunOptions = {
    ...baseRunOptions,
    sessionId: sessionMeta.id,
    effectiveModelId
  };
  const disableDetachEnv = process.env.ORACLE_NO_DETACH === "1";
  const detachAllowed = shouldDetachSession({
    engine,
    model: resolvedModel,
    waitPreference,
    disableDetachEnv
  });
  const detached = !detachAllowed ? false : await launchDetachedSession(sessionMeta.id).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.log(
      chalk11.yellow(`Unable to detach session runner (${message}). Running inline...`)
    );
    return false;
  });
  if (!waitPreference) {
    if (!detached) {
      console.log(chalk11.red("Unable to start in background; use --wait to run inline."));
      process.exitCode = 1;
      return;
    }
    console.log(
      chalk11.blue(`Session running in background. Reattach via: oracle session ${sessionMeta.id}`)
    );
    console.log(
      chalk11.dim("Pro runs can take up to 60 minutes (usually 10-15). Add --wait to stay attached.")
    );
    return;
  }
  if (detached === false) {
    await runInteractiveSession(
      sessionMeta,
      liveRunOptions,
      false,
      true,
      process.cwd(),
      jsonOutput
    );
    return;
  }
  if (detached) {
    console.log(chalk11.blue(`Reattach via: oracle session ${sessionMeta.id}`));
    await attachSession(sessionMeta.id, { suppressMetadata: true });
  }
}
async function runInteractiveSession(sessionMeta, runOptions, showReattachHint = true, suppressSummary = false, cwd = process.cwd(), jsonOutput = false) {
  const { logLine, writeChunk, stream } = sessionStore.createLogWriter(sessionMeta.id);
  let headerAugmented = false;
  const combinedLog = (message = "") => {
    if (jsonOutput) {
      logLine(message);
      return;
    }
    if (!headerAugmented && message.startsWith("oracle (")) {
      headerAugmented = true;
      if (showReattachHint) {
        console.log(`${message}
${chalk11.blue(`Reattach via: oracle session ${sessionMeta.id}`)}`);
      } else {
        console.log(message);
      }
      logLine(message);
      return;
    }
    console.log(message);
    logLine(message);
  };
  const combinedWrite = (chunk) => {
    writeChunk(chunk);
    return true;
  };
  try {
    const result = await performSessionRun({
      sessionMeta,
      runOptions,
      mode: "api",
      cwd,
      log: combinedLog,
      write: combinedWrite,
      version: VERSION,
      muteStdout: jsonOutput
    });
    if (jsonOutput && result) {
      const json = result.answers.length === 1 ? { model: result.answers[0].model, output: result.answers[0].text } : { responses: result.answers.map((a) => ({ model: a.model, output: a.text })) };
      process.stdout.write(JSON.stringify(json) + "\n");
    }
    const latest = await sessionStore.readSession(sessionMeta.id);
    if (!suppressSummary && !jsonOutput) {
      const summary = latest ? formatCompletionSummary(latest, { includeSlug: true }) : null;
      if (summary) {
        console.log("\n" + chalk11.green.bold(summary));
        logLine(summary);
      }
    }
  } catch (error) {
    if (jsonOutput) {
      const message = error instanceof Error ? error.message : String(error);
      process.stdout.write(JSON.stringify({ error: message }) + "\n");
      return;
    }
    throw error;
  } finally {
    stream.end();
  }
}
async function launchDetachedSession(sessionId) {
  return new Promise((resolve2, reject) => {
    try {
      const args = ["--", CLI_ENTRYPOINT, "--exec-session", sessionId];
      const child = spawn(process.execPath, args, {
        detached: true,
        stdio: "ignore",
        env: process.env
      });
      child.once("error", reject);
      child.once("spawn", () => {
        child.unref();
        resolve2(true);
      });
    } catch (error) {
      reject(error);
    }
  });
}
async function executeSession(sessionId) {
  const metadata = await sessionStore.readSession(sessionId);
  if (!metadata) {
    console.error(chalk11.red(`No session found with ID ${sessionId}`));
    process.exitCode = 1;
    return;
  }
  const runOptions = buildRunOptionsFromMetadata(metadata);
  const { logLine, writeChunk, stream } = sessionStore.createLogWriter(sessionId);
  try {
    await performSessionRun({
      sessionMeta: metadata,
      runOptions,
      mode: "api",
      cwd: metadata.cwd ?? process.cwd(),
      log: logLine,
      write: writeChunk,
      version: VERSION
    });
  } catch {
  } finally {
    stream.end();
  }
}
function printDebugHelp(cliName) {
  console.log(chalk11.bold("Advanced Options"));
  printDebugOptionGroup([
    ["--search <on|off>", "Enable or disable the server-side search tool (default on)."],
    ["--max-input <tokens>", "Override the input token budget."],
    ["--max-output <tokens>", "Override the max output tokens (model default otherwise)."]
  ]);
  console.log("");
  console.log(chalk11.dim(`Tip: run \`${cliName} --help\` to see the primary option set.`));
}
function printDebugOptionGroup(entries) {
  const flagWidth = Math.max(...entries.map(([flag]) => flag.length));
  entries.forEach(([flag, description]) => {
    const label = chalk11.cyan(flag.padEnd(flagWidth + 2));
    console.log(`  ${label}${description}`);
  });
}
function resolveWaitFlag({ waitFlag, model }) {
  if (waitFlag === true) return true;
  if (waitFlag === false) return false;
  return !isProModel(model);
}
program.action(async function() {
  const options = this.optsWithGlobals();
  try {
    await runRootCommand(options);
  } catch (error) {
    if (options.json) {
      const message = error instanceof Error ? error.message : String(error);
      process.stdout.write(JSON.stringify({ error: message }) + "\n");
      process.exitCode = 1;
      return;
    }
    throw error;
  }
});
async function main() {
  const parsePromise = program.parseAsync(normalizedArgv);
  const sigintPromise = once(process, "SIGINT").then(() => "sigint");
  const result = await Promise.race([parsePromise.then(() => "parsed"), sigintPromise]);
  if (result === "sigint") {
    console.log(chalk11.yellow("\nCancelled."));
    process.exitCode = 130;
  }
}
void main().catch((error) => {
  if (error instanceof Error) {
    if (!isErrorLogged(error)) {
      console.error(chalk11.red("\u2716"), error.message);
    }
  } else {
    console.error(chalk11.red("\u2716"), error);
  }
  process.exitCode = 1;
});
