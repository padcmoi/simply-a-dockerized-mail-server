import type { NavigationMenuItem } from "@nuxt/ui";

// The section a path belongs to, taken from the real nav items so the error
// page's breadcrumb never drifts from the sidebar. The personal space is
// excluded: it is the home the breadcrumb provider already prepends. The
// longest matching `to` wins, so /admin/domains/x resolves to Domains rather
// than the /admin dashboard whose prefix it also shares.
export function navSectionFor(path: string, items: NavigationMenuItem[]) {
  let best: { label: string; to: string } | null = null;
  for (const item of items) {
    if (typeof item.to !== "string" || item.to === "/me") continue;
    if (path === item.to || path.startsWith(`${item.to}/`)) {
      if (!best || item.to.length > best.to.length) best = { label: String(item.label), to: item.to };
    }
  }
  return best;
}
