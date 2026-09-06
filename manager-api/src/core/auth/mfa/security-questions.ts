// The questions an account may choose from. Keys, not sentences: the wording
// is written on both sides of the sign-in screen, in the language of whoever
// reads it, while what the database holds stays the same word forever. A
// free-text question would be stored in the language it was typed in and read
// back in that one, whichever language the person signing in is using.
//
// The interface never carries this list of its own: it reads it from
// GET /auth/jwt/me/security-question and only translates what comes back.
//
// Every one of them answers with a proper name fixed for life: a first name, a
// maiden name, a town of birth. A favourite book changes with the years and a
// childhood street is remembered one way and typed another, and an answer that
// drifts is an account nobody can get back into. Which is why this list is
// short: it is not a quiz, it is the last door.
export const SECURITY_QUESTIONS = ["father", "mother", "grandfather", "grandmother", "birthCity"] as const;

export type SecurityQuestion = (typeof SECURITY_QUESTIONS)[number];

export function isSecurityQuestion(value: string): value is SecurityQuestion {
  return (SECURITY_QUESTIONS as readonly string[]).includes(value);
}
