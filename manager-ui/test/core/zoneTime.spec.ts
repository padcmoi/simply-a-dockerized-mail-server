import { describe, it, expect } from "vitest";
import { convertZoneTime, logLineInZone } from "~/utils/zoneTime";

const SUMMER = new Date("2026-10-02T10:00:00Z");
const WINTER = new Date("2026-12-01T10:00:00Z");

describe("convertZoneTime", () => {
  it("reads a server time in UTC on the clock of a viewer in Paris, summer and winter", () => {
    expect(convertZoneTime("12:30", "Etc/UTC", "Europe/Paris", SUMMER)).toBe("14:30");
    expect(convertZoneTime("12:30", "Etc/UTC", "Europe/Paris", WINTER)).toBe("13:30");
  });

  it("turns what the viewer typed back into the server time", () => {
    expect(convertZoneTime("14:30", "Europe/Paris", "Etc/UTC", SUMMER)).toBe("12:30");
    expect(convertZoneTime("13:30", "Europe/Paris", "UTC", WINTER)).toBe("12:30");
  });

  it("wraps around midnight both ways", () => {
    expect(convertZoneTime("23:30", "UTC", "Europe/Paris", SUMMER)).toBe("01:30");
    expect(convertZoneTime("00:15", "Europe/Paris", "UTC", SUMMER)).toBe("22:15");
  });

  it("handles a zone on a half hour and a server that is not in UTC", () => {
    expect(convertZoneTime("12:30", "UTC", "Asia/Kolkata", SUMMER)).toBe("18:00");
    expect(convertZoneTime("02:30", "Europe/Paris", "America/New_York", SUMMER)).toBe("20:30");
  });

  it("leaves the time alone when both are in the same zone", () => {
    expect(convertZoneTime("02:30", "Europe/Paris", "Europe/Paris", SUMMER)).toBe("02:30");
  });

  it("leaves alone what is not a time, and a zone it does not know", () => {
    expect(convertZoneTime("25:00", "UTC", "Europe/Paris", SUMMER)).toBe("25:00");
    expect(convertZoneTime("", "UTC", "Europe/Paris", SUMMER)).toBe("");
    expect(convertZoneTime("12:30", "Not/AZone", "Europe/Paris", SUMMER)).toBe("12:30");
  });
});

describe("logLineInZone", () => {
  it("shows the UTC stamp of a log line in the viewer's time", () => {
    expect(logLineInZone("2026-10-02T12:30:01Z backup started, archive backup-2026-10-02.tar.gz", "Europe/Paris")).toBe(
      "2026-10-02 14:30:01 backup started, archive backup-2026-10-02.tar.gz"
    );
  });

  it("moves the date too when the viewer is past midnight", () => {
    expect(logLineInZone("2026-10-02T23:30:01Z stopping 15 containers", "Europe/Paris")).toBe(
      "2026-10-03 01:30:01 stopping 15 containers"
    );
  });

  it("leaves alone a line that carries no UTC stamp", () => {
    expect(logLineInZone("2026-10-02 12:30:01 backup started", "Europe/Paris")).toBe("2026-10-02 12:30:01 backup started");
    expect(logLineInZone("", "Europe/Paris")).toBe("");
  });
});
