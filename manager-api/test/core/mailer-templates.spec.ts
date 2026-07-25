import { describe, it, expect } from "vitest";
import { invitationEmail } from "../../src/core/mailer/templates/invitation.template";
import { notificationHtml } from "../../src/core/mailer/templates/notification-layout.template";
import { supportNotificationEmail } from "../../src/core/mailer/templates/support-notification.template";

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

describe("supportNotificationEmail", () => {
  const base = { subject: "Broken login", domainName: "example.com", actor: "Alice", ticketUrl: "https://host/tickets/7" };

  it("prefixes the subject and appends the ticket link", () => {
    const mail = supportNotificationEmail({ type: "ticket-created", ...base });
    expect(mail.subject).toBe("[Support] Broken login");
    expect(mail.text).toContain("Ticket: https://host/tickets/7");
    expect(mail.html).toBe(notificationHtml(mail.text));
  });

  it("phrases each event type", () => {
    expect(supportNotificationEmail({ type: "ticket-created", ...base }).text).toContain(
      'Alice opened the support ticket "Broken login" on example.com.'
    );
    expect(supportNotificationEmail({ type: "ticket-replied", ...base }).text).toContain("Alice replied to the support ticket");
    expect(supportNotificationEmail({ type: "ticket-taken", ...base }).text).toContain("Alice took charge of the support ticket");
    expect(supportNotificationEmail({ type: "ticket-status", ...base, status: "resolved" }).text).toContain(
      'The support ticket "Broken login" on example.com is now "resolved".'
    );
  });

  it("falls back to 'Someone' and drops the domain clause when absent", () => {
    const mail = supportNotificationEmail({ type: "ticket-created", subject: "S", domainName: null, actor: null, ticketUrl: "u" });
    expect(mail.text).toContain('Someone opened the support ticket "S".');
    expect(mail.text).not.toContain(" on ");
  });
});
