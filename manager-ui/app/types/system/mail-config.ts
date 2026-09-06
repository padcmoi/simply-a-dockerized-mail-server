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

/** Which of the two proofs a far-away sign-in is offered first. The
 *  authenticator app is in neither: it always comes first, and alone. */
export type LoginChallengeOrder = "email,question" | "question,email";

export interface LoginRiskView {
  // How far a sign-in may be from where the account usually signs in before it
  // is asked for more than a password. Zero turns the check off.
  loginRadiusKm: number;
  loginChallengeOrder: LoginChallengeOrder;
}
