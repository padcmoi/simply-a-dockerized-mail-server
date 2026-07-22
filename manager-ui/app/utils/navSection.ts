import type { NavigationMenuItem } from "@nuxt/ui";

// The section a path belongs to, taken from the real nav items so the error
// page's breadcrumb never drifts from the sidebar. The dashboard is excluded:
// it is the home the breadcrumb provider already prepends.
export function navSectionFor(path: string, items: NavigationMenuItem[]) {
  const match = items.find(
    (item) => typeof item.to === "string" && item.to !== "/dashboard" && (path === item.to || path.startsWith(`${item.to}/`))
  );
  return match?.to ? { label: String(match.label), to: match.to as string } : null;
}
