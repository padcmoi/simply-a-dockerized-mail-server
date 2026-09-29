import { HttpStatus, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { join } from "path";
import { In, Repository } from "typeorm";
import { ApiError } from "../common/api-error";
import { AppSetting, type AppSettingType } from "../entities/app-setting.entity";
import { VirtualDomain } from "../entities/virtual-domain.entity";
import { postfixSettingsSchema, type PostfixSettingsDto } from "./postfix-settings.validation";

export type PostfixApplyState = "applied" | "pending" | "error" | "unknown";

export interface PostfixApplyStatus {
  state: PostfixApplyState;
  appliedVersion: number | null;
  appliedAt: string | null;
  checkedAt: string | null;
  error: string | null;
}

export interface PostfixSettingsView {
  settings: PostfixSettingsDto;
  version: number;
  hostname: string;
  domains: string[];
  status: PostfixApplyStatus;
}

export interface PostfixSettingsUpdate {
  view: PostfixSettingsView;
  changed: (keyof PostfixSettingsDto)[];
}

const KEYS: Record<keyof PostfixSettingsDto, { key: string; type: AppSettingType }> = {
  bounceSenderLocal: { key: "postfix_bounce_sender_local", type: "string" },
  bounceSenderDomain: { key: "postfix_bounce_sender_domain", type: "string" },
  delayWarningHours: { key: "postfix_delay_warning_hours", type: "number" },
  maximalQueueLifetimeDays: { key: "postfix_maximal_queue_lifetime_days", type: "number" },
};

const VERSION_KEY = "postfix_settings_version";

export const POSTFIX_SETTINGS_DEFAULTS: PostfixSettingsDto = {
  bounceSenderLocal: "mailer-daemon",
  bounceSenderDomain: "",
  delayWarningHours: 0,
  maximalQueueLifetimeDays: 3,
};

export const POSTFIX_MANAGED_PATH = "/var/lib/postfix-managed";

@Injectable()
export class PostfixSettingsService implements OnModuleInit {
  private readonly log = new Logger(PostfixSettingsService.name);
  private readonly settingsDir = join(POSTFIX_MANAGED_PATH, "settings");
  private readonly statusFile = join(POSTFIX_MANAGED_PATH, "status", "status.json");

  constructor(
    @InjectRepository(AppSetting) private readonly settingsRepo: Repository<AppSetting>,
    @InjectRepository(VirtualDomain) private readonly domainsRepo: Repository<VirtualDomain>
  ) {}

  async onModuleInit() {
    try {
      const { settings, version } = await this.read();
      await this.project(settings, version);
    } catch (err) {
      this.log.warn(`Could not write the Postfix settings file: ${(err as Error).message}`);
    }
  }

  async get(): Promise<PostfixSettingsView> {
    const { settings, version } = await this.read();
    const [domains, status] = await Promise.all([this.hostedDomains(), this.status(version)]);
    return { settings, version, hostname: process.env.MAIL_HOSTNAME ?? "", domains, status };
  }

  async update(input: PostfixSettingsDto): Promise<PostfixSettingsUpdate> {
    const next = { ...input, bounceSenderDomain: input.bounceSenderDomain.toLowerCase() };
    if (next.bounceSenderDomain && !(await this.hostedDomains()).includes(next.bounceSenderDomain)) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "postfix.domainNotHosted",
        `${next.bounceSenderDomain} is not an active domain hosted on this server`,
        { domain: next.bounceSenderDomain }
      );
    }
    const current = await this.read();
    const changed = (Object.keys(KEYS) as (keyof PostfixSettingsDto)[]).filter(
      (field) => next[field] !== current.settings[field]
    );
    if (!changed.length) return { view: await this.get(), changed };

    const version = current.version + 1;
    const rows: Pick<AppSetting, "key" | "typeField" | "value">[] = [
      ...(Object.entries(KEYS) as [keyof PostfixSettingsDto, (typeof KEYS)[keyof PostfixSettingsDto]][]).map(([field, spec]) => ({
        key: spec.key,
        typeField: spec.type,
        value: String(next[field]),
      })),
      { key: VERSION_KEY, typeField: "number", value: String(version) },
    ];
    await this.settingsRepo.upsert(rows, ["key"]);
    await this.project(next, version);
    return { view: await this.get(), changed };
  }

  private async read(): Promise<{ settings: PostfixSettingsDto; version: number }> {
    const rows = await this.settingsRepo.find({
      where: { key: In([...Object.values(KEYS).map((spec) => spec.key), VERSION_KEY]) },
    });
    const stored = new Map(rows.map((row) => [row.key, row.value]));
    const raw = (field: keyof PostfixSettingsDto) => stored.get(KEYS[field].key);
    const num = (value: string | undefined, fallback: number) => {
      const n = Number(value);
      return value !== undefined && value !== "" && Number.isInteger(n) ? n : fallback;
    };
    const candidate = {
      bounceSenderLocal: raw("bounceSenderLocal") ?? POSTFIX_SETTINGS_DEFAULTS.bounceSenderLocal,
      bounceSenderDomain: raw("bounceSenderDomain") ?? POSTFIX_SETTINGS_DEFAULTS.bounceSenderDomain,
      delayWarningHours: num(raw("delayWarningHours"), POSTFIX_SETTINGS_DEFAULTS.delayWarningHours),
      maximalQueueLifetimeDays: num(raw("maximalQueueLifetimeDays"), POSTFIX_SETTINGS_DEFAULTS.maximalQueueLifetimeDays),
    };
    const parsed = postfixSettingsSchema.safeParse(candidate);
    return {
      settings: parsed.success ? parsed.data : { ...POSTFIX_SETTINGS_DEFAULTS },
      version: Math.max(0, num(stored.get(VERSION_KEY), 0)),
    };
  }

  private async hostedDomains(): Promise<string[]> {
    const rows = await this.domainsRepo.find({ select: { domain: true }, where: { active: 1 }, order: { domain: "ASC" } });
    return rows.map((row) => row.domain.toLowerCase());
  }

  private async project(settings: PostfixSettingsDto, version: number) {
    await mkdir(this.settingsDir, { recursive: true });
    const target = join(this.settingsDir, "settings.json");
    const tmp = join(this.settingsDir, ".settings.json.tmp");
    await writeFile(tmp, `${JSON.stringify({ version, ...settings }, null, 2)}\n`, { mode: 0o644 });
    await rename(tmp, target);
  }

  private async status(version: number): Promise<PostfixApplyStatus> {
    const unknown: PostfixApplyStatus = { state: "unknown", appliedVersion: null, appliedAt: null, checkedAt: null, error: null };
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(await readFile(this.statusFile, "utf8")) as Record<string, unknown>;
    } catch {
      return unknown;
    }
    const text = (value: unknown) => (typeof value === "string" && value ? value : null);
    const appliedVersion = typeof data.appliedVersion === "number" ? data.appliedVersion : null;
    const checkedVersion = typeof data.version === "number" ? data.version : null;
    const error = checkedVersion === version ? text(data.error) : null;
    const state: PostfixApplyState = error ? "error" : appliedVersion === version ? "applied" : "pending";
    return { state, appliedVersion, appliedAt: text(data.appliedAt), checkedAt: text(data.checkedAt), error };
  }
}
