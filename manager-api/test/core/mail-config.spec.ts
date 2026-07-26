import { describe, it, expect } from "vitest";
import { rowToConfig } from "../../src/core/mailer/providers";
import { MailSetting } from "../../src/core/entities/mail-setting.entity";
import { entity } from "../helpers/mocks";

const row = (p: Partial<MailSetting>) =>
  entity<MailSetting>({
    provider: "",
    host: null,
    port: null,
    secure: 0,
    username: null,
    password: null,
    fromAddress: null,
    selected: null,
    validated: 0,
    otp: null,
    updatedAt: new Date(0),
    ...p,
  });

describe("rowToConfig", () => {
  it("a null row is disabled", () => {
    expect(rowToConfig(null).enabled).toBe(false);
  });

  it("an empty provider is disabled", () => {
    expect(rowToConfig(row({ provider: "" })).enabled).toBe(false);
  });

  it("an unknown provider is disabled", () => {
    expect(rowToConfig(row({ provider: "sendmail", host: "x" })).enabled).toBe(false);
  });

  it("brevo without credentials is disabled but exposes the preset relay", () => {
    const c = rowToConfig(row({ provider: "brevo" }));
    expect(c.enabled).toBe(false);
    expect(c.host).toBe("smtp-relay.brevo.com");
    expect(c.port).toBe(587);
  });

  it("brevo with a username is enabled, with the preset host, auth and verified sender", () => {
    const c = rowToConfig(row({ provider: "brevo", username: "u", password: "k", fromAddress: "s@d.test" }));
    expect(c.enabled).toBe(true);
    expect(c.host).toBe("smtp-relay.brevo.com");
    expect(c.auth).toEqual({ user: "u", pass: "k" });
    expect(c.from).toBe("s@d.test");
  });

  it("smtp with a host is enabled, credentials optional (auth-less relay)", () => {
    const c = rowToConfig(row({ provider: "smtp", host: "mail-postfix", port: 25 }));
    expect(c.enabled).toBe(true);
    expect(c.host).toBe("mail-postfix");
    expect(c.port).toBe(25);
    expect(c.auth).toBeUndefined();
  });

  it("smtp without a host is disabled", () => {
    expect(rowToConfig(row({ provider: "smtp" })).enabled).toBe(false);
  });

  it("derives implicit TLS from the port (465 = direct TLS, otherwise STARTTLS)", () => {
    expect(rowToConfig(row({ provider: "smtp", host: "h", port: 465 })).secure).toBe(true);
    expect(rowToConfig(row({ provider: "smtp", host: "h", port: 587 })).secure).toBe(false);
    expect(rowToConfig(row({ provider: "smtp", host: "h", port: 25 })).secure).toBe(false);
  });

  it("demands STARTTLS on an authenticated non-implicit-TLS server (any secure server worldwide)", () => {
    const c = rowToConfig(row({ provider: "smtp", host: "h", port: 587, username: "u", password: "p" }));
    expect(c.secure).toBe(false);
    expect(c.requireTLS).toBe(true);
  });

  it("uses implicit TLS on 465 without a STARTTLS requirement", () => {
    const c = rowToConfig(row({ provider: "smtp", host: "h", port: 465, username: "u", password: "p" }));
    expect(c.secure).toBe(true);
    expect(c.requireTLS).toBe(false);
  });
});
