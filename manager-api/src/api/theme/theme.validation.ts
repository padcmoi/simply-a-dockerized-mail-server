import { z } from "zod";
import { THEME_TOKENS } from "../../core/theme/theme.catalog";

// Six hexadecimal digits and a hash, nothing else. The stored value ends up
// inside a stylesheet: anything looser than this would be a way to write CSS
// into every page of the interface from a form.
const HEX = /^#[0-9A-Fa-f]{6}$/;

const token = z.enum(THEME_TOKENS as unknown as [string, ...string[]]);

const palette = z.record(token, z.string().regex(HEX)).default({});

// Strict rather than stripping: a mode this API does not know is a caller
// believing in a theme that will never be painted, and silence would let it
// believe it for good.
export const updateThemeSchema = z
  .object({
    light: palette,
    dark: palette,
  })
  .strict();

export type UpdateThemeDto = z.infer<typeof updateThemeSchema>;
