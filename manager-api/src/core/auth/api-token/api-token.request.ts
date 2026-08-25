export const KEY_PREFIX = "sms_";

export function parseApiKey(rawKey: string): { clientId: string; secret: string } | null {
  if (!rawKey.startsWith(KEY_PREFIX)) return null;
  const body = rawKey.slice(KEY_PREFIX.length);
  const dot = body.indexOf(".");
  if (dot === -1) return null;
  const clientId = body.slice(0, dot);
  const secret = body.slice(dot + 1);
  if (!clientId || !secret) return null;
  return { clientId, secret };
}

export function normalizeIp(ip: string): string {
  return /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip)?.[1] ?? ip;
}
