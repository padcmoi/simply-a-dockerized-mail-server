import { describe, it, expect } from "vitest";
import { navSectionFor } from "~/utils/navSection";

const NAV = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Support", to: "/tickets" },
  { label: "Domains", to: "/domains" },
];

describe("navSectionFor", () => {
  it("finds the section a deep path belongs to", () => {
    expect(navSectionFor("/tickets/18", NAV)).toEqual({ label: "Support", to: "/tickets" });
  });

  it("matches the exact section root", () => {
    expect(navSectionFor("/domains", NAV)).toEqual({ label: "Domains", to: "/domains" });
  });

  // The dashboard is the home the breadcrumb already prepends, never a section.
  it("never returns the dashboard", () => {
    expect(navSectionFor("/dashboard", NAV)).toBeNull();
  });

  it("returns nothing for an unknown path", () => {
    expect(navSectionFor("/nowhere", NAV)).toBeNull();
  });

  // A path that merely shares a prefix but not a segment boundary must not match.
  it("does not match a partial segment", () => {
    expect(navSectionFor("/ticketsxyz", NAV)).toBeNull();
  });
});
