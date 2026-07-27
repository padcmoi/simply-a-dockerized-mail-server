import { describe, it, expect } from "vitest";
import { navSectionFor } from "~/utils/navSection";

const NAV = [
  { label: "Administration", to: "/admin" },
  { label: "My space", to: "/my-space" },
  { label: "Domains", to: "/admin/domains" },
  { label: "Support", to: "/admin/tickets" },
];

describe("navSectionFor", () => {
  it("finds the section a deep path belongs to", () => {
    expect(navSectionFor("/admin/tickets/18", NAV)).toEqual({ label: "Support", to: "/admin/tickets" });
  });

  it("matches the exact section root", () => {
    expect(navSectionFor("/admin/domains", NAV)).toEqual({ label: "Domains", to: "/admin/domains" });
  });

  it("prefers the longest matching section over a shared parent prefix", () => {
    expect(navSectionFor("/admin/domains/example.com/recipients", NAV)).toEqual({ label: "Domains", to: "/admin/domains" });
  });

  it("resolves the bare /admin dashboard to Administration", () => {
    expect(navSectionFor("/admin", NAV)).toEqual({ label: "Administration", to: "/admin" });
  });

  it("never returns the personal space", () => {
    expect(navSectionFor("/my-space", NAV)).toBeNull();
  });

  it("returns nothing for an unknown path", () => {
    expect(navSectionFor("/nowhere", NAV)).toBeNull();
  });

  it("does not bind a partial segment to a section", () => {
    expect(navSectionFor("/admin/domainsxyz", NAV)).toEqual({ label: "Administration", to: "/admin" });
  });
});
