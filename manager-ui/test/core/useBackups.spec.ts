import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useBackups } from "~/composables/useBackups";

const overview = {
  configured: true,
  config: null,
  pending: false,
  lastRequest: null,
  lastRun: null,
  projectReadable: true,
  retrieval: { pending: null, last: null },
};
const ARCHIVE = "backup-2026-10-02.tar.gz";
const ID = "0b8f6f0e-5a55-4c5e-9d7b-2f3a1c9e7d10";
const asked: BackupRetrieval = { pending: { id: ID, name: ARCHIVE }, last: null };

let call: ReturnType<typeof vi.fn>;
let add: ReturnType<typeof vi.fn>;
let assign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  call = vi.fn(async (path: string) => {
    if (path === "/backups") return overview;
    if (path === "/backups/files") return [{ name: ARCHIVE }];
    return { token: "tok.sig" };
  });
  add = vi.fn();
  assign = vi.fn();
  vi.stubGlobal("useApi", () => ({ call }));
  vi.stubGlobal("useApiError", () => ({ apiErrorMessage: (err: unknown) => String(err) }));
  vi.stubGlobal("useToast", () => ({ add }));
  vi.stubGlobal("window", { location: { assign } });
  vi.stubGlobal("onBeforeUnmount", vi.fn());
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useBackups", () => {
  it("loads the overview and the archives together", async () => {
    const { overview: state, files, loaded, failed, load } = useBackups();
    await load();
    expect(state.value).toEqual(overview);
    expect(files.value).toEqual([{ name: ARCHIVE }]);
    expect(loaded.value).toBe(true);
    expect(failed.value).toBe(false);
  });

  it("flags a failed load without throwing", async () => {
    call.mockRejectedValue(new Error("down"));
    const { loaded, failed, load } = useBackups();
    await load();
    expect(loaded.value).toBe(true);
    expect(failed.value).toBe(true);
  });

  it("asks for a link then hands the browser the download", async () => {
    const { downloading, download } = useBackups();
    await download(ARCHIVE);
    expect(call).toHaveBeenCalledWith(`/backups/files/${ARCHIVE}/download-link`, { method: "POST" });
    expect(assign).toHaveBeenCalledWith("/api/v1/backups/download/tok.sig");
    expect(downloading.value).toBeNull();
  });

  it("reports a refused download and opens nothing", async () => {
    call.mockRejectedValue(new Error("gone"));
    const { download } = useBackups();
    await download(ARCHIVE);
    expect(assign).not.toHaveBeenCalled();
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ title: "backups.files.downloadFailed", color: "error" }));
  });

  describe("an archive that was sent off-site", () => {
    type Served = { retrieval: BackupRetrieval; downloadable: boolean };
    const server = (state: Served) =>
      call.mockImplementation(async (path: string) => {
        if (path === "/backups") return { ...overview, retrieval: state.retrieval };
        if (path === "/backups/files")
          return [{ name: ARCHIVE, downloadable: state.downloadable, retrievable: !state.downloadable }];
        if (path.endsWith("/retrieve")) return asked;
        return { token: "tok.sig" };
      });

    it("asks the server to bring it back, waits, then downloads it by itself", async () => {
      vi.useFakeTimers();
      const state: Served = { retrieval: asked, downloadable: false };
      server(state);
      const { retrieving, retrieve } = useBackups();
      await retrieve(ARCHIVE);
      expect(call).toHaveBeenCalledWith(`/backups/files/${ARCHIVE}/retrieve`, { method: "POST" });
      expect(add).toHaveBeenCalledWith(expect.objectContaining({ title: "backups.files.retrievingTitle", color: "info" }));
      expect(retrieving.value).toBe(ARCHIVE);

      await vi.advanceTimersByTimeAsync(3000);
      expect(retrieving.value).toBe(ARCHIVE);
      expect(assign).not.toHaveBeenCalled();

      state.retrieval = { pending: null, last: { id: ID, name: ARCHIVE, state: "done", error: "", at: null } };
      state.downloadable = true;
      await vi.advanceTimersByTimeAsync(3000);
      expect(retrieving.value).toBeNull();
      expect(call).toHaveBeenCalledWith(`/backups/files/${ARCHIVE}/download-link`, { method: "POST" });
      expect(assign).toHaveBeenCalledWith("/api/v1/backups/download/tok.sig");
    });

    it("says why when the server could not bring it back, and downloads nothing", async () => {
      vi.useFakeTimers();
      const state: Served = { retrieval: asked, downloadable: false };
      server(state);
      const { retrieving, retrieve } = useBackups();
      await retrieve(ARCHIVE);
      state.retrieval = { pending: null, last: { id: ID, name: ARCHIVE, state: "error", error: "no route to host", at: null } };
      await vi.advanceTimersByTimeAsync(3000);
      expect(retrieving.value).toBeNull();
      expect(assign).not.toHaveBeenCalled();
      expect(add).toHaveBeenCalledWith(
        expect.objectContaining({ title: "backups.files.retrieveFailed", description: "no route to host", color: "error" })
      );
    });

    it("reports a refused request and waits for nothing", async () => {
      call.mockRejectedValue(new Error("busy"));
      const { retrieving, retrieve } = useBackups();
      await retrieve(ARCHIVE);
      expect(retrieving.value).toBeNull();
      expect(add).toHaveBeenCalledWith(expect.objectContaining({ title: "backups.files.retrieveFailed", color: "error" }));
    });

    it("shows an archive still being brought back when the page is opened, without downloading it once back", async () => {
      vi.useFakeTimers();
      const state: Served = { retrieval: asked, downloadable: false };
      server(state);
      const { retrieving, files, load } = useBackups();
      await load();
      expect(retrieving.value).toBe(ARCHIVE);
      state.retrieval = { pending: null, last: { id: ID, name: ARCHIVE, state: "done", error: "", at: null } };
      state.downloadable = true;
      await vi.advanceTimersByTimeAsync(3000);
      expect(retrieving.value).toBeNull();
      expect(files.value[0]?.downloadable).toBe(true);
      expect(assign).not.toHaveBeenCalled();
    });
  });
});
