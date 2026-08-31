// The server-wide configuration views the settings pages read and write.

export type MailProvider = "brevo" | "smtp" | "off";

export interface ConfigView {
  provider: string;
  host: string | null;
  port: number | null;
  secure: boolean;
  username: string | null;
  fromAddress: string | null;
  hasPassword: boolean;
  validated: boolean;
}

export interface ListView {
  configs: ConfigView[];
  selected: string | null;
}

export interface CadenceView {
  offlineNotifyAfterMs: number;
  offlineSweepIntervalMs: number;
  mailMinIntervalMs: number;
}

export interface GeneralView {
  managerUrl: string;
}
