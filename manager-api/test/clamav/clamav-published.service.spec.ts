import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from "vitest";
import { promises as dns } from "dns";
import { ClamavPublishedService } from "../../src/core/clamav/clamav-published.service";

const RECORD = ["1.4.6:63:28129:1789910940:1:90:49192:339"];

describe("ClamavPublishedService", () => {
  let resolve: MockInstance<typeof dns.resolveTxt>;

  beforeEach(() => {
    vi.useFakeTimers();
    resolve = vi.spyOn(dns, "resolveTxt").mockResolvedValue([RECORD]);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("reads the engine and the three database versions out of ClamAV's record", async () => {
    const published = await new ClamavPublishedService().read();

    expect(resolve).toHaveBeenCalledWith("current.cvd.clamav.net");
    expect(published).toEqual({ engine: "1.4.6", versions: { main: 63, daily: 28129, bytecode: 339 } });
  });

  // The page is read live and the record changes a few times a day: a lookup
  // per frame would be a lookup a second.
  it("holds the answer for ten minutes, then asks again", async () => {
    const service = new ClamavPublishedService();
    await service.read();
    await service.read();
    expect(resolve).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(600_001);
    await service.read();
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it("answers nothing, rather than throwing, while the lookup fails", async () => {
    resolve.mockRejectedValue(new Error("no dns"));
    expect(await new ClamavPublishedService().read()).toEqual({ engine: null, versions: {} });
  });

  // A lookup that fails once says nothing about the versions it answered with a
  // minute ago.
  it("keeps the last answer when a later lookup fails", async () => {
    const service = new ClamavPublishedService();
    await service.read();

    resolve.mockRejectedValue(new Error("no dns"));
    vi.advanceTimersByTime(600_001);

    expect(await service.read()).toEqual({ engine: "1.4.6", versions: { main: 63, daily: 28129, bytecode: 339 } });
  });

  it("reads a record whose fields are not numbers as no version at all", async () => {
    resolve.mockResolvedValue([["1.4.6:x::1789910940:1:90:49192:"]]);
    expect(await new ClamavPublishedService().read()).toEqual({
      engine: "1.4.6",
      versions: { main: null, daily: null, bytecode: null },
    });
  });
});
