// Humanize a raw User-Agent string into a "Chrome on Linux" style label. The
// join word ("on"/"sur") is localized by the caller via i18n, so this util only
// extracts the parts (browser, os) and picks a device icon -- it never builds
// the final sentence itself.
export interface ParsedUserAgent {
  browser: string | null;
  os: string | null;
  // Lucide icon name: a phone for mobile OSes, a monitor otherwise.
  icon: string;
}

// Order matters: several browsers spoof each other's tokens (Edge and Opera
// both carry "Chrome", Chrome carries "Safari"), so the more specific brand is
// matched first and wins.
function detectBrowser(ua: string) {
  if (/\bEdg(e|A|iOS)?\//i.test(ua)) return "Edge";
  if (/\b(OPR|Opera)\//i.test(ua)) return "Opera";
  if (/\b(Chrome|CriOS|Chromium)\//i.test(ua)) return "Chrome";
  if (/\b(Firefox|FxiOS)\//i.test(ua)) return "Firefox";
  if (/\bSafari\//i.test(ua) && /\bVersion\//i.test(ua)) return "Safari";
  return null;
}

// iOS is checked before macOS ("iPhone" UAs also contain "Mac OS X"), and
// Android before Linux (Android UAs contain "Linux").
function detectOs(ua: string) {
  if (/Windows NT/i.test(ua)) return "Windows";
  if (/Android/i.test(ua)) return "Android";
  if (/(iPhone|iPad|iPod)/i.test(ua)) return "iOS";
  if (/CrOS/i.test(ua)) return "ChromeOS";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return null;
}

export function parseUserAgent(ua: string | null | undefined) {
  if (!ua) return { browser: null, os: null, icon: "i-lucide-monitor" };
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  return {
    browser: detectBrowser(ua),
    os: detectOs(ua),
    icon: isMobile ? "i-lucide-smartphone" : "i-lucide-monitor",
  };
}
