// The HTML shell shared by every notification email: the wording is a plain
// text body (built by each source's own template), and this turns its line
// breaks into an HTML paragraph. Kept apart so a source never rebuilds the
// shell, and a future richer layout changes one place.
export function notificationHtml(text: string) {
  return `<p>${text.replace(/\n/g, "<br>")}</p>`;
}
