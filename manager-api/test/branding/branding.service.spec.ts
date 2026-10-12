import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { Readable } from "stream";
import { BRANDING_MAX_BYTES, BrandingService } from "../../src/core/branding/branding.service";

class TestBrandingService extends BrandingService {
  constructor(
    protected readonly dir: string,
    protected readonly defaultsDir: string
  ) {
    super();
  }
}

const SHIPPED_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="orange"/></svg>';
const SHIPPED_LOGO =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="brown"/></svg>';

const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M1 1h22v22H1z"/></svg>';
const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><circle cx="64" cy="64" r="60"/></svg>';

async function text(stream: Readable) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks).toString("utf8");
}

describe("BrandingService", () => {
  let dir: string;
  let shipped: string;
  let svc: TestBrandingService;
  const icon = () => join(dir, "custom-mail-icon.svg");
  const logo = () => join(dir, "custom-mail-logo.svg");
  const favicon = () => join(dir, "custom-mail-favicon.svg");
  const NONE = { custom: false, version: null, favicon: null };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "branding-"));
    shipped = await mkdtemp(join(tmpdir(), "branding-shipped-"));
    await writeFile(join(shipped, "favicon.svg"), SHIPPED_ICON);
    await writeFile(join(shipped, "naskot-mail-logo.svg"), SHIPPED_LOGO);
    svc = new TestBrandingService(dir, shipped);
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    await rm(shipped, { recursive: true, force: true });
  });

  describe("at the start of the API", () => {
    it("puts a copy of each shipped mark under the name that is missing, as a file to replace", async () => {
      await svc.onModuleInit();
      expect((await readdir(dir)).sort()).toEqual(["custom-mail-favicon.svg", "custom-mail-icon.svg", "custom-mail-logo.svg"]);
      expect(await readFile(icon(), "utf8")).toBe(SHIPPED_ICON);
      expect(await readFile(favicon(), "utf8")).toBe(SHIPPED_ICON);
      expect(await readFile(logo(), "utf8")).toBe(SHIPPED_LOGO);
      for (const file of [icon(), logo(), favicon()]) expect((await stat(file)).mode & 0o777).toBe(0o777);
      expect(await svc.state()).toEqual(NONE);
    });

    it("never touches a file that is there, replaced or not, and only fills in what is missing", async () => {
      await writeFile(logo(), LOGO);
      await svc.seed();
      expect(await readFile(logo(), "utf8")).toBe(LOGO);
      expect(await readFile(icon(), "utf8")).toBe(SHIPPED_ICON);
      await writeFile(icon(), ICON);
      await rm(favicon());
      await svc.seed();
      expect(await readFile(icon(), "utf8")).toBe(ICON);
      expect(await readFile(logo(), "utf8")).toBe(LOGO);
      expect(await readFile(favicon(), "utf8")).toBe(SHIPPED_ICON);
    });

    it("does not put a file where a link already holds the name", async () => {
      await symlink(join(dir, "nowhere.svg"), logo());
      await svc.seed();
      expect(await readFile(logo(), "utf8").catch(() => "not a file")).toBe("not a file");
    });

    it("starts all the same when it has nothing to copy, or nowhere to write", async () => {
      await rm(shipped, { recursive: true, force: true });
      await expect(svc.onModuleInit()).resolves.toBeUndefined();
      expect(await readdir(dir)).toEqual([]);
      const nowhere = new TestBrandingService(join(dir, "missing-folder"), dir);
      await expect(nowhere.onModuleInit()).resolves.toBeUndefined();
    });
  });

  describe("the copies put there at the start", () => {
    const seed = async () => {
      await writeFile(icon(), SHIPPED_ICON);
      await writeFile(logo(), SHIPPED_LOGO);
      await writeFile(favicon(), SHIPPED_ICON);
    };

    it("are not custom marks while nobody replaced them: the interface keeps its own", async () => {
      await seed();
      expect(await svc.state()).toEqual(NONE);
      expect(await svc.open("icon")).toBeNull();
      expect(await svc.open("logo")).toBeNull();
      expect(await svc.open("favicon")).toBeNull();
    });

    it("turn custom as soon as the logo is replaced, the untouched icon going with it", async () => {
      await seed();
      await writeFile(logo(), LOGO);
      const state = await svc.state();
      expect(state.custom).toBe(true);
      expect(state.favicon).toBeNull();
      expect(await text((await svc.open("logo"))!.stream)).toBe(LOGO);
      expect(await text((await svc.open("icon"))!.stream)).toBe(SHIPPED_ICON);
      expect(await svc.open("favicon")).toBeNull();
    });

    it("leave the favicon alone until it is the one replaced", async () => {
      await seed();
      await writeFile(favicon(), ICON);
      const state = await svc.state();
      expect(state.custom).toBe(false);
      expect(state.favicon).toMatch(/^[0-9a-f]{12}$/);
      expect(await text((await svc.open("favicon"))!.stream)).toBe(ICON);
    });

    it("count as custom when the files shipped with the interface cannot be read to compare", async () => {
      await seed();
      await rm(shipped, { recursive: true, force: true });
      const state = await svc.state();
      expect(state.custom).toBe(true);
      expect(state.favicon).not.toBeNull();
    });
  });

  it("keeps the marks the interface ships with when the volumes folder holds no custom file", async () => {
    expect(await svc.state()).toEqual(NONE);
    expect(await svc.open("icon")).toBeNull();
    expect(await svc.open("logo")).toBeNull();
    expect(await svc.open("favicon")).toBeNull();
  });

  for (const [alone, write] of [
    ["the icon", () => writeFile(icon(), ICON)],
    ["the logo", () => writeFile(logo(), LOGO)],
  ] as const) {
    it(`keeps them too when only ${alone} is there: both or none`, async () => {
      await write();
      expect(await svc.state()).toEqual(NONE);
      expect(await svc.open("icon")).toBeNull();
      expect(await svc.open("logo")).toBeNull();
    });
  }

  it("uses the two files once both are at the root of the volumes folder", async () => {
    await writeFile(icon(), ICON);
    await writeFile(logo(), LOGO);
    const state = await svc.state();
    expect(state.custom).toBe(true);
    expect(state.version).toMatch(/^[0-9a-f]{12}$/);
    const served = await svc.open("icon");
    expect(served?.size).toBe(Buffer.byteLength(ICON));
    expect(await text(served!.stream)).toBe(ICON);
    expect(await text((await svc.open("logo"))!.stream)).toBe(LOGO);
  });

  it("gives another version once a file is replaced, and goes back to the default once one is removed", async () => {
    await writeFile(icon(), ICON);
    await writeFile(logo(), LOGO);
    const before = await svc.state();
    await writeFile(logo(), `${LOGO}<!-- changed -->`);
    const after = await svc.state();
    expect(after.custom).toBe(true);
    expect(after.version).not.toBe(before.version);
    await rm(icon());
    expect(await svc.state()).toEqual(NONE);
  });

  it("takes the favicon on its own, whatever the icon and the logo are", async () => {
    await writeFile(favicon(), ICON);
    const alone = await svc.state();
    expect(alone.custom).toBe(false);
    expect(alone.version).toBeNull();
    expect(alone.favicon).toMatch(/^[0-9a-f]{12}$/);
    expect(await text((await svc.open("favicon"))!.stream)).toBe(ICON);
    expect(await svc.open("icon")).toBeNull();

    await writeFile(icon(), ICON);
    await writeFile(logo(), LOGO);
    const all = await svc.state();
    expect(all.custom).toBe(true);
    expect(all.favicon).toBe(alone.favicon);

    await rm(favicon());
    const pair = await svc.state();
    expect(pair.custom).toBe(true);
    expect(pair.favicon).toBeNull();
    expect(await svc.open("favicon")).toBeNull();
    expect(await svc.open("logo")).not.toBeNull();
  });

  it("gives the favicon another version once it is replaced, without touching the other one", async () => {
    await writeFile(icon(), ICON);
    await writeFile(logo(), LOGO);
    await writeFile(favicon(), ICON);
    const before = await svc.state();
    await writeFile(favicon(), `${ICON}<!-- changed -->`);
    const after = await svc.state();
    expect(after.favicon).not.toBe(before.favicon);
    expect(after.version).toBe(before.version);
  });

  it("refuses a favicon that is a link, empty or over the size limit", async () => {
    await writeFile(join(dir, "elsewhere.svg"), ICON);
    await symlink(join(dir, "elsewhere.svg"), favicon());
    expect((await svc.state()).favicon).toBeNull();
    await rm(favicon());
    await writeFile(favicon(), "");
    expect((await svc.state()).favicon).toBeNull();
    await writeFile(favicon(), "x".repeat(BRANDING_MAX_BYTES + 1));
    expect((await svc.state()).favicon).toBeNull();
  });

  it("does not follow a link: a file that points elsewhere is not a file given", async () => {
    await writeFile(join(dir, "elsewhere.svg"), ICON);
    await symlink(join(dir, "elsewhere.svg"), icon());
    await writeFile(logo(), LOGO);
    expect(await svc.state()).toEqual(NONE);
    expect(await svc.open("logo")).toBeNull();
  });

  it("refuses an empty file and one over the size limit", async () => {
    await writeFile(icon(), "");
    await writeFile(logo(), LOGO);
    expect((await svc.state()).custom).toBe(false);
    await writeFile(icon(), "x".repeat(BRANDING_MAX_BYTES + 1));
    expect((await svc.state()).custom).toBe(false);
    await writeFile(icon(), "x".repeat(BRANDING_MAX_BYTES));
    expect((await svc.state()).custom).toBe(true);
  });
});
