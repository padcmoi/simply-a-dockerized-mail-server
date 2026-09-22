import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { AppSetting, type AppSettingType } from "../entities/app-setting.entity";
import type { DmarcSettingsView } from "./dmarc.types";

const KEYS: Record<keyof DmarcSettingsView, { key: string; type: AppSettingType }> = {
  sendingEnabled: { key: "dmarc_sending_enabled", type: "boolean" },
  reportHour: { key: "dmarc_report_hour", type: "number" },
  inboxes: { key: "dmarc_inboxes", type: "string" },
  retentionDays: { key: "dmarc_retention_days", type: "number" },
  copyTo: { key: "dmarc_copy_to", type: "string" },
};

export function serverDomain(): string {
  return baseDomain(process.env.MAIL_HOSTNAME ?? "localhost");
}

export function baseDomain(hostname: string): string {
  const labels = hostname.toLowerCase().replace(/\.$/, "").split(".").filter(Boolean);
  return labels.length > 2 ? labels.slice(1).join(".") : labels.join(".");
}

function hourOf(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return raw !== undefined && raw !== "" && Number.isInteger(n) && n >= 0 && n <= 23 ? n : fallback;
}

@Injectable()
export class DmarcSettingsService {
  constructor(@InjectRepository(AppSetting) private readonly repo: Repository<AppSetting>) {}

  defaults(): DmarcSettingsView {
    return {
      sendingEnabled: false,
      reportHour: hourOf(process.env.DMARC_REPORT_HOUR, 2),
      inboxes: [],
      retentionDays: 90,
      copyTo: null,
    };
  }

  async get(): Promise<DmarcSettingsView> {
    const defaults = this.defaults();
    const rows = await this.repo.find({ where: { key: In(Object.values(KEYS).map((spec) => spec.key)) } });
    const stored = new Map(rows.map((row) => [row.key, row.value]));
    const read = (field: keyof DmarcSettingsView) => stored.get(KEYS[field].key);

    const retention = Number(read("retentionDays"));
    const inboxes = read("inboxes");
    return {
      sendingEnabled: read("sendingEnabled") === undefined ? defaults.sendingEnabled : read("sendingEnabled") === "true",
      reportHour: hourOf(read("reportHour"), defaults.reportHour),
      inboxes: inboxes === undefined ? defaults.inboxes : inboxes.split(",").filter(Boolean),
      retentionDays: Number.isInteger(retention) && retention > 0 ? retention : defaults.retentionDays,
      copyTo: read("copyTo") || defaults.copyTo,
    };
  }

  async update(input: Partial<DmarcSettingsView>): Promise<DmarcSettingsView> {
    const rows: Pick<AppSetting, "key" | "typeField" | "value">[] = [];
    for (const [field, spec] of Object.entries(KEYS) as [keyof DmarcSettingsView, (typeof KEYS)[keyof DmarcSettingsView]][]) {
      const value = input[field];
      if (value === undefined) continue;
      rows.push({
        key: spec.key,
        typeField: spec.type,
        value: Array.isArray(value) ? value.join(",") : value === null ? "" : String(value),
      });
    }
    if (rows.length) await this.repo.upsert(rows, ["key"]);
    return this.get();
  }
}
