import { renderMarkdownAnsi } from "./markdownRenderer.js";

interface RenderOptions {
  richTty?: boolean;
}

export function shouldRenderRich(options: RenderOptions = {}): boolean {
  return options.richTty ?? Boolean(process.stdout.isTTY);
}

/**
 * Format markdown for CLI output. Uses our ANSI renderer + syntax highlighting
 * when running in a rich TTY; otherwise returns the raw markdown to avoid
 * escape codes in redirected output.
 */
export async function formatRenderedMarkdown(
  markdown: string,
  options: RenderOptions = {},
): Promise<string> {
  const richTty = shouldRenderRich(options);
  if (!richTty) return markdown;

  try {
    return renderMarkdownAnsi(markdown);
  } catch {
    return markdown;
  }
}
