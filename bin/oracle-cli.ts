#!/usr/bin/env node
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { Command, Option } from "commander";
import type { OptionValues } from "commander";
import { shouldRequirePrompt } from "../src/cli/promptRequirement.js";
import chalk from "chalk";
import type { SessionMetadata } from "../src/sessionStore.js";
import { sessionStore, pruneOldSessions } from "../src/sessionStore.js";
import {
  DEFAULT_MODEL,
  MODEL_CONFIGS,
  readFiles,
  estimateRequestTokens,
  buildRequestBody,
} from "../src/oracle.js";
import { isKnownModel, isProModel } from "../src/oracle/modelResolver.js";
import type { ModelName, PreviewMode, RunOracleOptions } from "../src/oracle.js";
import { applyHelpStyling } from "../src/cli/help.js";
import {
  collectPaths,
  collectModelList,
  parseFloatOption,
  parseIntOption,
  parseSearchOption,
  usesDefaultStatusFilters,
  resolvePreviewMode,
  normalizeModelOption,
  normalizeBaseUrl,
  resolveApiModel,
  parseHeartbeatOption,
  parseTimeoutOption,
  parseDurationOption,
  mergePathLikeOptions,
  dedupePathInputs,
} from "../src/cli/options.js";
import { buildMarkdownBundle } from "../src/cli/markdownBundle.js";
import { shouldDetachSession } from "../src/cli/detach.js";
import { applyHiddenAliases } from "../src/cli/hiddenAliases.js";
import { performSessionRun } from "../src/cli/sessionRunner.js";
import { attachSession, showStatus, formatCompletionSummary } from "../src/cli/sessionDisplay.js";
import type { ShowStatusOptions } from "../src/cli/sessionDisplay.js";
import { formatIntroLine } from "../src/cli/tagline.js";
import { warnIfOversizeBundle } from "../src/cli/bundleWarnings.js";
import { formatRenderedMarkdown } from "../src/cli/renderOutput.js";
import { resolveRenderFlag, resolveRenderPlain } from "../src/cli/renderFlags.js";
import { resolveEffectiveModelId } from "../src/oracle/effectiveModelId.js";
import {
  handleSessionCommand,
  type StatusOptions,
  formatSessionCleanupMessage,
} from "../src/cli/sessionCommand.js";
import { isErrorLogged } from "../src/cli/errorUtils.js";
import { handleSessionAlias, handleStatusFlag } from "../src/cli/rootAlias.js";
import { resolveOutputPath } from "../src/cli/writeOutputPath.js";
import { getCliVersion } from "../src/version.js";
import { runDryRunSummary } from "../src/cli/dryRun.js";
import { loadDefaultModels } from "../src/config.js";
import { shouldBlockDuplicatePrompt } from "../src/cli/duplicatePromptGuard.js";

interface CliOptions extends OptionValues {
  prompt?: string;
  promptFile?: string;
  message?: string;
  file?: string[];
  include?: string[];
  files?: string[];
  path?: string[];
  paths?: string[];
  render?: boolean;
  model: string;
  models?: string[];
  force?: boolean;
  slug?: string;
  filesReport?: boolean;
  maxInput?: number;
  maxOutput?: number;
  system?: string;
  silent?: boolean;
  search?: boolean;
  preview?: boolean | string;
  previewMode?: PreviewMode;
  apiKey?: string;
  session?: string;
  execSession?: string;
  renderMarkdown?: boolean;
  sessionId?: string;
  timeout?: number | "auto";
  background?: boolean;
  httpTimeout?: number;
  zombieTimeout?: number;
  zombieLastActivity?: boolean;
  verbose?: boolean;
  debugHelp?: boolean;
  heartbeat?: number;
  status?: boolean;
  dryRun?: boolean;
  // tri-state: `true` (forced wait), `false` (forced detach), `undefined` (auto)
  wait?: boolean;
  baseUrl?: string;
  showModelId?: boolean;
  retainHours?: number;
  writeOutput?: string;
  writeOutputPath?: string;
  json?: boolean;
}

type ResolvedCliOptions = Omit<CliOptions, "model"> & {
  model: ModelName;
  models?: ModelName[];
  effectiveModelId?: string;
  writeOutputPath?: string;
};

const VERSION = getCliVersion();
const CLI_ENTRYPOINT = fileURLToPath(import.meta.url);
const LEGACY_FLAG_ALIASES = new Map<string, string>([
  ["--[no-]background", "--background"],
]);
const normalizedArgv = process.argv.map((arg, index) => {
  if (index < 2) return arg;
  return LEGACY_FLAG_ALIASES.get(arg) ?? arg;
});
const rawCliArgs = normalizedArgv.slice(2);
const userCliArgs = rawCliArgs[0] === CLI_ENTRYPOINT ? rawCliArgs.slice(1) : rawCliArgs;
const isTty = process.stdout.isTTY;

const program = new Command();
let introPrinted = false;
program.hook("preAction", () => {
  if (introPrinted) return;
  const opts = program.optsWithGlobals() as CliOptions;
  if (opts.json) return;
  console.log(formatIntroLine(VERSION, { env: process.env, richTty: isTty }));
  introPrinted = true;
});
applyHelpStyling(program, VERSION, isTty);
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
  const opts = thisCommand.optsWithGlobals() as CliOptions;
  applyHiddenAliases(opts, (key, value) => thisCommand.setOptionValue(key, value));
  const positional = thisCommand.args?.[0] as string | undefined;
  if (!opts.prompt && positional) {
    opts.prompt = positional;
    thisCommand.setOptionValue("prompt", positional);
  }
  if (shouldRequirePrompt(userCliArgs, opts)) {
    console.log(
      chalk.yellow('Prompt is required. Provide it via --prompt "<text>" or positional [prompt].'),
    );
    thisCommand.help({ error: false });
    process.exitCode = 1;
    return;
  }
});
program
  .name("oracle")
  .description("Multi-model LLM CLI — bundles prompt + files for API queries.")
  .version(VERSION)
  .argument("[prompt]", "Prompt text (shorthand for --prompt).")
  .option("-p, --prompt <text>", "User prompt to send to the model.")
  .option("-P, --prompt-file <path>", "Read prompt from a file (avoids shell escaping).")
  .addOption(new Option("--message <text>", "Alias for --prompt.").hideHelp())
  .option(
    "-f, --file <paths...>",
    "Files/directories or glob patterns to attach (prefix with !pattern to exclude). Files larger than 1 MB are rejected automatically.",
    collectPaths,
    [],
  )
  .addOption(
    new Option("--include <paths...>", "Alias for --file.")
      .argParser(collectPaths)
      .default([])
      .hideHelp(),
  )
  .addOption(
    new Option("--files <paths...>", "Alias for --file.")
      .argParser(collectPaths)
      .default([])
      .hideHelp(),
  )
  .addOption(
    new Option("--path <paths...>", "Alias for --file.")
      .argParser(collectPaths)
      .default([])
      .hideHelp(),
  )
  .addOption(
    new Option("--paths <paths...>", "Alias for --file.")
      .argParser(collectPaths)
      .default([])
      .hideHelp(),
  )
  .option("-s, --slug <words>", "Custom session slug (3-5 words).")
  .option(
    "-m, --model <model>",
    "Model to target (default from config or google/gemini-3.1-pro-preview). Any OpenRouter model ID works (e.g. x-ai/grok-4.1-fast).",
    normalizeModelOption,
  )
  .addOption(
    new Option(
      "--models <models>",
      'Comma-separated model list to query in parallel (e.g., "google/gemini-3.1-pro-preview,x-ai/grok-4.1-fast").',
    )
      .argParser(collectModelList)
      .default([]),
  )
  .option(
    "--files-report",
    "Show token usage per attached file (also prints automatically when files exceed the token budget).",
    false,
  )
  .option("-v, --verbose", "Enable verbose logging for all operations.", false)
  .addOption(
    new Option(
      "--timeout <seconds|auto>",
      "Overall timeout before aborting the API call (auto = 60m for pro models, 120s otherwise).",
    )
      .argParser(parseTimeoutOption)
      .default("auto"),
  )
  .addOption(
    new Option(
      "--background",
      "Use Responses API background mode (create + retrieve) for API runs.",
    ).default(undefined),
  )
  .addOption(
    new Option("--no-background", "Disable Responses API background mode.").default(undefined),
  )
  .addOption(
    new Option("--http-timeout <ms|s|m|h>", "HTTP client timeout for API requests (default 20m).")
      .argParser((value) => parseDurationOption(value, "HTTP timeout"))
      .default(undefined),
  )
  .addOption(
    new Option(
      "--zombie-timeout <ms|s|m|h>",
      "Override stale-session cutoff used by `oracle status` (default 60m).",
    )
      .argParser((value) => parseDurationOption(value, "Zombie timeout"))
      .default(undefined),
  )
  .option(
    "--zombie-last-activity",
    "Base stale-session detection on last log activity instead of start time.",
    false,
  )
  .addOption(
    new Option(
      "--preview [mode]",
      "(alias) Preview the request without calling the model (summary | json | full). Deprecated: use --dry-run instead.",
    )
      .hideHelp()
      .choices(["summary", "json", "full"])
      .preset("summary"),
  )
  .addOption(
    new Option("--dry-run [mode]", "Preview without calling the model (summary | json | full).")
      .choices(["summary", "json", "full"])
      .preset("summary")
      .default(false),
  )
  .addOption(new Option("--exec-session <id>").hideHelp())
  .addOption(new Option("--session <id>").hideHelp())
  .addOption(
    new Option("--status", "Show stored sessions (alias for `oracle status`).")
      .default(false)
      .hideHelp(),
  )
  .option(
    "--render-markdown",
    "Print the assembled markdown bundle for prompt + files and exit.",
    false,
  )
  .option("--render", "Alias for --render-markdown.", false)
  .option(
    "--render-plain",
    "Render markdown without ANSI/highlighting (use plain text even in a TTY).",
    false,
  )
  .option(
    "--write-output <path>",
    "Write only the final assistant message to this file (overwrites; multi-model appends .<model> before the extension).",
  )
  .option("--verbose-render", "Show render/TTY diagnostics when replaying sessions.", false)
  .addOption(
    new Option("--search <mode>", "Set server-side search behavior (on/off).")
      .argParser(parseSearchOption)
      .hideHelp(),
  )
  .addOption(
    new Option("--max-input <tokens>", "Override the input token budget for the selected model.")
      .argParser(parseIntOption)
      .hideHelp(),
  )
  .addOption(
    new Option("--max-output <tokens>", "Override the max output tokens for the selected model.")
      .argParser(parseIntOption)
      .hideHelp(),
  )
  .option(
    "--base-url <url>",
    "Override the OpenAI-compatible base URL for API runs (e.g. LiteLLM proxy endpoint).",
  )
  .option(
    "--retain-hours <hours>",
    "Prune stored sessions older than this many hours before running (set 0 to disable).",
    parseFloatOption,
  )
  .option(
    "--force",
    "Force start a new session even if an identical prompt is already running.",
    false,
  )
  .option("--debug-help", "Show the advanced/debug option set and exit.", false)
  .option(
    "--heartbeat <seconds>",
    "Emit periodic in-progress updates (0 to disable).",
    parseHeartbeatOption,
    30,
  )
  .addOption(new Option("--wait").default(undefined))
  .addOption(new Option("--no-wait").default(undefined).hideHelp())
  .option("--json", "Output a single JSON object (for programmatic/agent use).", false)
  .showHelpAfterError("(use --help for usage)");

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
`,
);

const sessionCommand = program
  .command("session [id]")
  .description("Attach to a stored session or list recent sessions when no ID is provided.")
  .option(
    "--hours <hours>",
    "Look back this many hours when listing sessions (default 24).",
    parseFloatOption,
    24,
  )
  .option(
    "--limit <count>",
    "Maximum sessions to show when listing (max 1000).",
    parseIntOption,
    100,
  )
  .option("--all", "Include all stored sessions regardless of age.", false)
  .option("--clear", "Delete stored sessions older than the provided window (24h default).", false)
  .option("--hide-prompt", "Hide stored prompt when displaying a session.", false)
  .option("--render", "Render completed session output as markdown (rich TTY only).", false)
  .option("--render-markdown", "Alias for --render.", false)
  .option("--model <name>", "Filter sessions/output for a specific model.", "")
  .option("--path", "Print the stored session paths instead of attaching.", false)
  .addOption(new Option("--clean", "Deprecated alias for --clear.").default(false).hideHelp())
  .action(async (sessionId, _options: StatusOptions, cmd: Command) => {
    await handleSessionCommand(sessionId, cmd);
  });

const statusCommand = program
  .command("status [id]")
  .description(
    "List recent sessions (24h window by default) or attach to a session when an ID is provided.",
  )
  .option("--hours <hours>", "Look back this many hours (default 24).", parseFloatOption, 24)
  .option("--limit <count>", "Maximum sessions to show (max 1000).", parseIntOption, 100)
  .option("--all", "Include all stored sessions regardless of age.", false)
  .option("--clear", "Delete stored sessions older than the provided window (24h default).", false)
  .option("--render", "Render completed session output as markdown (rich TTY only).", false)
  .option("--render-markdown", "Alias for --render.", false)
  .option("--model <name>", "Filter sessions/output for a specific model.", "")
  .option("--hide-prompt", "Hide stored prompt when displaying a session.", false)
  .addOption(new Option("--clean", "Deprecated alias for --clear.").default(false).hideHelp())
  .action(async (sessionId: string | undefined, _options: StatusOptions, command: Command) => {
    const statusOptions = command.opts<StatusOptions>();
    const clearRequested = Boolean(statusOptions.clear || statusOptions.clean);
    if (clearRequested) {
      if (sessionId) {
        console.error(
          "Cannot combine a session ID with --clear. Remove the ID to delete cached sessions.",
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
        'Session cleanup now uses --clear. Run "oracle status --clear --hours <n>" instead.',
      );
      process.exitCode = 1;
      return;
    }
    if (sessionId) {
      const autoRender =
        !command.getOptionValueSource?.("render") &&
        !command.getOptionValueSource?.("renderMarkdown")
          ? process.stdout.isTTY
          : false;
      const renderMarkdown = Boolean(
        statusOptions.render || statusOptions.renderMarkdown || autoRender,
      );
      await attachSession(sessionId, { renderMarkdown, renderPrompt: !statusOptions.hidePrompt });
      return;
    }
    const showExamples = usesDefaultStatusFilters(command);
    await showStatus({
      hours: statusOptions.all ? Infinity : statusOptions.hours,
      includeAll: statusOptions.all,
      limit: statusOptions.limit,
      showExamples,
    });
  });

function buildRunOptions(
  options: ResolvedCliOptions,
  overrides: Partial<RunOracleOptions> = {},
): RunOracleOptions {
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
    timeoutSeconds: overrides.timeoutSeconds ?? (options.timeout as number | "auto" | undefined),
    httpTimeoutMs: overrides.httpTimeoutMs ?? options.httpTimeout,
    zombieTimeoutMs: overrides.zombieTimeoutMs ?? options.zombieTimeout,
    zombieUseLastActivity: overrides.zombieUseLastActivity ?? options.zombieLastActivity,
    silent: overrides.silent ?? options.silent,
    search: overrides.search ?? options.search,
    preview: overrides.preview ?? undefined,
    previewMode: overrides.previewMode ?? options.previewMode,
    apiKey: overrides.apiKey ?? options.apiKey,
    baseUrl: normalizedBaseUrl,
    sessionId: overrides.sessionId ?? options.sessionId,
    verbose: overrides.verbose ?? options.verbose,
    heartbeatIntervalMs:
      overrides.heartbeatIntervalMs ?? resolveHeartbeatIntervalMs(options.heartbeat),
    background: overrides.background ?? undefined,
    renderPlain: overrides.renderPlain ?? options.renderPlain ?? false,
    writeOutputPath: overrides.writeOutputPath ?? options.writeOutputPath,
  };
}

function resolveHeartbeatIntervalMs(seconds: number | undefined): number | undefined {
  if (typeof seconds !== "number" || seconds <= 0) {
    return undefined;
  }
  return Math.round(seconds * 1000);
}

function buildRunOptionsFromMetadata(metadata: SessionMetadata): RunOracleOptions {
  const stored = metadata.options ?? {};
  return {
    prompt: stored.prompt ?? "",
    model: (stored.model as ModelName) ?? DEFAULT_MODEL,
    models: stored.models as ModelName[] | undefined,
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
    previewMode: undefined,
    apiKey: undefined,
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
    writeOutputPath: stored.writeOutputPath,
  };
}

async function runRootCommand(options: CliOptions): Promise<void> {
  const defaultModels = await loadDefaultModels();
  const jsonOutput = Boolean(options.json);
  const helpRequested = rawCliArgs.some((arg: string) => arg === "--help" || arg === "-h");
  const optionUsesDefault = (name: string): boolean => {
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
    options.paths,
  );
  if (mergedFileInputs.length > 0) {
    const { deduped, duplicates } = dedupePathInputs(mergedFileInputs, { cwd: process.cwd() });
    if (duplicates.length > 0) {
      const preview = duplicates.slice(0, 8).join(", ");
      const suffix = duplicates.length > 8 ? ` (+${duplicates.length - 8} more)` : "";
      if (!jsonOutput)
        console.log(chalk.dim(`Ignoring duplicate --file inputs: ${preview}${suffix}`));
    }
    options.file = deduped;
  }
  const renderMarkdown = resolveRenderFlag(options.render, options.renderMarkdown);
  const renderPlain = resolveRenderPlain(
    options.renderPlain,
    options.render,
    options.renderMarkdown,
  );

  const applyRetentionOption = (): void => {
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
    console.log(chalk.yellow("No prompt or subcommand supplied. Run `oracle --help` for usage."));
    program.outputHelp();
    return;
  }
  const retentionHours = typeof options.retainHours === "number" ? options.retainHours : undefined;
  await sessionStore.ensureStorage();
  await pruneOldSessions(
    retentionHours,
    jsonOutput ? () => {} : (message) => console.log(chalk.dim(message)),
  );

  if (options.debugHelp) {
    printDebugHelp(program.name());
    return;
  }
  if (options.dryRun && options.renderMarkdown) {
    throw new Error("--dry-run cannot be combined with --render-markdown.");
  }

  const engine = "api" as const;

  // Priority: CLI --models > CLI --model > MODELS.md defaults > DEFAULT_MODEL
  const cliModelsExplicit = !optionUsesDefault("models");
  const cliModelExplicit = !optionUsesDefault("model");
  if (cliModelsExplicit && cliModelExplicit) {
    throw new Error("--models cannot be combined with --model.");
  }
  if (!cliModelsExplicit && !cliModelExplicit && defaultModels.length > 0) {
    options.models = defaultModels;
  }
  const multiModelProvided = Array.isArray(options.models) && options.models.length > 0;

  const normalizedMultiModels: ModelName[] = multiModelProvided
    ? Array.from(new Set(options.models!.map((entry) => resolveApiModel(entry))))
    : [];
  const cliModelArg =
    normalizeModelOption(options.model) || (multiModelProvided ? "" : DEFAULT_MODEL);
  const resolvedModelCandidate: ModelName = multiModelProvided
    ? normalizedMultiModels[0]
    : resolveApiModel(cliModelArg || DEFAULT_MODEL);
  const resolvedModel: ModelName = normalizedMultiModels[0] ?? resolvedModelCandidate;
  const effectiveModelId = resolveEffectiveModelId(resolvedModel);
  const resolvedBaseUrl = normalizeBaseUrl(options.baseUrl ?? process.env.OPENAI_BASE_URL);
  const { models: _rawModels, ...optionsWithoutModels } = options;
  const resolvedOptions: ResolvedCliOptions = { ...optionsWithoutModels, model: resolvedModel };
  if (normalizedMultiModels.length > 0) {
    resolvedOptions.models = normalizedMultiModels;
  }
  resolvedOptions.baseUrl = resolvedBaseUrl;
  resolvedOptions.effectiveModelId = effectiveModelId;
  resolvedOptions.writeOutputPath = resolveOutputPath(options.writeOutput, process.cwd());

  if (jsonOutput) options.heartbeat = 0;

  // Decide whether to block until completion:
  // - explicit --wait / --no-wait wins
  // - otherwise block for fast models (gpt-5.1) and detach by default for pro API runs
  // - JSON mode always runs inline (no detach)
  const waitPreference = jsonOutput
    ? true
    : resolveWaitFlag({
        waitFlag: options.wait,
        model: resolvedModel,
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
      { cwd: process.cwd() },
    );
    const modelConfig = isKnownModel(resolvedModel)
      ? MODEL_CONFIGS[resolvedModel]
      : MODEL_CONFIGS["gpt-5.1"];
    const requestBody = buildRequestBody({
      modelConfig,
      systemPrompt: bundle.systemPrompt,
      userPrompt: bundle.promptWithFiles,
      searchEnabled: options.search !== false,
      background: false,
      storeResponse: false,
    });
    const estimatedTokens = estimateRequestTokens(requestBody, modelConfig);
    const warnThreshold = Math.min(196_000, modelConfig.inputLimit ?? 196_000);
    warnIfOversizeBundle(estimatedTokens, warnThreshold, console.log);
    const output = renderPlain
      ? bundle.markdown
      : await formatRenderedMarkdown(bundle.markdown, { richTty: isTty });
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
      baseUrl: resolvedBaseUrl,
    });
    await runDryRunSummary(
      {
        runOptions,
        cwd: process.cwd(),
        version: VERSION,
        log: console.log,
      },
      {},
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
    log: jsonOutput ? () => {} : console.log,
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
    previewMode: undefined,
    background: resolvedOptions.background,
    baseUrl: resolvedBaseUrl,
  });
  const sessionMeta = await sessionStore.createSession(
    {
      ...baseRunOptions,
      mode: "api" as const,
      waitPreference,
    },
    process.cwd(),
  );
  const liveRunOptions: RunOracleOptions = {
    ...baseRunOptions,
    sessionId: sessionMeta.id,
    effectiveModelId,
  };
  const disableDetachEnv = process.env.ORACLE_NO_DETACH === "1";
  const detachAllowed = shouldDetachSession({
    engine,
    model: resolvedModel,
    waitPreference,
    disableDetachEnv,
  });
  const detached = !detachAllowed
    ? false
    : await launchDetachedSession(sessionMeta.id).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.log(
          chalk.yellow(`Unable to detach session runner (${message}). Running inline...`),
        );
        return false;
      });

  if (!waitPreference) {
    if (!detached) {
      console.log(chalk.red("Unable to start in background; use --wait to run inline."));
      process.exitCode = 1;
      return;
    }
    console.log(
      chalk.blue(`Session running in background. Reattach via: oracle session ${sessionMeta.id}`),
    );
    console.log(
      chalk.dim("Pro runs can take up to 60 minutes (usually 10-15). Add --wait to stay attached."),
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
      jsonOutput,
    );
    return;
  }
  if (detached) {
    console.log(chalk.blue(`Reattach via: oracle session ${sessionMeta.id}`));
    await attachSession(sessionMeta.id, { suppressMetadata: true });
  }
}

async function runInteractiveSession(
  sessionMeta: SessionMetadata,
  runOptions: RunOracleOptions,
  showReattachHint = true,
  suppressSummary = false,
  cwd: string = process.cwd(),
  jsonOutput = false,
): Promise<void> {
  const { logLine, writeChunk, stream } = sessionStore.createLogWriter(sessionMeta.id);
  let headerAugmented = false;
  const combinedLog = (message = ""): void => {
    if (jsonOutput) {
      logLine(message);
      return;
    }
    if (!headerAugmented && message.startsWith("oracle (")) {
      headerAugmented = true;
      if (showReattachHint) {
        console.log(`${message}\n${chalk.blue(`Reattach via: oracle session ${sessionMeta.id}`)}`);
      } else {
        console.log(message);
      }
      logLine(message);
      return;
    }
    console.log(message);
    logLine(message);
  };
  const combinedWrite = (chunk: string): boolean => {
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
      muteStdout: jsonOutput,
    });
    if (jsonOutput && result) {
      const json =
        result.answers.length === 1
          ? { model: result.answers[0].model, output: result.answers[0].text }
          : { responses: result.answers.map((a) => ({ model: a.model, output: a.text })) };
      process.stdout.write(JSON.stringify(json) + "\n");
    }
    const latest = await sessionStore.readSession(sessionMeta.id);
    if (!suppressSummary && !jsonOutput) {
      const summary = latest ? formatCompletionSummary(latest, { includeSlug: true }) : null;
      if (summary) {
        console.log("\n" + chalk.green.bold(summary));
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

async function launchDetachedSession(sessionId: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    try {
      const args = ["--", CLI_ENTRYPOINT, "--exec-session", sessionId];
      const child = spawn(process.execPath, args, {
        detached: true,
        stdio: "ignore",
        env: process.env,
      });
      child.once("error", reject);
      child.once("spawn", () => {
        child.unref();
        resolve(true);
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function executeSession(sessionId: string) {
  const metadata = await sessionStore.readSession(sessionId);
  if (!metadata) {
    console.error(chalk.red(`No session found with ID ${sessionId}`));
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
      version: VERSION,
    });
  } catch {
    // Errors are already logged to the session log; keep quiet to mirror stored-session behavior.
  } finally {
    stream.end();
  }
}

function printDebugHelp(cliName: string): void {
  console.log(chalk.bold("Advanced Options"));
  printDebugOptionGroup([
    ["--search <on|off>", "Enable or disable the server-side search tool (default on)."],
    ["--max-input <tokens>", "Override the input token budget."],
    ["--max-output <tokens>", "Override the max output tokens (model default otherwise)."],
  ]);
  console.log("");
  console.log(chalk.dim(`Tip: run \`${cliName} --help\` to see the primary option set.`));
}

function printDebugOptionGroup(entries: Array<[string, string]>): void {
  const flagWidth = Math.max(...entries.map(([flag]) => flag.length));
  entries.forEach(([flag, description]) => {
    const label = chalk.cyan(flag.padEnd(flagWidth + 2));
    console.log(`  ${label}${description}`);
  });
}

function resolveWaitFlag({ waitFlag, model }: { waitFlag?: boolean; model: ModelName }): boolean {
  if (waitFlag === true) return true;
  if (waitFlag === false) return false;
  // Pro models default to detached (false), others wait inline (true)
  return !isProModel(model);
}

program.action(async function (this: Command) {
  const options = this.optsWithGlobals() as CliOptions;
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

async function main(): Promise<void> {
  const parsePromise = program.parseAsync(normalizedArgv);
  const sigintPromise = once(process, "SIGINT").then(() => "sigint" as const);
  const result = await Promise.race([parsePromise.then(() => "parsed" as const), sigintPromise]);
  if (result === "sigint") {
    console.log(chalk.yellow("\nCancelled."));
    process.exitCode = 130;
  }
}

void main().catch((error: unknown) => {
  if (error instanceof Error) {
    if (!isErrorLogged(error)) {
      console.error(chalk.red("✖"), error.message);
    }
  } else {
    console.error(chalk.red("✖"), error);
  }
  process.exitCode = 1;
});
