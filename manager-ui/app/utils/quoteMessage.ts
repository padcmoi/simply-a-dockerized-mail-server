const MAX_LINES = 3;
const MAX_CHARS = 120;

// A quote is meant to point at a message, not to reproduce it: three lines at
// most, each kept short, with an ellipsis whenever something was left out.
export function quotePreview(body: string) {
  const lines = (body ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const kept = lines.slice(0, MAX_LINES).map((line) => (line.length > MAX_CHARS ? `${line.slice(0, MAX_CHARS)}…` : line));
  if (lines.length > MAX_LINES) kept.push("…");
  return kept;
}

// Markdown the editor understands: a blockquote holding the author and the
// excerpt, then a blank line so the caret lands under it, outside the quote.
export function buildQuote(author: string, body: string) {
  const lines = quotePreview(body);
  const quoted = [`_${author}:_`, ...lines].map((line) => `> ${line}`).join("\n");
  return `${quoted}\n\n`;
}
