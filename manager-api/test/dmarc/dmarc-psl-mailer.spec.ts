import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, utimes, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { Readable } from "stream";
import { text } from "stream/consumers";
import * as nodemailer from "nodemailer";
import { DmarcPslService } from "../../src/core/dmarc/dmarc-psl.service";
import { DmarcMailerService } from "../../src/core/dmarc/dmarc-mailer.service";
import { providerMock } from "../helpers/mocks";

vi.mock("nodemailer", () => ({ createTransport: vi.fn() }));

describe("DmarcPslService", () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "dmarc-psl-"));
    file = join(dir, "public_suffix_list.dat");
    vi.stubEnv("DMARC_PSL_PATH", file);
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  it("reads the list the milter keeps, and reads it again once it changed", async () => {
    await writeFile(file, "com\n");
    const svc = new DmarcPslService();
    await expect(svc.organizationalDomain("mail.example.co.uk")).resolves.toBe("co.uk");

    await writeFile(file, "com\nuk\nco.uk\n");
    await utimes(file, new Date(), new Date(Date.now() + 60_000));
    await expect(svc.organizationalDomain("mail.example.co.uk")).resolves.toBe("example.co.uk");
  });

  it("keeps the last two labels when there is no list, or an empty one", async () => {
    const svc = new DmarcPslService();
    await expect(svc.organizationalDomain("a.b.example.com")).resolves.toBe("example.com");
    await writeFile(file, "// nothing\n");
    await expect(svc.organizationalDomain("a.b.example.com")).resolves.toBe("example.com");
  });
});

describe("DmarcMailerService", () => {
  const sendMail = vi.fn();

  beforeEach(() => {
    sendMail.mockReset().mockResolvedValue({});
    vi.mocked(nodemailer.createTransport).mockReturnValue(
      providerMock<ReturnType<typeof nodemailer.createTransport>>({ sendMail })
    );
  });
  afterEach(() => vi.unstubAllEnvs());

  it("hands the report to the local relay, plain and unauthenticated, gzip attached", async () => {
    vi.stubEnv("DMARC_SMTP_HOST", "172.200.0.17");
    vi.stubEnv("DMARC_SMTP_PORT", "25");
    await new DmarcMailerService().send({
      from: "dmarc-reports@example.org",
      fromName: "example.org",
      to: "dmarc@partner.example",
      subject: "Report Domain: partner.example",
      text: "body",
      filename: "r.xml.gz",
      content: Buffer.from([1, 2]),
    });
    expect(nodemailer.createTransport).toHaveBeenCalledWith({ host: "172.200.0.17", port: 25, secure: false, ignoreTLS: true });
    expect(sendMail).toHaveBeenCalledWith({
      from: { name: "example.org", address: "dmarc-reports@example.org" },
      to: "dmarc@partner.example",
      subject: "Report Domain: partner.example",
      text: "body",
      attachments: [{ filename: "r.xml.gz", content: Buffer.from([1, 2]), contentType: "application/gzip" }],
    });
  });

  it("defaults to the postfix container on port 25", async () => {
    delete process.env.DMARC_SMTP_HOST;
    delete process.env.DMARC_SMTP_PORT;
    await new DmarcMailerService().send({
      from: "a@b.c",
      fromName: "b.c",
      to: "d@e.f",
      subject: "s",
      text: "t",
      filename: "f",
      content: Buffer.alloc(0),
    });
    expect(nodemailer.createTransport).toHaveBeenLastCalledWith(expect.objectContaining({ host: "mail-postfix", port: 25 }));
  });

  describe("resending a mail", () => {
    let dir: string;
    let raw: Promise<string> | null;

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), "dmarc-resend-"));
      raw = null;
      sendMail.mockImplementation(async (options: { raw: Readable }) => {
        raw = text(options.raw);
        await raw;
        return {};
      });
    });
    afterEach(() => rm(dir, { recursive: true, force: true }));

    it("hands the mail to the relay as it is, from the reports mailbox, the Resent headers on top", async () => {
      const file = join(dir, "1789.M1.host");
      await writeFile(file, "From: a@google.com\nSubject: report\n\nbody\n");
      await new DmarcMailerService().resend(
        file,
        "dmarc_reports@example.org",
        "archive@example.org",
        new Date("2026-09-22T12:00:00Z")
      );

      expect(sendMail).toHaveBeenCalledWith({
        envelope: { from: "dmarc_reports@example.org", to: "archive@example.org" },
        raw: expect.any(Readable),
      });
      await expect(raw).resolves.toMatch(
        /^Resent-From: dmarc_reports@example\.org\nResent-To: archive@example\.org\nResent-Date: Tue, 22 Sep 2026 12:00:00 GMT\nResent-Message-ID: <[0-9a-f-]{36}@example\.org>\nFrom: a@google\.com\nSubject: report\n\nbody\n$/
      );
    });

    it("fails with the relay's refusal, and with a file that is gone", async () => {
      const file = join(dir, "1789.M1.host");
      await writeFile(file, "x");
      sendMail.mockRejectedValueOnce(Object.assign(new Error("550 5.7.1 no"), { responseCode: 550 }));
      await expect(new DmarcMailerService().resend(file, "dmarc_reports@example.org", "archive@example.org")).rejects.toThrow(
        "550 5.7.1 no"
      );
      await expect(
        new DmarcMailerService().resend(join(dir, "gone"), "dmarc_reports@example.org", "archive@example.org")
      ).rejects.toThrow("ENOENT");
    });
  });
});
