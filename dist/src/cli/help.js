import kleur from "kleur";
const createColorWrapper = (isTty) => (styler) => (text) => isTty ? styler(text) : text;
export function applyHelpStyling(program, version, isTty) {
    const wrap = createColorWrapper(isTty);
    const colors = {
        banner: wrap((text) => kleur.bold().blue(text)),
        subtitle: wrap((text) => kleur.dim(text)),
        section: wrap((text) => kleur.bold().white(text)),
        bullet: wrap((text) => kleur.blue(text)),
        command: wrap((text) => kleur.bold().blue(text)),
        option: wrap((text) => kleur.cyan(text)),
        argument: wrap((text) => kleur.magenta(text)),
        description: wrap((text) => kleur.white(text)),
        muted: wrap((text) => kleur.gray(text)),
        accent: wrap((text) => kleur.cyan(text)),
    };
    program.configureHelp({
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
        },
    });
    program.addHelpText("beforeAll", () => renderHelpBanner(version, colors));
    program.addHelpText("after", () => renderHelpFooter(program, colors));
}
function renderHelpBanner(version, colors) {
    const dash = "\u2014";
    const arrow = "\u2192";
    const subtitle = `Prompt + files ${arrow} multi-model LLM answers with full context.`;
    return `${colors.banner(`Oracle CLI v${version}`)} ${colors.subtitle(`${dash} ${subtitle}`)}\n`;
}
function renderHelpFooter(program, colors) {
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
        `${colors.bullet(bullet)} Hidden flags: run ${colors.accent(`${program.name()} --help --verbose`)} to list search/token overrides.`,
        `${colors.bullet(bullet)} Use ${colors.accent("-P/--prompt-file")} for complex prompts to avoid shell escaping.`,
        `${colors.bullet(bullet)} Native API keys (GEMINI_API_KEY, XAI_API_KEY) used when available; OPENROUTER_API_KEY as primary fallback.`,
    ].join("\n");
    const formatExample = (command, description) => `${colors.command(`  ${command}`)}\n${colors.muted(`    ${description}`)}`;
    const examples = [
        formatExample(`${program.name()} -p "Summarize the risk register" --file docs/risk-register.md`, "Quick single-model run with the default model."),
        formatExample(`${program.name()} --models "google/gemini-3.1-pro-preview,x-ai/grok-4.1-fast" -p "Cross-check assumptions" --file "src/**/*.ts"`, `Multi-model run ${dash} query two models in parallel.`),
        formatExample(`${program.name()} --dry-run -p "Check release notes" --file docs/CHANGELOG.md`, "Preview token usage without calling the API."),
        formatExample(`${program.name()} session <id>`, "Reattach to a running or completed session."),
    ].join("\n\n");
    return `
${colors.section("Tips")}
${tips}

${colors.section("Examples")}
${examples}
`;
}
