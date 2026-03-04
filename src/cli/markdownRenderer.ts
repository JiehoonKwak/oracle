import { render as renderMarkdown } from 'markdansi';

export function renderMarkdownAnsi(markdown: string): string {
  try {
    const color = Boolean(process.stdout.isTTY);
    const width = process.stdout.columns;
    const hyperlinks = color;
    return renderMarkdown(markdown, {
      color,
      width,
      wrap: true,
      hyperlinks,
    });
  } catch {
    return markdown;
  }
}

/** @deprecated No longer needed — kept for backward compatibility. */
export async function ensureShikiReady(): Promise<void> {}
