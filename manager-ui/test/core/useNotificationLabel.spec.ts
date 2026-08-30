import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NotificationRow } from "~/types/app/notification";

const { useNotificationLabel } = await import("~/composables/useNotificationLabel");

// The real messages, so a key renamed on one side and not the other fails here
// rather than printing its own path on a screen.
const MESSAGES: Record<string, string> = {
  "notifications.event.ticket-created": '{actor} opened the ticket "{subject}" on {domain}',
  "notifications.event.machine-load": "The machine load is at {percent}% of its cores",
  "notifications.someone": "Someone",
  "notifications.source.support": "Support",
  "notifications.source.supervision": "Machine",
  "tickets.status.open": "open",
};

beforeEach(() => {
  vi.stubGlobal("useI18n", () => ({
    t: (key: string, values?: Record<string, unknown>) => {
      const message = MESSAGES[key];
      if (message === undefined) return key;
      return message.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? ""));
    },
  }));
});

function row(over: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id: 1,
    source: "support",
    type: "ticket-created",
    payload: { subject: "Broken relay", domainName: "example.org", actor: "alice@example.org" },
    link: "/admin/tickets/1",
    readAt: null,
    createdAt: "2026-08-01T10:00:00.000Z",
    ...over,
  };
}

describe("useNotificationLabel", () => {
  it("writes the event sentence with the payload's own values", () => {
    const { label } = useNotificationLabel();
    expect(label(row())).toBe('alice@example.org opened the ticket "Broken relay" on example.org');
  });

  it("names an unknown actor rather than leaving a hole in the sentence", () => {
    const { label } = useNotificationLabel();
    expect(label(row({ payload: { subject: "Broken relay", domainName: "example.org" } }))).toContain("Someone");
  });

  it("carries a figure through as a number, including zero", () => {
    const { label } = useNotificationLabel();
    expect(label(row({ source: "supervision", type: "machine-load", payload: { percent: 0 } }))).toBe(
      "The machine load is at 0% of its cores"
    );
  });

  it("survives a payload that is null", () => {
    const { label } = useNotificationLabel();
    expect(() => label(row({ payload: null }))).not.toThrow();
  });

  it("gives each source its own icon and a bell to anything unheard of", () => {
    const { icon } = useNotificationLabel();
    expect(icon(row())).toBe("i-lucide-life-buoy");
    expect(icon(row({ source: "supervision" }))).toBe("i-lucide-activity");
    expect(icon(row({ source: "billing" }))).toBe("i-lucide-bell");
  });

  it("falls back to the raw source name rather than printing a translation key", () => {
    const { sourceLabel } = useNotificationLabel();
    expect(sourceLabel("support")).toBe("Support");
    expect(sourceLabel("billing")).toBe("billing");
  });
});
