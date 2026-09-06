import { createHmac, timingSafeEqual } from "crypto";

// "Joël", " joel " and "JOEL" are the same answer: whoever typed it a year ago
// will not reproduce the accents or the spacing, and a question nobody can
// answer twice protects nothing. Everything else is kept, punctuation included.
export function normaliseAnswer(answer: string): string {
  return answer
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Keyed rather than plainly hashed: fifty thousand first names fall to a
// dictionary run over a dump in seconds, and the pepper is not in the dump.
export function hashAnswer(answer: string, pepper: string): string {
  return createHmac("sha256", `security-answer:${pepper}`).update(normaliseAnswer(answer)).digest("hex");
}

export function matchAnswer(answer: string, hash: string, pepper: string): boolean {
  const candidate = Buffer.from(hashAnswer(answer, pepper));
  const stored = Buffer.from(hash);
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}
