import type { DmarcRuaTarget } from "./dmarc.types";

const UNITS: Record<string, number> = { "": 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3, t: 1024 ** 4 };

export function parseRua(uri: string): DmarcRuaTarget | null {
  const trimmed = uri.trim();
  if (!/^mailto:/i.test(trimmed)) return null;

  const [target = "", limit] = trimmed.slice("mailto:".length).split("!");
  let address: string;
  try {
    address = decodeURIComponent(target).trim().toLowerCase();
  } catch {
    return null;
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) return null;

  let maxBytes: number | null = null;
  const size = limit
    ?.trim()
    .toLowerCase()
    .match(/^(\d+)([kmgt]?)$/);
  if (size) maxBytes = Number(size[1]) * (UNITS[size[2] ?? ""] ?? 1);

  return { address, maxBytes };
}

export function ruaTargets(uris: string[]): DmarcRuaTarget[] {
  const byAddress = new Map<string, DmarcRuaTarget>();
  for (const uri of uris.flatMap((value) => value.split(","))) {
    const target = parseRua(uri);
    if (target && !byAddress.has(target.address)) byAddress.set(target.address, target);
  }
  return [...byAddress.values()];
}

export function domainOf(address: string): string {
  return address.slice(address.lastIndexOf("@") + 1).toLowerCase();
}
