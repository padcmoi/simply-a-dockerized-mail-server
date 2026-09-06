import { describe, it, expect, beforeEach, vi } from "vitest";
import { LoginRiskService } from "../../src/core/auth/mfa/login-risk.service";
import { APP_SETTINGS_DEFAULTS, type AppSettingsService } from "../../src/core/settings/app-settings.service";
import type { MfaService } from "../../src/core/auth/mfa/mfa.service";
import { providerMock } from "../helpers/mocks";

const { locationOf } = vi.hoisted(() => ({ locationOf: vi.fn() }));
vi.mock("../../src/core/common/geoip", () => ({ locationOf }));

const FREJUS = { latitude: 43.4330308, longitude: 6.7360182 };
const NICE = { latitude: 43.7009358, longitude: 7.2683912, accuracyKm: 0 };
const PARIS = { latitude: 48.8566, longitude: 2.3522, accuracyKm: 0 };

function makeService(radiusKm = 100) {
  const mfa = providerMock<MfaService>({ placeOf: vi.fn(async () => FREJUS) });
  const settings = providerMock<AppSettingsService>({
    get: vi.fn(() => ({ ...APP_SETTINGS_DEFAULTS, loginRadiusKm: radiusKm })),
  });
  return { mfa, settings, svc: new LoginRiskService(mfa, settings) };
}

describe("LoginRiskService.locate", () => {
  beforeEach(() => locationOf.mockReset());

  it("asks the dataset for an address it was given", async () => {
    locationOf.mockResolvedValue(NICE);
    const { svc } = makeService();
    expect(await svc.locate("77.136.10.1")).toEqual(NICE);
    expect(locationOf).toHaveBeenCalledWith("77.136.10.1");
  });

  it("asks nothing when there is no address at all", async () => {
    const { svc } = makeService();
    expect(await svc.locate(undefined)).toBeNull();
    expect(locationOf).not.toHaveBeenCalled();
  });
});

describe("LoginRiskService.isFar", () => {
  it("is quiet for a sign-in inside the radius", async () => {
    const { svc } = makeService();
    expect(await svc.isFar("a1", NICE)).toBeNull();
  });

  it("speaks up for a sign-in beyond it, and says by how much", async () => {
    const { svc } = makeService();
    expect(await svc.isFar("a1", PARIS)).toEqual({ distanceKm: 691, thresholdKm: 100 });
  });

  it("is quiet when the address could not be placed", async () => {
    const { svc } = makeService();
    expect(await svc.isFar("a1", null)).toBeNull();
  });

  it("is quiet for an account that has no usual place yet", async () => {
    const { svc, mfa } = makeService();
    mfa.placeOf.mockResolvedValue(null);
    expect(await svc.isFar("a1", PARIS)).toBeNull();
  });

  it("is quiet when the radius is set to zero, which is how the check is turned off", async () => {
    const { svc } = makeService(0);
    expect(await svc.isFar("a1", PARIS)).toBeNull();
  });

  // A residential range answers with the middle of the country it is in. Two
  // such points are hundreds of kilometres apart while naming the same city, so
  // the dataset's own admission of vagueness widens the threshold.
  it("widens the threshold to the accuracy the dataset admits to", async () => {
    const { svc } = makeService();
    const vague = { ...PARIS, accuracyKm: 1000 };
    expect(await svc.isFar("a1", vague)).toBeNull();
  });

  it("still speaks up past a wide accuracy when the jump is wider still", async () => {
    const { svc } = makeService();
    const moscow = { latitude: 55.7558, longitude: 37.6173, accuracyKm: 1000 };
    expect(await svc.isFar("a1", moscow)).toMatchObject({ thresholdKm: 1000 });
  });
});
