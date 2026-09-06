import { describe, it, expect } from "vitest";
import { haversineKm } from "../../src/core/common/haversine";

const FREJUS = { latitude: 43.4330308, longitude: 6.7360182 };
const NICE = { latitude: 43.7009358, longitude: 7.2683912 };
const PARIS = { latitude: 48.8566, longitude: 2.3522 };
const MOSCOW = { latitude: 55.7558, longitude: 37.6173 };

describe("haversineKm", () => {
  it("is zero between a point and itself", () => {
    expect(haversineKm(FREJUS, FREJUS)).toBe(0);
  });

  it("measures a short hop along the coast", () => {
    expect(haversineKm(FREJUS, NICE)).toBeCloseTo(52, 0);
  });

  it("measures a country away", () => {
    expect(haversineKm(FREJUS, PARIS)).toBeCloseTo(691, 0);
  });

  it("measures a continent away", () => {
    expect(haversineKm(PARIS, MOSCOW)).toBeCloseTo(2486, 0);
  });

  it("does not care which way round it is asked", () => {
    expect(haversineKm(NICE, MOSCOW)).toBeCloseTo(haversineKm(MOSCOW, NICE), 6);
  });

  it("crosses the antimeridian by the short way", () => {
    const west = { latitude: 0, longitude: -179 };
    const east = { latitude: 0, longitude: 179 };
    expect(haversineKm(west, east)).toBeCloseTo(222, 0);
  });

  it("spans half the globe between the poles", () => {
    expect(haversineKm({ latitude: 90, longitude: 0 }, { latitude: -90, longitude: 0 })).toBeCloseTo(20015, 0);
  });
});
