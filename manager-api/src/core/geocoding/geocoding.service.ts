import { Injectable, Logger } from "@nestjs/common";

// Best-effort forward geocoding of a city to latitude/longitude via OpenStreetMap
// Nominatim (no API key). Deliberately never throws: a network error, a rate
// limit or an unknown city just yields null, so saving a profile is never
// blocked by geocoding. Nominatim asks for a descriptive User-Agent (overridable
// with GEOCODER_USER_AGENT) and ~1 request/second; profile edits are rare enough
// that no extra throttling is added here.
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  async geocodeCity(city: string, country?: string | null): Promise<{ latitude: string; longitude: string } | null> {
    const query = country ? `${city}, ${country}` : city;
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": process.env.GEOCODER_USER_AGENT ?? "simply-mail-server-manager/1.0" },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
      const first = data[0];
      if (!first?.lat || !first?.lon) return null;
      return { latitude: first.lat, longitude: first.lon };
    } catch (err) {
      this.logger.warn(`Geocoding failed for "${query}": ${(err as Error).message}`);
      return null;
    }
  }
}
