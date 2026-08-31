import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MailSetting } from "../entities/mail-setting.entity";
import { MailConfig, rowToConfig } from "./providers";

export interface MailSettingsUpdate {
  provider: string;
  host?: string | null;
  port?: number | null;
  secure?: boolean;
  username?: string | null;
  password?: string;
  fromAddress?: string | null;
}

export interface MailSettingsView {
  provider: string;
  host: string | null;
  port: number | null;
  secure: boolean;
  username: string | null;
  fromAddress: string | null;
  hasPassword: boolean;
  validated: boolean;
}

export interface MailSettingsList {
  configs: MailSettingsView[];
  selected: string | null;
}

@Injectable()
export class MailSettingsService {
  constructor(@InjectRepository(MailSetting) private readonly repo: Repository<MailSetting>) {}

  async list(): Promise<MailSettingsList> {
    const rows = await this.repo.find();
    const selected = rows.find((r) => r.selected === 1)?.provider ?? null;
    return { configs: rows.map((r) => this.mask(r)), selected };
  }

  getProvider(provider: string): Promise<MailSetting | null> {
    return this.repo.findOne({ where: { provider } });
  }

  getSelected(): Promise<MailSetting | null> {
    return this.repo.findOne({ where: { selected: 1 } });
  }

  async save(input: MailSettingsUpdate): Promise<MailSettingsView> {
    const row = (await this.getProvider(input.provider)) ?? this.repo.create({ provider: input.provider });
    if (input.host !== undefined) row.host = input.host;
    if (input.port !== undefined) row.port = input.port;
    if (input.secure !== undefined) row.secure = input.secure ? 1 : 0;
    if (input.username !== undefined) row.username = input.username;
    if (input.fromAddress !== undefined) row.fromAddress = input.fromAddress;
    if (input.password !== undefined) row.password = input.password === "" ? null : input.password;
    row.validated = 0;
    row.selected = null;
    await this.repo.save(row);
    return this.mask(row);
  }

  configFor(provider: string): Promise<MailConfig> {
    return this.getProvider(provider).then(rowToConfig);
  }

  setOtp(provider: string, code: string | null): Promise<unknown> {
    return this.repo.update({ provider }, { otp: code });
  }

  async verify(provider: string, code: string): Promise<boolean> {
    const row = await this.getProvider(provider);
    if (!row || !row.otp || row.otp !== code) return false;
    await this.clearSelected();
    await this.repo.update({ provider }, { validated: 1, selected: 1, otp: null });
    return true;
  }

  async select(provider: string): Promise<boolean> {
    const row = await this.getProvider(provider);
    if (!row || row.validated !== 1) return false;
    await this.clearSelected();
    await this.repo.update({ provider }, { selected: 1 });
    return true;
  }

  disable(): Promise<unknown> {
    return this.clearSelected();
  }

  private clearSelected(): Promise<unknown> {
    return this.repo.update({ selected: 1 }, { selected: null });
  }

  async toConfig(): Promise<MailConfig> {
    return rowToConfig(await this.getSelected());
  }

  async isEnabled(): Promise<boolean> {
    return (await this.toConfig()).enabled;
  }

  private mask(row: MailSetting): MailSettingsView {
    return {
      provider: row.provider,
      host: row.host,
      port: row.port,
      secure: row.secure === 1,
      username: row.username,
      fromAddress: row.fromAddress,
      hasPassword: !!row.password,
      validated: row.validated === 1,
    };
  }
}
