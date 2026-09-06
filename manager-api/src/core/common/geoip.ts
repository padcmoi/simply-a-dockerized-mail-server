import { Logger } from "@nestjs/common";

interface GeoipDataset {
  lookup(ip: string): Promise<{ country?: string; ll?: [number, number]; area?: number } | null>;
}

// Where an address sits, as the dataset believes, with the radius it admits to
// being sure to within. That radius is wide for a residential range -- a French
// subscriber comes back as Paris wherever they live -- so a caller comparing two
// places must widen its own threshold by it rather than trust the point.
export interface IpLocation {
  latitude: number;
  longitude: number;
  accuracyKm: number;
}

const logger = new Logger("Geoip");
let dataset: GeoipDataset | null | undefined;

// Loaded on the first lookup and never again, missing package included: naming
// the country an address was seen from decorates a trail, and an image built
// before the dependency was declared must serve that trail without it rather
// than refuse to boot.
async function load(): Promise<GeoipDataset | null> {
  if (dataset !== undefined) return dataset;
  try {
    dataset = ((await import("fast-geoip")) as unknown as { default: GeoipDataset }).default;
  } catch {
    dataset = null;
    logger.warn("fast-geoip is unavailable: access trails will carry no country");
  }
  return dataset;
}

const RESERVED_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
];

function toLong(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (part.trim() === "" || !Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

// The dataset answers for reserved ranges too: 127.0.0.1 comes back as Japan and
// a docker address as the United States. A wrong flag on an audit trail is worse
// than none, so those ranges never reach the lookup.
function isReserved(ip: string): boolean {
  const address = toLong(ip);
  if (address === null) return true;
  return RESERVED_V4.some(([base, bits]) => {
    const start = toLong(base);
    if (start === null) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (address & mask) >>> 0 === (start & mask) >>> 0;
  });
}

function normalise(ip: string): string {
  const trimmed = ip.trim();
  return /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(trimmed)?.[1] ?? trimmed;
}

export async function countryOf(ip: string): Promise<string> {
  if (typeof ip !== "string") return "";
  const address = normalise(ip);
  if (address.length === 0 || isReserved(address)) return "";

  try {
    const found = await (await load())?.lookup(address);
    return found?.country ?? "";
  } catch {
    return "";
  }
}

// The same lookup as `countryOf`, kept to the coordinates. Null wherever the
// country would be empty: a reserved range, an address the dataset has never
// heard of, or a dataset that could not be loaded at all.
export async function locationOf(ip: string): Promise<IpLocation | null> {
  if (typeof ip !== "string") return null;
  const address = normalise(ip);
  if (address.length === 0 || isReserved(address)) return null;

  try {
    const found = await (await load())?.lookup(address);
    const [latitude, longitude] = found?.ll ?? [];
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const area = Number(found?.area);
    return { latitude: latitude!, longitude: longitude!, accuracyKm: Number.isFinite(area) ? area : 0 };
  } catch {
    return null;
  }
}

export async function countriesFor(ips: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  for (const ip of new Set(ips)) {
    found.set(ip, await countryOf(ip));
  }
  return found;
}
