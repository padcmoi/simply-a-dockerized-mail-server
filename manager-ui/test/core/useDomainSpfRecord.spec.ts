import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";

let call: ReturnType<typeof vi.fn>;

beforeEach(() => {
  call = vi.fn();
  vi.stubGlobal("useApi", () => ({ call }));
});

const { spfStateOf, useDomainSpfRecord } = await import("~/composables/useDomainSpfRecord");

const record = (overrides: Partial<SpfRecord> = {}): SpfRecord => ({
  dnsName: "example.org",
  txtRecord: "v=spf1 mx ip4:203.0.113.10 -all",
  mailHost: "mail.example.org",
  ips: ["203.0.113.10"],
  published: "v=spf1 mx -all",
  multiple: false,
  covered: true,
  error: null,
  ...overrides,
});

describe("spfStateOf", () => {
  it("says missing, then several records, then whether the server is covered", () => {
    expect(spfStateOf(record({ published: null, multiple: true }))).toBe("missing");
    expect(spfStateOf(record({ multiple: true }))).toBe("multiple");
    expect(spfStateOf(record({ covered: false }))).toBe("notCovered");
    expect(spfStateOf(record())).toBe("ok");
  });
});

describe("useDomainSpfRecord", () => {
  it("reads the record of the domain under a key of its own, and nothing without a domain", async () => {
    const asyncData = vi.fn<(key: () => string, handler: () => Promise<unknown>, options: { server: boolean }) => void>();
    vi.stubGlobal("useAsyncData", asyncData);
    const id = ref<number | null>(4);
    useDomainSpfRecord(() => id.value);
    const [key, handler, options] = asyncData.mock.calls[0]!;
    call.mockResolvedValue(record());
    expect(key()).toBe("domain-spf-record-4");
    await expect(handler()).resolves.toMatchObject({ covered: true });
    expect(call).toHaveBeenCalledWith("/domains/4/spf-record");
    expect(options.server).toBe(false);
    id.value = null;
    expect(key()).toBe("domain-spf-record-none");
    await expect(handler()).resolves.toBeNull();
    expect(call).toHaveBeenCalledTimes(1);
  });
});
