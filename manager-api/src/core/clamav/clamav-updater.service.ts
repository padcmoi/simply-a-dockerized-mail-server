import { ConflictException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/** A full daily download is minutes, not seconds, and the answer is worth waiting for. */
const TIMEOUT_MS = 600_000;

export interface ClamavUpdateResult {
  /** freshclam's own lines, the last forty of them. */
  output: string[];
  /** Whether it downloaded anything, as opposed to finding everything current. */
  updated: boolean;
}

// Running freshclam is the one thing that cannot be done from outside the
// scanner's container: it writes the signature directory, and nothing else may.
// A small updater ships with the image and listens on the mail network, where
// manager-api already reaches clamd itself, and this is the only thing that
// talks to it.
@Injectable()
export class ClamavUpdaterService {
  private readonly log = new Logger(ClamavUpdaterService.name);
  private readonly baseUrl: string;

  constructor(cfg: ConfigService) {
    this.baseUrl = cfg.get<string>("CLAMAV_API_URL") ?? "http://172.200.0.12:8082";
  }

  async update(): Promise<ClamavUpdateResult> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/update`, { method: "POST", signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
      this.log.warn(`clamav-api POST /update unreachable: ${(e as Error).message}`);
      throw new ServiceUnavailableException("The antivirus updater is out of reach");
    }

    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) return { output: lines(payload.output), updated: payload.updated === true };

    // The updater refuses a second run while one is under way, which is an
    // answer, not a failure: the first one is still going.
    if (res.status === 409) throw new ConflictException("An update is already running");

    const message = typeof payload.error === "string" ? payload.error : `clamav-api POST /update -> ${res.status}`;
    this.log.warn(message);
    throw new ServiceUnavailableException(message);
  }
}

function lines(value: unknown) {
  return Array.isArray(value) ? value.map((line) => String(line)) : [];
}
