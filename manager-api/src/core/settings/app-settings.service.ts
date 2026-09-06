import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AppSetting, AppSettingType } from "../entities/app-setting.entity";

/**
 * Which proof a far-away sign-in is asked for first, when the account has no
 * authenticator app. Written as the order itself so a third method later is
 * another entry, not another shape. The one that cannot be offered -- no mail
 * configured, no question chosen -- is skipped for the next.
 */
export const LOGIN_CHALLENGE_ORDERS = ["email,question", "question,email"] as const;
export type LoginChallengeOrder = (typeof LOGIN_CHALLENGE_ORDERS)[number];

export function isLoginChallengeOrder(value: string): value is LoginChallengeOrder {
  return (LOGIN_CHALLENGE_ORDERS as readonly string[]).includes(value);
}

export interface AppSettingsView {
  offlineNotifyAfterMs: number;
  offlineSweepIntervalMs: number;
  mailMinIntervalMs: number;
  /** How far back the recorded machine history is kept before it is pruned. */
  supervisionRetentionMs: number;
  managerUrl: string;
  /** Whether opening a ticket must name at least one mailbox or alias. */
  ticketResourcesRequired: boolean;
  /**
   * Whether external sign-in is offered at all. Off, the login screen draws no
   * provider button and the API refuses every exchange, credentials or not.
   */
  passportEnabled: boolean;
  /**
   * Whether an external sign-in by someone with no account here creates one.
   * Off means a provider only signs in accounts that already exist.
   */
  passportAutoProvision: boolean;
  /**
   * How far a sign-in may be from where the account usually signs in before it
   * has to prove itself with more than a password. Zero turns the check off.
   */
  loginRadiusKm: number;
  /** In what order the two proofs are offered when neither is the app's code. */
  loginChallengeOrder: LoginChallengeOrder;
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
  ticketResourcesRequired: { key: "ticket_resources_required", type: "boolean" },
  passportEnabled: { key: "passport_enabled", type: "boolean" },
  passportAutoProvision: { key: "passport_auto_provision", type: "boolean" },
  loginRadiusKm: { key: "login_radius_km", type: "number" },
  loginChallengeOrder: { key: "login_challenge_order", type: "string" },
};

export const APP_SETTINGS_DEFAULTS: AppSettingsView = {
  offlineNotifyAfterMs: 300_000,
  offlineSweepIntervalMs: 20_000,
  mailMinIntervalMs: 30_000,
  // A week, exactly the widest window a supervision card offers: keeping more
  // than that costs disk for history nothing on the page can draw.
  supervisionRetentionMs: 7 * 24 * 3_600_000,
  managerUrl: "",
  // On by default: a ticket that names nothing sends the support desk hunting
  // through a whole domain. A server that would rather not ask turns it off.
  ticketResourcesRequired: true,
  // On: setting a provider's credentials is already a deliberate act, so its
  // button appears as soon as they exist. The switch is there to pull external
  // sign-in off the login screen without having to unset the credentials.
  passportEnabled: true,
  // Off: with a provider configured, anyone holding an address there could
  // otherwise walk into the manager. Turning it on is a deliberate act by a
  // root admin, for a deployment that wants open sign-up.
  passportAutoProvision: false,
  // A hundred kilometres: far enough that a commute, a holiday down the coast
  // or an ISP that moves a subscriber between two of its ranges is not a
  // challenge, close enough that another country always is.
  loginRadiusKm: 100,
  // The question first: every account has one, it is asked for and answered on
  // the spot, and it costs no outbound mail. The code stands in behind it, for
  // an account whose question a reset has just cleared.
  loginChallengeOrder: "question,email",
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
    const order = (spec: FieldSpec, fallback: LoginChallengeOrder): LoginChallengeOrder => {
      const raw = stored.get(spec.key);
      return raw !== undefined && isLoginChallengeOrder(raw) ? raw : fallback;
    };
    const bool = (spec: FieldSpec, fallback: boolean) => {
      const raw = stored.get(spec.key);
      return raw === undefined ? fallback : raw === "true";
    };
    this.cache = {
      offlineNotifyAfterMs: num(FIELDS.offlineNotifyAfterMs, APP_SETTINGS_DEFAULTS.offlineNotifyAfterMs),
      offlineSweepIntervalMs: num(FIELDS.offlineSweepIntervalMs, APP_SETTINGS_DEFAULTS.offlineSweepIntervalMs),
      mailMinIntervalMs: num(FIELDS.mailMinIntervalMs, APP_SETTINGS_DEFAULTS.mailMinIntervalMs),
      supervisionRetentionMs: num(FIELDS.supervisionRetentionMs, APP_SETTINGS_DEFAULTS.supervisionRetentionMs),
      managerUrl: str(FIELDS.managerUrl, APP_SETTINGS_DEFAULTS.managerUrl),
      ticketResourcesRequired: bool(FIELDS.ticketResourcesRequired, APP_SETTINGS_DEFAULTS.ticketResourcesRequired),
      passportEnabled: bool(FIELDS.passportEnabled, APP_SETTINGS_DEFAULTS.passportEnabled),
      passportAutoProvision: bool(FIELDS.passportAutoProvision, APP_SETTINGS_DEFAULTS.passportAutoProvision),
      loginRadiusKm: num(FIELDS.loginRadiusKm, APP_SETTINGS_DEFAULTS.loginRadiusKm),
      loginChallengeOrder: order(FIELDS.loginChallengeOrder, APP_SETTINGS_DEFAULTS.loginChallengeOrder),
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
