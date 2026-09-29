export interface PostfixSettings {
  bounceSenderLocal: string;
  bounceSenderDomain: string;
  delayWarningHours: number;
  maximalQueueLifetimeDays: number;
}

export type PostfixApplyState = "applied" | "pending" | "error" | "unknown";

export interface PostfixApplyStatus {
  state: PostfixApplyState;
  appliedVersion: number | null;
  appliedAt: string | null;
  checkedAt: string | null;
  error: string | null;
}

export interface PostfixSettingsView {
  settings: PostfixSettings;
  version: number;
  hostname: string;
  domains: string[];
  status: PostfixApplyStatus;
}
