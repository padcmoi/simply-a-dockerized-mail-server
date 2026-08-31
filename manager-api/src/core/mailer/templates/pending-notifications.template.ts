export function pendingNotificationsEmail(managerUrl?: string) {
  const base = (managerUrl || process.env.MANAGER_UI_URL || "").replace(/\/+$/, "");
  const text = [
    "You have one or more notifications waiting in the manager.",
    "",
    base ? `Open the manager: ${base}` : "Sign in to the manager to read them.",
  ].join("\n");
  const button = base
    ? `<p style="margin:24px 0"><a href="${base}" style="background:#3b82f6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Open the manager</a></p>`
    : "";
  const html = `
          <p>You have one or more notifications waiting in the manager.</p>
          ${button}
        `;
  return { subject: "You have pending notifications", text, html };
}
