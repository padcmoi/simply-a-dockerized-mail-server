// The reply editor emits markdown, and a message must display formatted rather
// than showing its own syntax. Rendering it through v-html would mean trusting
// text typed by a stranger, so instead the source is parsed here into a plain
// description of what to draw, which the renderer turns into vnodes. Markup
// found in a message therefore never becomes markup: it stays the text it is.
export type InlineNode =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "em"; children: InlineNode[] }
  | { type: "strike"; children: InlineNode[] }
  | { type: "link"; href: string; children: InlineNode[] }
  | { type: "break" };

export type BlockNode =
  | { type: "paragraph"; children: InlineNode[] }
  | { type: "heading"; level: number; children: InlineNode[] }
  | { type: "quote"; blocks: BlockNode[] }
  | { type: "list"; ordered: boolean; items: InlineNode[][] }
  | { type: "codeBlock"; value: string }
  | { type: "rule" };

const FENCE = /^\s*```/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;

// Only schemes that cannot execute anything. Everything else, `javascript:`
// first among them, loses its link and stays visible as plain text.
const SAFE_SCHEME = /^(?:https?:\/\/|mailto:|\/)/i;

function hasControlChar(value: string) {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20) return true;
  }
  return false;
}

export function safeHref(raw: string) {
  const href = raw.trim();
  // Whitespace, quotes and angle brackets would let an href break out of the
  // attribute; control characters are how a blocked scheme gets smuggled in.
  if (!href || /\s/.test(href) || /["'<>]/.test(href) || hasControlChar(href)) return null;
  return SAFE_SCHEME.test(href) ? href : null;
}

const INLINE = [
  { type: "code", re: /^`([^`]+)`/ },
  { type: "strong", re: /^\*\*([\s\S]+?)\*\*/ },
  { type: "strong", re: /^__([\s\S]+?)__/ },
  { type: "strike", re: /^~~([\s\S]+?)~~/ },
  { type: "em", re: /^\*([^*\n]+)\*/ },
  { type: "em", re: /^_([^_\n]+)_/ },
  { type: "link", re: /^\[([^\]]*)\]\(([^)\s]+)\)/ },
] as const;

export function parseInline(source: string) {
  const out: InlineNode[] = [];
  let buffer = "";
  let rest = source;

  function flush() {
    if (buffer) {
      out.push({ type: "text", value: buffer });
      buffer = "";
    }
  }

  while (rest.length) {
    if (rest[0] === "\n") {
      flush();
      out.push({ type: "break" });
      rest = rest.slice(1);
      continue;
    }

    let matched = false;
    for (const rule of INLINE) {
      const m = rule.re.exec(rest);
      if (!m) continue;

      if (rule.type === "link") {
        const href = safeHref(m[2] ?? "");
        // A refused scheme must not silently vanish: keep the raw markdown so
        // nothing is hidden from the reader.
        if (!href) break;
        flush();
        out.push({ type: "link", href, children: parseInline(m[1] ?? "") });
      } else if (rule.type === "code") {
        flush();
        out.push({ type: "code", value: m[1] ?? "" });
      } else {
        flush();
        out.push({ type: rule.type, children: parseInline(m[1] ?? "") });
      }

      rest = rest.slice(m[0].length);
      matched = true;
      break;
    }

    if (!matched) {
      buffer += rest[0];
      rest = rest.slice(1);
    }
  }

  flush();
  return out;
}

export function parseBlocks(source: string) {
  const lines = (source ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: BlockNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (FENCE.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i] ?? "")) {
        body.push(lines[i] ?? "");
        i++;
      }
      i++;
      blocks.push({ type: "codeBlock", value: body.join("\n") });
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ type: "rule" });
      i++;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1]?.length ?? 1, children: parseInline(heading[2] ?? "") });
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i] ?? "")) {
        quoted.push(QUOTE.exec(lines[i] ?? "")?.[1] ?? "");
        i++;
      }
      blocks.push({ type: "quote", blocks: parseBlocks(quoted.join("\n")) });
      continue;
    }

    const ordered = ORDERED.test(line);
    if (ordered || BULLET.test(line)) {
      const items: InlineNode[][] = [];
      const re = ordered ? ORDERED : BULLET;
      while (i < lines.length && re.test(lines[i] ?? "")) {
        items.push(parseInline(re.exec(lines[i] ?? "")?.[1] ?? ""));
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length) {
      const current = lines[i] ?? "";
      if (
        !current.trim() ||
        FENCE.test(current) ||
        RULE.test(current) ||
        HEADING.test(current) ||
        QUOTE.test(current) ||
        BULLET.test(current) ||
        ORDERED.test(current)
      ) {
        break;
      }
      paragraph.push(current);
      i++;
    }
    blocks.push({ type: "paragraph", children: parseInline(paragraph.join("\n")) });
  }

  return blocks;
}
