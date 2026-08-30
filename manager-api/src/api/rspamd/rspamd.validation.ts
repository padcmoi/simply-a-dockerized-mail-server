import { z } from "zod";

// Mirrors rspamd's own webui validation (js/app/config.js, ui.saveActions):
// each provided threshold must be non-negative, and read top-to-bottom
// (reject > rewrite subject > add header > greylist) the non-null values
// must be strictly descending. Rspamd's own /saveactions endpoint enforces
// neither itself, so this is the only guard against a malformed config.
export const saveRspamdActionsSchema = z
  .object({
    reject: z.number().min(0).nullable(),
    rewriteSubject: z.number().min(0).nullable(),
    addHeader: z.number().min(0).nullable(),
    greylist: z.number().min(0).nullable(),
  })
  .refine(
    (v) => {
      const ordered = [v.reject, v.rewriteSubject, v.addHeader, v.greylist].filter((n): n is number => n !== null);
      return ordered.every((n, i) => i === 0 || n < ordered[i - 1]);
    },
    { error: "Thresholds must be strictly descending: reject > rewrite subject > add header > greylist" }
  );

export type SaveRspamdActionsDto = z.infer<typeof saveRspamdActionsSchema>;
