import { describe, it, expect } from "vitest";
import { buildQuote, quotePreview } from "~/utils/quoteMessage";

describe("quotePreview", () => {
  it("keeps a short message whole", () => {
    expect(quotePreview("hello")).toEqual(["hello"]);
  });

  it("keeps at most three lines and marks the cut", () => {
    expect(quotePreview("a\nb\nc\nd")).toEqual(["a", "b", "c", "…"]);
  });

  it("does not mark a cut when the message ends at three lines", () => {
    expect(quotePreview("a\nb\nc")).toEqual(["a", "b", "c"]);
  });

  it("shortens a very long line", () => {
    const [line] = quotePreview("x".repeat(300));
    expect(line).toHaveLength(121);
    expect(line?.endsWith("…")).toBe(true);
  });

  it("drops blank lines rather than spending a line on them", () => {
    expect(quotePreview("a\n\n\nb")).toEqual(["a", "b"]);
  });

  it("never throws on an empty message", () => {
    expect(quotePreview("")).toEqual([]);
  });
});

describe("buildQuote", () => {
  it("writes a blockquote naming the author, ending on a blank line", () => {
    expect(buildQuote("padcmoi", "kkkkk")).toBe("> _padcmoi:_\n> kkkkk\n\n");
  });

  it("quotes every kept line, ellipsis included", () => {
    expect(buildQuote("bob", "a\nb\nc\nd")).toBe("> _bob:_\n> a\n> b\n> c\n> …\n\n");
  });
});
