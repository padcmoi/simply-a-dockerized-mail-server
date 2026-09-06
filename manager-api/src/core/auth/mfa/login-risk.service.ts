import { Injectable } from "@nestjs/common";
import { IpLocation, locationOf } from "../../common/geoip";
import { haversineKm } from "../../common/haversine";
import { AppSettingsService } from "../../settings/app-settings.service";
import { MfaService } from "./mfa.service";

export interface FarAway {
  distanceKm: number;
  thresholdKm: number;
}

@Injectable()
export class LoginRiskService {
  constructor(
    private readonly mfa: MfaService,
    private readonly settings: AppSettingsService
  ) {}

  // Where a sign-in comes from, or null when the address says nothing: a
  // private range, a loopback, the docker bridge, or an address the local
  // dataset has never heard of.
  locate(ip?: string): Promise<IpLocation | null> {
    return ip ? locationOf(ip) : Promise.resolve(null);
  }

  // Far enough from the account's usual place to be worth a proof, or null when
  // it is not. Null is also the answer whenever the question cannot be asked
  // honestly: radius set to zero, an address that could not be placed, an
  // account with no place yet. A missing answer never blocks a sign-in.
  //
  // The threshold is the radius widened by the accuracy the dataset admits to.
  // A residential range comes back as the middle of the country it is in, so
  // comparing two such points to within 100 km would challenge a move across
  // town while letting a move across the continent through.
  async isFar(accountId: string, where: IpLocation | null): Promise<FarAway | null> {
    const radiusKm = this.settings.get().loginRadiusKm;
    if (!where || radiusKm <= 0) return null;
    const home = await this.mfa.placeOf(accountId);
    if (!home) return null;
    const distanceKm = haversineKm(home, where);
    const thresholdKm = Math.max(radiusKm, where.accuracyKm);
    return distanceKm > thresholdKm ? { distanceKm: Math.round(distanceKm), thresholdKm } : null;
  }
}
