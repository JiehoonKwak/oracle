import { render as renderMarkdown } from "markdansi";
export function renderMarkdownAnsi(markdown) {
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
    }
    catch {
        return markdown;
    }
}
