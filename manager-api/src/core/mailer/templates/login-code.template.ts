// The code a sign-in from an unusual place has to be answered with. It names
// the distance rather than a place: the dataset behind it knows a range, not a
// street, and telling someone they signed in from a city they have never been
// to reads as a bug even when the warning is right.
export interface LoginCodeTemplateInput {
  code: string;
  minutes: number;
  /** Left out on a resend, where the distance has already been explained. */
  distanceKm?: number;
}

export function loginCodeEmail(input: LoginCodeTemplateInput) {
  const { code, minutes, distanceKm } = input;

  const why = distanceKm
    ? `This sign-in came from about ${distanceKm} km away from where this account usually signs in, so it has to be confirmed with a code.`
    : "This sign-in came from further away than this account usually signs in from, so it has to be confirmed with a code.";

  const text = [
    why,
    "",
    `Your sign-in code: ${code}`,
    "",
    `The code is valid for ${minutes} minutes and can be used once.`,
    "If this was not you, your password is known to someone else: change it as soon as you can.",
  ].join("\n");

  const html = `
          <p>${why}</p>
          <p style="margin:24px 0">
            <code style="background:#3b82f6;color:#fff;padding:10px 20px;border-radius:6px;font-size:20px;letter-spacing:3px">${code}</code>
          </p>
          <p style="color:#6b7280;font-size:13px">The code is valid for ${minutes} minutes and can be used once.</p>
          <p style="color:#6b7280;font-size:13px">If this was not you, your password is known to someone else: change it as soon as you can.</p>
        `;

  return { subject: "Your sign-in code", text, html };
}
