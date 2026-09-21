import { describe, it, expect } from "vitest";
import { gzipSync, strToU8, zipSync } from "fflate";
import { readDmarcMessage, xmlDocumentsIn } from "../../src/core/dmarc/dmarc-attachments";
import { GOOGLE_REPORT, mimeMessage } from "./fixtures";

describe("xmlDocumentsIn", () => {
  it("unpacks a gzip report", () => {
    expect(xmlDocumentsIn(gzipSync(strToU8(GOOGLE_REPORT)))).toEqual([GOOGLE_REPORT]);
  });

  it("unpacks every report of a zip, leaving out what is not one", () => {
    const zip = zipSync({ "a.xml": strToU8(GOOGLE_REPORT), "readme.txt": strToU8("hello") });
    expect(xmlDocumentsIn(zip)).toEqual([GOOGLE_REPORT]);
  });

  it("takes a plain XML report as it is", () => {
    expect(xmlDocumentsIn(strToU8(GOOGLE_REPORT))).toEqual([GOOGLE_REPORT]);
  });

  it("finds nothing in something else", () => {
    expect(xmlDocumentsIn(strToU8("%PDF-1.7"))).toEqual([]);
    expect(xmlDocumentsIn(gzipSync(strToU8("not xml")))).toEqual([]);
  });
});

describe("readDmarcMessage", () => {
  it("finds the report in a zipped attachment, with the message's own headers", async () => {
    const zip = zipSync({ "google.com!example.com!1789862400!1789948799.xml": strToU8(GOOGLE_REPORT) });
    const message = await readDmarcMessage(mimeMessage({ filename: "report.zip", type: "application/zip", content: zip }));
    expect(message).toEqual({
      messageId: "<report-1@google.com>",
      from: "noreply-dmarc-support@google.com",
      subject: "Report domain: example.com Submitter: google.com Report-ID: 12345678901234567890",
      documents: [GOOGLE_REPORT],
    });
  });

  it("finds the report in a gzip attachment", async () => {
    const message = await readDmarcMessage(
      mimeMessage({ filename: "report.xml.gz", type: "application/gzip", content: gzipSync(strToU8(GOOGLE_REPORT)) })
    );
    expect(message.documents).toHaveLength(1);
  });

  it("skips an attachment it cannot unpack and finds nothing in an ordinary message", async () => {
    const broken = new Uint8Array([0x1f, 0x8b, 0x00, 0x01, 0x02]);
    const message = await readDmarcMessage(mimeMessage({ filename: "broken.gz", type: "application/gzip", content: broken }));
    expect(message.documents).toEqual([]);
    expect((await readDmarcMessage(mimeMessage(null))).documents).toEqual([]);
  });

  it("takes a report written in the body of the message", async () => {
    const message = await readDmarcMessage(mimeMessage(null, GOOGLE_REPORT.trim()));
    expect(message.documents).toHaveLength(1);
  });
});
