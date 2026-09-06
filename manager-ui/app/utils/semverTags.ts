// The tags of one major line, newest first, ordered by what they name rather
// than by when they were pushed: GitHub's tag list carries no date, and a tag
// pushed late for an old version would otherwise come out on top. "2.0.0"
// outranks "2.0.0-rc.3", which outranks "2.0.0-rc.2", as semver says.
interface ParsedTag {
  name: string;
  core: number[];
  prerelease: string[];
}

export function parseTag(name: string) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(name.trim());
  if (!match) return null;
  const parsed: ParsedTag = {
    name,
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ? match[4].split(".") : [],
  };
  return parsed;
}

export function majorOf(name: string | null | undefined) {
  const parsed = name ? parseTag(name) : null;
  return parsed ? (parsed.core[0] ?? null) : null;
}

function compareIdentifiers(a: string, b: string) {
  const na = /^\d+$/.test(a);
  const nb = /^\d+$/.test(b);
  if (na && nb) return Number(a) - Number(b);
  if (na) return -1;
  if (nb) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

// Positive when `a` is the newer version.
export function compareTags(a: ParsedTag, b: ParsedTag) {
  for (let i = 0; i < 3; i++) {
    const diff = (a.core[i] ?? 0) - (b.core[i] ?? 0);
    if (diff !== 0) return diff;
  }
  if (a.prerelease.length === 0 || b.prerelease.length === 0) return b.prerelease.length - a.prerelease.length;
  const length = Math.min(a.prerelease.length, b.prerelease.length);
  for (let i = 0; i < length; i++) {
    const diff = compareIdentifiers(a.prerelease[i] ?? "", b.prerelease[i] ?? "");
    if (diff !== 0) return diff;
  }
  return a.prerelease.length - b.prerelease.length;
}

function parseAll(names: string[]) {
  return names.flatMap((name) => {
    const tag = parseTag(name);
    return tag ? [tag] : [];
  });
}

export function tagsOfMajor(names: string[], major: number) {
  return parseAll(names)
    .filter((tag) => tag.core[0] === major)
    .sort((a, b) => compareTags(b, a))
    .map((tag) => tag.name);
}

// The line to list when the server's own version names none: the newest one
// there is.
export function newestMajor(names: string[]) {
  const newest = parseAll(names).sort((a, b) => compareTags(b, a))[0];
  return newest?.core[0] ?? null;
}
