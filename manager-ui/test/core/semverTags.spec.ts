import { describe, it, expect } from "vitest";
import * as semver from "~/utils/semverTags";

describe("semverTags", () => {
  it("reads a tag with or without its v", () => {
    expect(semver.parseTag("v2.0.0-rc.3")).toEqual({ name: "v2.0.0-rc.3", core: [2, 0, 0], prerelease: ["rc", "3"] });
    expect(semver.parseTag("1.1.7")).toEqual({ name: "1.1.7", core: [1, 1, 7], prerelease: [] });
    expect(semver.parseTag("latest")).toBeNull();
  });

  it("names the major of the running version, and none of an unknown one", () => {
    expect(semver.majorOf("v2.0.0-rc.3")).toBe(2);
    expect(semver.majorOf("unknown")).toBeNull();
    expect(semver.majorOf(null)).toBeNull();
  });

  // The order is what the names say, not the order GitHub lists them in: a
  // release outranks its candidates, and the tenth candidate the ninth.
  it("keeps one line, newest first, as semver orders it", () => {
    const names = ["v2.0.0-rc.1", "1.1.7", "v2.0.0-rc.10", "v2.0.0", "v2.0.0-rc.2", "v2.1.0-beta.1", "v1.1.5", "v2.0.0-rc.9"];
    expect(semver.tagsOfMajor(names, 2)).toEqual([
      "v2.1.0-beta.1",
      "v2.0.0",
      "v2.0.0-rc.10",
      "v2.0.0-rc.9",
      "v2.0.0-rc.2",
      "v2.0.0-rc.1",
    ]);
    expect(semver.tagsOfMajor(names, 1)).toEqual(["1.1.7", "v1.1.5"]);
  });

  it("ignores what is not a version at all", () => {
    expect(semver.tagsOfMajor(["latest", "v2.0.0", "stable"], 2)).toEqual(["v2.0.0"]);
  });

  it("falls back to the newest line there is", () => {
    expect(semver.newestMajor(["1.1.7", "v2.0.0-rc.1", "v1.1.5"])).toBe(2);
    expect(semver.newestMajor(["nope"])).toBeNull();
  });
});
