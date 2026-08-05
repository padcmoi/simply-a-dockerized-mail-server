import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AppSetting, AppSettingType } from "../entities/app-setting.entity";

export interface AppSettingsView {
  offlineNotifyAfterMs: number;
  offlineSweepIntervalMs: number;
  mailMinIntervalMs: number;
  /** How far back the recorded machine history is kept before it is pruned. */
  supervisionRetentionMs: number;
  managerUrl: string;
}

interface FieldSpec {
  key: string;
  type: AppSettingType;
}

const FIELDS: Record<keyof AppSettingsView, FieldSpec> = {
  offlineNotifyAfterMs: { key: "offline_notify_after_ms", type: "number" },
  offlineSweepIntervalMs: { key: "offline_sweep_interval_ms", type: "number" },
  mailMinIntervalMs: { key: "mail_min_interval_ms", type: "number" },
  supervisionRetentionMs: { key: "supervision_retention_ms", type: "number" },
  managerUrl: { key: "manager_url", type: "string" },
};

export const APP_SETTINGS_DEFAULTS: AppSettingsView = {
  offlineNotifyAfterMs: 300_000,
  offlineSweepIntervalMs: 20_000,
  mailMinIntervalMs: 30_000,
  // A week, exactly the widest window a supervision card offers: keeping more
  // than that costs disk for history nothing on the page can draw.
  supervisionRetentionMs: 7 * 24 * 3_600_000,
  managerUrl: "",
};

@Injectable()
export class AppSettingsService implements OnModuleInit {
  private cache: AppSettingsView = { ...APP_SETTINGS_DEFAULTS };

  constructor(@InjectRepository(AppSetting) private readonly repo: Repository<AppSetting>) {}

  async onModuleInit() {
    await this.reload();
  }

  get(): AppSettingsView {
    return this.cache;
  }

  async reload(): Promise<AppSettingsView> {
    const rows = await this.repo.find().catch(() => [] as AppSetting[]);
    const stored = new Map(rows.map((r) => [r.key, r.value]));
    const num = (spec: FieldSpec, fallback: number) => {
      const raw = stored.get(spec.key);
      const n = raw === undefined ? NaN : Number(raw);
      return Number.isFinite(n) ? n : fallback;
    };
    const str = (spec: FieldSpec, fallback: string) => stored.get(spec.key) ?? fallback;
    this.cache = {
      offlineNotifyAfterMs: num(FIELDS.offlineNotifyAfterMs, APP_SETTINGS_DEFAULTS.offlineNotifyAfterMs),
      offlineSweepIntervalMs: num(FIELDS.offlineSweepIntervalMs, APP_SETTINGS_DEFAULTS.offlineSweepIntervalMs),
      mailMinIntervalMs: num(FIELDS.mailMinIntervalMs, APP_SETTINGS_DEFAULTS.mailMinIntervalMs),
      supervisionRetentionMs: num(FIELDS.supervisionRetentionMs, APP_SETTINGS_DEFAULTS.supervisionRetentionMs),
      managerUrl: str(FIELDS.managerUrl, APP_SETTINGS_DEFAULTS.managerUrl),
    };
    return this.cache;
  }

  async update(input: Partial<AppSettingsView>): Promise<AppSettingsView> {
    const rows: Pick<AppSetting, "key" | "typeField" | "value">[] = [];
    for (const [field, spec] of Object.entries(FIELDS)) {
      const value = input[field as keyof AppSettingsView];
      if (value === undefined) continue;
      rows.push({ key: spec.key, typeField: spec.type, value: String(value) });
    }
    if (rows.length) await this.repo.upsert(rows, ["key"]);
    return this.reload();
  }
}
