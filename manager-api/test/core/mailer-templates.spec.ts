import { describe, it, expect } from "vitest";
import { invitationEmail } from "../../src/core/mailer/templates/invitation.template";
import { notificationHtml } from "../../src/core/mailer/templates/notification-layout.template";
import { pendingNotificationsEmail } from "../../src/core/mailer/templates/pending-notifications.template";

describe("invitationEmail", () => {
  it("names the groups in both the text and the HTML", () => {
    const mail = invitationEmail({ link: "https://link", groupNames: ["Admins", "Support"] });
    expect(mail.subject).toBe("Invitation to manage the mail server");
    expect(mail.text).toContain("groups: Admins, Support");
    expect(mail.text).toContain("https://link");
    expect(mail.html).toContain("<code>Admins, Support</code>");
    expect(mail.html).toContain('href="https://link"');
  });

  it("uses the no-group wording when there are none", () => {
    const mail = invitationEmail({ link: "https://link", groupNames: [] });
    expect(mail.text).toContain("no group (no permissions until assigned)");
    expect(mail.html).toContain("no group (no permissions until assigned)");
  });
});

describe("notificationHtml", () => {
  it("wraps the text in a paragraph and turns line breaks into <br>", () => {
    expect(notificationHtml("a\nb")).toBe("<p>a<br>b</p>");
  });
});

describe("pendingNotificationsEmail", () => {
  it("is a generic, content-free pending-notifications summary", () => {
    const mail = pendingNotificationsEmail();
    expect(mail.subject).toBe("You have pending notifications");
    expect(mail.text).toContain("one or more notifications");
  });

  it("adds a button linking to the manager when a URL is passed", () => {
    const mail = pendingNotificationsEmail("https://mgr.test/");
    expect(mail.html).toContain('href="https://mgr.test"');
    expect(mail.html).toContain("Open the manager");
    expect(mail.text).toContain("https://mgr.test");
  });

  it("has no button when neither a URL nor MANAGER_UI_URL is set", () => {
    const prev = process.env.MANAGER_UI_URL;
    delete process.env.MANAGER_UI_URL;
    try {
      const mail = pendingNotificationsEmail();
      expect(mail.html).not.toContain("Open the manager");
    } finally {
      if (prev !== undefined) process.env.MANAGER_UI_URL = prev;
    }
  });

  it("adds a button linking to the manager when MANAGER_UI_URL is set", () => {
    const prev = process.env.MANAGER_UI_URL;
    process.env.MANAGER_UI_URL = "https://manager.test/";
    try {
      const mail = pendingNotificationsEmail();
      expect(mail.html).toContain('href="https://manager.test"');
      expect(mail.html).toContain("Open the manager");
    } finally {
      if (prev === undefined) delete process.env.MANAGER_UI_URL;
      else process.env.MANAGER_UI_URL = prev;
    }
  });
});
