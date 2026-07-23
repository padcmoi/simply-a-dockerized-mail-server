import { describe, it, expect } from "vitest";
import { parseBlocks, type BlockNode } from "~/utils/messageMarkdown";

function kind(block: BlockNode | undefined) {
  if (!block) return "empty";
  return block.type === "paragraph" ? (block.children[0]?.type ?? "empty") : block.type;
}

describe("every toolbar capability renders", () => {
  it.each([
    ["bold", "**x**", "strong"],
    ["italic", "*x*", "em"],
    ["italic underscore", "_x_", "em"],
    ["strike", "~~x~~", "strike"],
    ["inline code", "`x`", "code"],
    ["bold+italic", "***x***", "strong"],
    ["bold+strike", "**~~x~~**", "strong"],
    ["bullet list", "- a\n- b", "list"],
    ["ordered list", "1. a\n2. b", "list"],
    ["quote", "> x", "quote"],
    ["code block", "```\nx\n```", "codeBlock"],
    ["link", "[t](https://a.io)", "link"],
    ["rule", "---", "rule"],
    ["heading", "## t", "heading"],
  ])("%s", (_label, source, expected) => {
    expect(kind(parseBlocks(source)[0])).toBe(expected);
  });
});
