import { readFile, access } from "fs/promises";
import { cpus, freemem, loadavg, totalmem } from "os";
import { Injectable } from "@nestjs/common";

// What a supervision console has to show is the machine, and inside a container
// that is exactly what /proc reports: docker does not namespace /proc/stat,
// /proc/loadavg or /proc/meminfo, and this stack sets no memory limit, so those
// figures are the host's own and not the container's share.
//
// The network is the exception, and the reason the host's /proc is mounted at
// HOST_PROC: /proc/net IS namespaced, so what a container reads there is the
// traffic of its own veth. See networkDirectory below.
const HOST_PROC = process.env.HOST_PROC ?? "/host/proc";

export interface SystemSnapshot {
  /** Epoch milliseconds. The page turns it into a clock time in the reader's own zone. */
  at: number;
  /** Logical processors, which is what a load average has to be read against. */
  cores: number;
  /** Percent over the interval since the previous sample; null on the first one. */
  cpu: number | null;
  load: { one: number; five: number; fifteen: number };
  /** Bytes. */
  memory: { total: number; used: number };
  /** Null where the host's own counters are out of reach; rates in bytes per second. */
  network: { interface: string; in: number | null; out: number | null } | null;
}

interface CpuTicks {
  busy: number;
  idle: number;
}

interface Counters {
  rx: number;
  tx: number;
}

@Injectable()
export class SystemMetricsService {
  // Ticks and bytes since boot, so a single reading says nothing: only the delta
  // between two of them is a rate. Hence the baseline held here, with the moment
  // it was taken, since the loop aims at two seconds but is not owed them.
  private baseline: { at: number; cpu: CpuTicks; network: Counters | null } | null = null;

  async sample(): Promise<SystemSnapshot> {
    const [ticks, network] = await Promise.all([
      this.readProcTicks().then((read) => read ?? this.readOsTicks()),
      this.readNetwork(),
    ]);

    const previous = this.baseline;
    const at = Date.now();
    this.baseline = { at, cpu: ticks, network: network && { rx: network.rx, tx: network.tx } };

    const [one = 0, five = 0, fifteen = 0] = loadavg();
    const seconds = previous ? (at - previous.at) / 1000 : 0;

    return {
      at,
      cores: cpus().length,
      cpu: this.percent(previous?.cpu ?? null, ticks),
      load: { one, five, fifteen },
      memory: (await this.readProcMemory()) ?? { total: totalmem(), used: Math.max(0, totalmem() - freemem()) },
      network: network && {
        interface: network.name,
        in: previous?.network ? this.rate(network.rx, previous.network.rx, seconds) : null,
        out: previous?.network ? this.rate(network.tx, previous.network.tx, seconds) : null,
      },
    };
  }

  // The aggregate `cpu` line of /proc/stat, in the order the kernel documents it:
  // user nice system idle iowait irq softirq steal guest guest_nice.
  private async readProcTicks(): Promise<CpuTicks | null> {
    const stat = await readFile("/proc/stat", "utf8").catch(() => null);
    const fields = (stat?.split("\n", 1)[0] ?? "").trim().split(/\s+/).slice(1, 9).map(Number);
    if (fields.length < 5 || fields.some(Number.isNaN)) return null;

    const [user = 0, nice = 0, system = 0, idle = 0, iowait = 0, irq = 0, softirq = 0, steal = 0] = fields;

    // iowait is idle time and belongs in the denominator: leaving it out is what
    // makes a host waiting on a disk look busy. guest and guest_nice are
    // deliberately not summed, the kernel already counts them inside user and nice.
    return { busy: user + nice + system + irq + softirq + steal, idle: idle + iowait };
  }

  // Off linux, where there is no /proc to read. Not the same measurement, libuv
  // drops iowait, and it only has to keep the cards alive on a developer's laptop.
  private readOsTicks(): CpuTicks {
    return cpus().reduce<CpuTicks>(
      (total, { times }) => ({
        busy: total.busy + times.user + times.nice + times.sys + times.irq,
        idle: total.idle + times.idle,
      }),
      { busy: 0, idle: 0 }
    );
  }

  // MemAvailable, and not freemem() which is MemFree: the page cache is memory
  // the kernel hands back on demand, and counting it as used reports a host at
  // 86 % while `free -h` says 31 %.
  private async readProcMemory() {
    const info = await readFile("/proc/meminfo", "utf8").catch(() => null);
    if (!info) return null;

    const kilobytes = (key: string) => Number(new RegExp(`^${key}:\\s+(\\d+) kB`, "m").exec(info)?.[1] ?? Number.NaN) * 1024;
    const total = kilobytes("MemTotal");
    const available = kilobytes("MemAvailable");

    if (!Number.isFinite(total) || !Number.isFinite(available) || total <= 0) return null;
    return { total, used: Math.max(0, total - available) };
  }

  private async readable(path: string) {
    return access(path).then(
      () => true,
      () => false
    );
  }

  // Where the host's interfaces can be read, or null when they cannot be.
  //
  // `${HOST_PROC}/net` would not do: it is a symlink to self/net, and self is
  // this process, back in the container's own network namespace. PID 1 is the
  // host's init, in the host's namespace. Nothing is reported rather than
  // reporting a veth as if it were the NIC.
  private async networkDirectory() {
    if (await this.readable(`${HOST_PROC}/1/net/dev`)) return `${HOST_PROC}/1/net`;
    if (!(await this.readable("/.dockerenv"))) return "/proc/net";
    return null;
  }

  // The interface carrying the default route, rather than every interface summed:
  // that would add the docker bridges and every veth on them, and count the same
  // packet several times over.
  private defaultInterface(route: string) {
    for (const line of route.split("\n").slice(1)) {
      const [name, destination] = line.trim().split(/\s+/);
      if (name && destination === "00000000") return name;
    }
    return null;
  }

  // /proc/net/dev, after the colon: receive bytes first, transmit bytes ninth.
  private counters(dev: string, name: string) {
    const line = dev.split("\n").find((row) => row.trim().startsWith(`${name}:`));
    const fields = line
      ?.slice(line.indexOf(":") + 1)
      .trim()
      .split(/\s+/)
      .map(Number);

    if (!fields || fields.length < 9) return null;
    const [rx] = fields;
    const tx = fields[8];

    return rx !== undefined && tx !== undefined && !Number.isNaN(rx) && !Number.isNaN(tx) ? { rx, tx } : null;
  }

  private async readNetwork() {
    const directory = await this.networkDirectory();
    if (!directory) return null;

    const [route, dev] = await Promise.all([
      readFile(`${directory}/route`, "utf8").catch(() => null),
      readFile(`${directory}/dev`, "utf8").catch(() => null),
    ]);
    if (!route || !dev) return null;

    const name = this.defaultInterface(route);
    const bytes = name ? this.counters(dev, name) : null;

    return name && bytes ? { name, ...bytes } : null;
  }

  private percent(previous: CpuTicks | null, current: CpuTicks) {
    if (!previous) return null;

    const busy = current.busy - previous.busy;
    const total = busy + (current.idle - previous.idle);
    if (total <= 0) return null;

    return Math.min(100, Math.max(0, Math.round((busy / total) * 1000) / 10));
  }

  // Bytes per second over the interval actually elapsed rather than the one the
  // loop aims at. A counter that went backwards is an interface that was reset,
  // and there is no rate to report for that interval.
  private rate(current: number, previous: number, seconds: number) {
    if (seconds <= 0 || current < previous) return null;
    return Math.round((current - previous) / seconds);
  }
}
