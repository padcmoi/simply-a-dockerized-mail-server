import { z } from "zod";
import { TLDS } from "../../core/common/tlds";

// http(s):// + a real domain, optional port, nothing after (no path/query/fragment).
// Group 1 is the host, whose last label must be a registered IANA TLD -- that is
// what rejects a plausible-looking but fake domain such as "mail.gestionpartique".
const HOST = /^https?:\/\/((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})(?::\d{1,5})?$/i;

export function isRealDomainUrl(value: string): boolean {
  const match = HOST.exec(value);
  if (!match) return false;
  const host = match[1].toLowerCase();
  return TLDS.has(host.slice(host.lastIndexOf(".") + 1));
}

export const updateGeneralSchema = z.object({
  managerUrl: z
    .string()
    .trim()
    .max(512)
    .refine((v) => v === "" || isRealDomainUrl(v), {
      message: "The interface address must be http(s):// a real domain with a valid extension, no path",
    }),
});

export type UpdateGeneralDto = z.infer<typeof updateGeneralSchema>;
