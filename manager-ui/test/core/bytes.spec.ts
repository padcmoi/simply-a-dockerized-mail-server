import { describe, it, expect } from "vitest";
import { formatBytes, KB, MB, GB, TB } from "~/utils/bytes";

describe("formatBytes", () => {
  it("prints TB with one decimal at and above 1 TiB", () => {
    expect(formatBytes(TB)).toBe("1.0 TB");
    expect(formatBytes(1.5 * TB)).toBe("1.5 TB");
  });

  it("prints GB with one decimal between 1 GiB and 1 TiB", () => {
    expect(formatBytes(GB)).toBe("1.0 GB");
    expect(formatBytes(2 * GB)).toBe("2.0 GB");
    expect(formatBytes(1.5 * GB)).toBe("1.5 GB");
    expect(formatBytes(10_485_760_000)).toBe("9.8 GB");
  });

  it("prints whole MB between 1 MiB and 1 GiB", () => {
    expect(formatBytes(MB)).toBe("1 MB");
    expect(formatBytes(5 * MB)).toBe("5 MB");
    expect(formatBytes(100 * MB)).toBe("100 MB");
  });

  it("prints whole kB between 1 KiB and 1 MiB", () => {
    expect(formatBytes(KB)).toBe("1 kB");
    expect(formatBytes(2048)).toBe("2 kB");
  });

  it("prints bytes below 1 KiB, and 0 bytes for nothing at all", () => {
    expect(formatBytes(500)).toBe("500 bytes");
    expect(formatBytes(0)).toBe("0 bytes");
    expect(formatBytes(-1)).toBe("0 bytes");
    expect(formatBytes(Number.NaN)).toBe("0 bytes");
  });

  it("prints the quota the API sends as a string, once the caller has cast it", () => {
    expect(formatBytes(Number("104857600"))).toBe("100 MB");
    expect(formatBytes(Number("10485760000"))).toBe("9.8 GB");
  });
});

describe("byte units", () => {
  it("are binary, each one 1024 of the one below", () => {
    expect(KB).toBe(1024);
    expect(MB).toBe(1024 * KB);
    expect(GB).toBe(1024 * MB);
    expect(TB).toBe(1024 * GB);
  });
});
