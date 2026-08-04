import { describe, it, expect, beforeEach, vi } from "vitest";
import { SystemMetricsService } from "../../src/core/supervision/system-metrics.service";

// Hoisted with the mock that closes over them: `vi.mock` is lifted above the
// imports, so plain module-scope consts would still be in their dead zone when
// the mocked module is first required.
const { files, readable } = vi.hoisted(() => ({ files: new Map<string, string>(), readable: new Set<string>() }));

vi.mock("fs/promises", () => ({
  readFile: vi.fn(async (path: string) => {
    const content = files.get(path);
    if (content === undefined) throw new Error(`ENOENT ${path}`);
    return content;
  }),
  access: vi.fn(async (path: string) => {
    if (!readable.has(path)) throw new Error(`ENOENT ${path}`);
  }),
}));

vi.mock("os", () => ({
  cpus: () => Array.from({ length: 8 }, () => ({ times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } })),
  loadavg: () => [0.5, 0.4, 0.3],
  totalmem: () => 1000,
  freemem: () => 400,
}));

function procStat(busy: number, idle: number) {
  return `cpu  ${busy} 0 0 ${idle} 0 0 0 0 0 0\ncpu0 1 2 3 4 5 6 7 8\n`;
}

function meminfo(totalKb: number, availableKb: number) {
  return `MemTotal:       ${totalKb} kB\nMemFree:        10 kB\nMemAvailable:   ${availableKb} kB\n`;
}

const ROUTE = "Iface\tDestination\tGateway\ndocker0\t000011AC\t00000000\neth0\t00000000\t0100A8C0\n";

function dev(rx: number, tx: number) {
  return `Inter-|   Receive\n face |bytes\n  eth0: ${rx} 1 2 3 4 5 6 7 ${tx} 9\n`;
}

describe("SystemMetricsService", () => {
  beforeEach(() => {
    files.clear();
    readable.clear();
    files.set("/proc/stat", procStat(100, 900));
    files.set("/proc/meminfo", meminfo(1000, 600));
  });

  it("reports no cpu percentage on the first sample, since a rate needs two readings", async () => {
    const service = new SystemMetricsService();
    const first = await service.sample();
    expect(first.cpu).toBeNull();
    expect(first.cores).toBe(8);
    expect(first.load).toEqual({ one: 0.5, five: 0.4, fifteen: 0.3 });
  });

  it("computes the cpu percentage from the tick delta between two samples", async () => {
    const service = new SystemMetricsService();
    await service.sample();
    files.set("/proc/stat", procStat(150, 950));
    const second = await service.sample();
    expect(second.cpu).toBe(50);
  });

  // iowait is idle time: counting it as busy is what makes a host waiting on a
  // disk read as saturated.
  it("counts iowait as idle rather than as work", async () => {
    const service = new SystemMetricsService();
    files.set("/proc/stat", "cpu  0 0 0 0 0 0 0 0\n");
    await service.sample();
    files.set("/proc/stat", "cpu  10 0 0 0 90 0 0 0\n");
    expect((await service.sample()).cpu).toBe(10);
  });

  // MemAvailable, not MemFree: the page cache is memory the kernel hands back on
  // demand, and counting it as used overstates the host by tens of points.
  it("reads memory as total minus MemAvailable", async () => {
    const service = new SystemMetricsService();
    const { memory } = await service.sample();
    expect(memory).toEqual({ total: 1000 * 1024, used: 400 * 1024 });
  });

  it("falls back to the os figures when /proc/meminfo cannot be read", async () => {
    files.delete("/proc/meminfo");
    const service = new SystemMetricsService();
    expect((await service.sample()).memory).toEqual({ total: 1000, used: 600 });
  });

  // A veth is not the machine's interface, and a figure that is wrong is worse
  // than a figure that is missing.
  it("reports no network at all inside a container with no host /proc mounted", async () => {
    readable.add("/.dockerenv");
    const service = new SystemMetricsService();
    expect((await service.sample()).network).toBeNull();
  });

  it("reads the host's own interfaces through the mounted /proc of pid 1", async () => {
    readable.add("/.dockerenv");
    readable.add("/host/proc/1/net/dev");
    files.set("/host/proc/1/net/route", ROUTE);
    files.set("/host/proc/1/net/dev", dev(1000, 2000));

    const service = new SystemMetricsService();
    const first = await service.sample();
    expect(first.network).toEqual({ interface: "eth0", in: null, out: null });
  });

  it("turns the byte counters into per-second rates over the interval that actually elapsed", async () => {
    readable.add("/.dockerenv");
    readable.add("/host/proc/1/net/dev");
    files.set("/host/proc/1/net/route", ROUTE);
    files.set("/host/proc/1/net/dev", dev(1000, 2000));

    vi.useFakeTimers();
    try {
      const service = new SystemMetricsService();
      await service.sample();
      vi.advanceTimersByTime(2000);
      files.set("/host/proc/1/net/dev", dev(3000, 6000));
      const second = await service.sample();
      expect(second.network).toEqual({ interface: "eth0", in: 1000, out: 2000 });
    } finally {
      vi.useRealTimers();
    }
  });

  // An interface that was reset has no rate for that interval, and a counter
  // read backwards would otherwise draw a peak nobody's machine ever did.
  it("reports no rate for an interval whose counters went backwards", async () => {
    readable.add("/.dockerenv");
    readable.add("/host/proc/1/net/dev");
    files.set("/host/proc/1/net/route", ROUTE);
    files.set("/host/proc/1/net/dev", dev(5000, 5000));

    vi.useFakeTimers();
    try {
      const service = new SystemMetricsService();
      await service.sample();
      vi.advanceTimersByTime(2000);
      files.set("/host/proc/1/net/dev", dev(10, 10));
      expect((await service.sample()).network).toEqual({ interface: "eth0", in: null, out: null });
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores the docker bridge and follows the interface carrying the default route", async () => {
    readable.add("/.dockerenv");
    readable.add("/host/proc/1/net/dev");
    files.set("/host/proc/1/net/route", ROUTE);
    files.set("/host/proc/1/net/dev", `  docker0: 9 1 2 3 4 5 6 7 9 9\n  eth0: 1 1 2 3 4 5 6 7 2 9\n`);

    const service = new SystemMetricsService();
    expect((await service.sample()).network?.interface).toBe("eth0");
  });
});
