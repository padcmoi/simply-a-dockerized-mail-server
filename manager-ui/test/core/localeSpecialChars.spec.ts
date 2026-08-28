import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// vue-i18n reads `@` as the start of a linked message and `|` as a plural
// separator. A message carrying either raw does not degrade: the compiler
// throws at render time and takes the whole subtree with it, which is how a
// page ends up showing its counters and nothing else.
//
// The escape is `{'@'}`. This test walks every locale file so the trap is
// caught here rather than on screen.
const LOCALES_DIR = join(__dirname, "..", "..", "i18n", "locales");

function localeFiles(): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(LOCALES_DIR, { withFileTypes: true })) {
    const path = join(LOCALES_DIR, entry.name);
    if (entry.isDirectory()) {
      for (const file of readdirSync(path)) if (file.endsWith(".ts")) files.push(join(path, file));
    } else if (entry.name.endsWith(".ts")) files.push(path);
  }
  return files;
}

// Only the message strings matter: an import path or a comment carrying an `@`
// is not compiled by vue-i18n.
function messageLines(source: string): { line: string; number: number }[] {
  return source
    .split("\n")
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("import ")) return false;
      return /:\s*["'`]/.test(line) || /^\s*["'`]/.test(line);
    });
}

describe("locale messages stay compilable by vue-i18n", () => {
  const files = localeFiles();

  it("finds the locale files at all", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("carries no unescaped @, which vue-i18n reads as a linked message", () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const { line, number } of messageLines(readFileSync(file, "utf8"))) {
        // `{'@'}` is the escape; a URL scheme has no @ either side.
        const stripped = line.replace(/\{'@'\}/g, "");
        if (stripped.includes("@")) offenders.push(`${file.replace(LOCALES_DIR, "")}:${number} ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
