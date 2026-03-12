import chalk from "chalk";
import { MODEL_CONFIGS, TOKENIZER_OPTIONS, DEFAULT_SYSTEM_PROMPT, buildPrompt, readFiles, getFileTokenStats, printFileTokenStats, } from "../oracle.js";
import { isKnownModel } from "../oracle/modelResolver.js";
export async function runDryRunSummary({ runOptions, cwd, version, log, }, deps = {}) {
    await runApiDryRun({ runOptions, cwd, version, log }, deps);
}
async function runApiDryRun({ runOptions, cwd, version, log, }, deps) {
    const readFilesImpl = deps.readFilesImpl ?? readFiles;
    const files = await readFilesImpl(runOptions.file ?? [], { cwd });
    const systemPrompt = runOptions.system?.trim() || DEFAULT_SYSTEM_PROMPT;
    const combinedPrompt = buildPrompt(runOptions.prompt ?? "", files, cwd);
    const modelConfig = isKnownModel(runOptions.model)
        ? MODEL_CONFIGS[runOptions.model]
        : MODEL_CONFIGS["gpt-5.1"];
    const tokenizer = modelConfig.tokenizer;
    const estimatedInputTokens = tokenizer([
        { role: "system", content: systemPrompt },
        { role: "user", content: combinedPrompt },
    ], TOKENIZER_OPTIONS);
    const modelLabel = runOptions.models?.length ? runOptions.models.join(", ") : runOptions.model;
    const headerLine = `[dry-run] Oracle (${version}) would call ${modelLabel} with ~${estimatedInputTokens.toLocaleString()} tokens and ${files.length} files.`;
    log(chalk.cyan(headerLine));
    if (files.length === 0) {
        log(chalk.dim("[dry-run] No files matched the provided --file patterns."));
        return;
    }
    const inputBudget = runOptions.maxInput ?? modelConfig.inputLimit;
    const stats = getFileTokenStats(files, {
        cwd,
        tokenizer,
        tokenizerOptions: TOKENIZER_OPTIONS,
        inputTokenBudget: inputBudget,
    });
    printFileTokenStats(stats, { inputTokenBudget: inputBudget, log });
}
