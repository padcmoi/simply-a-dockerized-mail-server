// GitHub draws a bare URL in release notes as a link and shortens its own: a
// compare URL reads "a...b", a pull request or an issue "#n", a commit its
// short sha. The message parser links [text](url) only, so the notes are
// rewritten that way before they reach it. A URL already inside a link, or
// glued to a word, is left alone; trailing punctuation stays outside the link.
const BARE_URL = /(^|[^([\w])(https?:\/\/[^\s<>)\]]+)/g;
const TRAILING = /[.,;:!?]+$/;

function labelFor(url: string, repo: string) {
  const own = `https://github.com/${repo}/`;
  if (!url.startsWith(own)) return url;
  const path = url.slice(own.length);
  const compare = /^compare\/(.+)$/.exec(path);
  if (compare) return compare[1] ?? url;
  const issue = /^(?:pull|issues)\/(\d+)$/.exec(path);
  if (issue) return `#${issue[1]}`;
  const commit = /^commit\/([0-9a-f]{7,40})$/.exec(path);
  if (commit) return (commit[1] ?? "").slice(0, 7);
  return url;
}

export function linkifyReleaseNotes(body: string, repo: string) {
  return body.replace(BARE_URL, (_match, before: string, raw: string) => {
    const tail = TRAILING.exec(raw)?.[0] ?? "";
    const url = tail ? raw.slice(0, -tail.length) : raw;
    return `${before}[${labelFor(url, repo)}](${url})${tail}`;
  });
}
