// markdown.js - Lightweight, self-contained, safe Markdown renderer with Code Highlighting & Copy support

export function renderMarkdown(markdownText) {
  if (!markdownText) return "";

  let text = String(markdownText);

  // 1. Extract and preserve Code Blocks
  const codeBlocks = [];
  text = text.replace(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g, (match, lang, code) => {
    const placeholder = `\uE000CODEBLOCK${codeBlocks.length}\uE000`;
    codeBlocks.push({ lang: lang ? lang.trim() : "code", code: code.trim() });
    return placeholder;
  });

  // 2. Extract and preserve Inline Code
  const inlineCodes = [];
  text = text.replace(/`([^`\n]+)`/g, (match, code) => {
    const placeholder = `\uE000INLINECODE${inlineCodes.length}\uE000`;
    inlineCodes.push(code);
    return placeholder;
  });

  // 3. Escape HTML special characters for security
  text = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 4. Horizontal Rules
  text = text.replace(/^(?:---|\*\*\*|___)\s*$/gm, "<hr />");

  // 5. Headings (# h1 through ###### h6)
  text = text.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
  text = text.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
  text = text.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
  text = text.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  text = text.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  text = text.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

  // 6. Blockquotes
  text = text.replace(/^(?:&gt;|>)\s+(.+)$/gm, "<blockquote>$1</blockquote>");
  text = text.replace(/<\/blockquote>\n<blockquote>/g, "<br/>");

  // 7. Tables
  text = renderTables(text);

  // 8. Lists (Unordered & Ordered)
  text = text.replace(/^(\s*)[-*+]\s+(.+)$/gm, (match, indent, content) => {
    return `<li>${content}</li>`;
  });
  text = text.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (match) => {
    return `<ul>\n${match}</ul>\n`;
  });

  text = text.replace(/^(\s*)\d+\.\s+(.+)$/gm, (match, indent, content) => {
    return `<oli>${content}</oli>`;
  });
  text = text.replace(/(<oli>[\s\S]*?<\/oli>\n?)+/g, (match) => {
    const converted = match.replace(/<\/?oli>/g, (m) => (m === "<oli>" ? "<li>" : "</li>"));
    return `<ol>\n${converted}</ol>\n`;
  });

  // 9. Bold & Italic
  text = text.replace(/\*\*\*([^\*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  text = text.replace(/___([^_]+)___/g, "<strong><em>$1</em></strong>");

  text = text.replace(/\*\*([^\*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");

  text = text.replace(/\*([^\*]+)\*/g, "<em>$1</em>");
  text = text.replace(/_([^_]+)_/g, "<em>$1</em>");

  text = text.replace(/~~([^~]+)~~/g, "<del>$1</del>");

  // 10. Links [text](url)
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // 11. Paragraphs
  const paragraphs = text.split(/\n\s*\n/);
  text = paragraphs
    .map((p) => {
      p = p.trim();
      if (!p) return "";
      if (
        p.startsWith("<h") ||
        p.startsWith("<ul") ||
        p.startsWith("<ol") ||
        p.startsWith("<blockquote") ||
        p.startsWith("<hr") ||
        p.startsWith("<table") ||
        p.startsWith("<div class=\"table-wrapper\"") ||
        p.includes("\uE000CODEBLOCK")
      ) {
        return p;
      }
      return `<p>${p.replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n");

  // 12. Restore Inline Code
  text = text.replace(/\uE000INLINECODE(\d+)\uE000/g, (match, id) => {
    const raw = inlineCodes[parseInt(id, 10)] || "";
    const safeCode = raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<code class="inline-code">${safeCode}</code>`;
  });

  // 13. Restore Code Blocks
  text = text.replace(/\uE000CODEBLOCK(\d+)\uE000/g, (match, id) => {
    const item = codeBlocks[parseInt(id, 10)];
    if (!item) return "";
    const safeCode = item.code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const lang = item.lang || "code";

    return `
<div class="code-card">
  <div class="code-header">
    <span class="code-lang">${lang}</span>
    <button class="copy-btn" data-code="${encodeURIComponent(item.code)}">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span>Copy</span>
    </button>
  </div>
  <pre><code class="language-${lang}">${safeCode}</code></pre>
</div>`.trim();
  });

  return text;
}

function renderTables(text) {
  const tableRegex = /((?:\|[^\n]+\|\r?\n)+)/g;
  return text.replace(tableRegex, (match) => {
    const lines = match.trim().split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return match;

    if (!lines[1].match(/^\|[\s:?-]+\|/)) {
      return match;
    }

    const headerCells = lines[0]
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    const headerHtml = `<thead><tr>${headerCells.map((c) => `<th>${c}</th>`).join("")}</tr></thead>`;

    const bodyRows = lines.slice(2).map((line) => {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      return `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
    });
    const bodyHtml = `<tbody>${bodyRows.join("")}</tbody>`;

    return `<div class="table-wrapper"><table class="markdown-table">${headerHtml}${bodyHtml}</table></div>`;
  });
}
