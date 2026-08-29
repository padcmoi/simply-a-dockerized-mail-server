import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// The deliverability checks live in the probe image, one directory per tested
// element, and the wording lives here. Adding a directory is all it takes to add
// a check, which is the point of that layout and also its one hazard: a check
// nobody translated shows a raw i18n key on screen.
//
// So this reads the two sides and compares them. It cannot be satisfied by a
// mock, because both sides are files on disk.
const PROBE_DIR = join(__dirname, "..", "..", "..", "images", "deliverability-probe");
const LOCALES = ["en_GB", "fr_FR"];

// Two ids the probe emits from inside another check's directory, and two the
// manager adds from its own database. Neither has a directory of its own, and
// both still need a label.
const EXTRA_IDS = ["dkim-selector-known", "mta-sts-policy", "tls-certificate-expiry", "role-postmaster", "role-abuse"];

function probeIds(): string[] {
  const ids: string[] = [];
  for (const entry of readdirSync(PROBE_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    let source: string;
    try {
      source = readFileSync(join(PROBE_DIR, entry.name, "check.py"), "utf8");
    } catch {
      continue;
    }
    const declared = /^ID\s*=\s*"([^"]+)"/m.exec(source);
    expect(declared, `${entry.name}/check.py declares no ID`).not.toBeNull();
    ids.push(declared![1]!);
  }
  return [...ids, ...EXTRA_IDS];
}

function locale(name: string): string {
  return readFileSync(join(__dirname, "..", "..", "i18n", "locales", name, "deliverability.ts"), "utf8");
}

// A key is written either quoted or bare, depending on whether it holds a dash.
function declares(source: string, section: string, id: string): boolean {
  const block = source.split(`${section}: {`)[1] ?? "";
  const body = block.split("\n  },")[0] ?? "";
  return new RegExp(`^\\s*(?:"${id}"|${id}):`, "m").test(body);
}

describe("deliverability wording follows the probe", () => {
  it("finds the checks where they live, one directory each", () => {
    const ids = probeIds();
    expect(ids.length).toBeGreaterThan(25);
    expect(ids).toContain("open-relay");
  });

  for (const name of LOCALES) {
    it(`${name} names every check the probe can emit`, () => {
      const source = locale(name);
      const missing = probeIds().filter((id) => !declares(source, "checks", id));
      expect(missing, `no label for ${missing.join(", ")}`).toEqual([]);
    });

    // The hint is what the page shows under a check that is not green, so a
    // check with no hint is a red row that says what is wrong and not what to do.
    it(`${name} tells what to do about every check`, () => {
      const source = locale(name);
      const missing = probeIds().filter((id) => !declares(source, "hints", id));
      expect(missing, `no hint for ${missing.join(", ")}`).toEqual([]);
    });
  }
});
