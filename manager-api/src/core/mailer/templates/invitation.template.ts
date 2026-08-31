// The invitation email, both forms. `link` is the account-setup URL and
// `groupNames` the groups the invitee will hold (empty means none until
// assigned). The `from` address is decided by the caller, not the template.
export interface InvitationTemplateInput {
  link: string;
  groupNames: string[];
}

export function invitationEmail(input: InvitationTemplateInput) {
  const { link, groupNames } = input;

  const scopeText = groupNames.length ? `groups: ${groupNames.join(", ")}` : "no group (no permissions until assigned)";
  const scopeHtml = groupNames.length
    ? `groups: <strong><code>${groupNames.join(", ")}</code></strong>`
    : "<strong>no group (no permissions until assigned)</strong>";

  const text = [
    `You have been invited to manage this mail server, with ${scopeText}.`,
    "",
    `Set up your account here: ${link}`,
    "",
    "This invitation expires in 7 days.",
  ].join("\n");

  const html = `
          <p>You have been invited to manage this mail server, with ${scopeHtml}.</p>
          <p style="margin:24px 0">
            <a href="${link}" style="background:#3b82f6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">
              Set up your account
            </a>
          </p>
          <p style="color:#6b7280;font-size:13px">This invitation expires in 7 days.</p>
        `;

  return { subject: "Invitation to manage the mail server", text, html };
}
