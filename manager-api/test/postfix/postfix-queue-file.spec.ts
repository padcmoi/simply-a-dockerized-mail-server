import { describe, it, expect } from "vitest";
import { parseDeferLog, parseQueueFile } from "../../src/core/postfix/postfix-queue-file";
import { queueFile, record } from "../helpers/postfix-queue";

describe("parseQueueFile", () => {
  it("reads arrival, size, sender and the pending recipients, skipping the content", () => {
    const env = parseQueueFile(queueFile({ sender: "a@example.com", recipients: ["b@example.org", "c@example.org"] }));
    expect(env).toEqual({
      arrival: 1790688555,
      size: 24,
      sender: "a@example.com",
      recipients: ["b@example.org", "c@example.org"],
    });
  });

  it("keeps the null sender of a notification as an empty string", () => {
    expect(parseQueueFile(queueFile({ sender: "", recipients: ["b@example.org"] })).sender).toBe("");
  });

  it("leaves out recipients already delivered", () => {
    const env = parseQueueFile(queueFile({ sender: "a@example.com", recipients: ["b@example.org"], done: ["done@example.org"] }));
    expect(env.recipients).toEqual(["b@example.org"]);
  });

  it("reads the recipients extracted after the content", () => {
    const env = parseQueueFile(queueFile({ sender: "a@example.com", recipients: [], extracted: ["x@example.org"] }));
    expect(env.recipients).toEqual(["x@example.org"]);
  });

  it("follows a pointer record to records appended at the end of the file", () => {
    const head = Buffer.concat([record("T", "100"), record("S", "a@example.com")]);
    const pointerAt = head.length;
    const pointerLength = record("p", "0".padStart(15)).length;
    const back = pointerAt + pointerLength;
    const tail = Buffer.concat([record("R", "late@example.org"), record("p", String(back).padStart(15))]);
    const middle = record("E", "");
    const tailAt = back + middle.length;
    const file = Buffer.concat([head, record("p", String(tailAt).padStart(15)), middle, tail]);
    expect(parseQueueFile(file).recipients).toEqual(["late@example.org"]);
  });

  it("stops on a pointer loop instead of spinning", () => {
    const selfAt = record("S", "a@example.com").length;
    const self = Buffer.concat([record("S", "a@example.com"), record("p", String(selfAt).padStart(15))]);
    expect(parseQueueFile(self)).toEqual({ arrival: null, size: null, sender: "a@example.com", recipients: [] });
  });

  it("returns what it read so far from a truncated file, the one Postfix is still writing", () => {
    const full = queueFile({ sender: "a@example.com", recipients: ["b@example.org"] });
    const cut = full.subarray(0, full.indexOf("b@example.org") + 3);
    const env = parseQueueFile(cut);
    expect(env.sender).toBe("a@example.com");
    expect(env.recipients).toEqual([]);
  });

  it("reads a length written on more than one byte", () => {
    const long = `${"x".repeat(200)}@example.org`;
    expect(parseQueueFile(Buffer.concat([record("R", long), record("E", "")])).recipients).toEqual([long]);
  });

  it("returns an empty envelope for an empty file", () => {
    expect(parseQueueFile(Buffer.alloc(0))).toEqual({ arrival: null, size: null, sender: null, recipients: [] });
  });
});

describe("parseDeferLog", () => {
  const block = (rcpt: string, reason: string) =>
    `<${rcpt}>: ${reason}\nrecipient=${rcpt}\noffset=269\ndsn_orig_rcpt=rfc822;${rcpt}\nstatus=4.4.1\naction=delayed\nreason=${reason}\n\n`;

  it("gives each recipient the status and reason of its block", () => {
    const log = parseDeferLog(block("a@example.org", "connect to mx: timed out") + block("b@example.org", "450 greylisted"));
    expect(log.get("a@example.org")).toEqual({ status: "4.4.1", reason: "connect to mx: timed out" });
    expect(log.get("b@example.org")).toEqual({ status: "4.4.1", reason: "450 greylisted" });
  });

  it("keeps the last attempt when a recipient was deferred more than once", () => {
    const log = parseDeferLog(block("a@example.org", "first") + block("a@example.org", "second"));
    expect(log.get("a@example.org")?.reason).toBe("second");
  });

  it("keeps an equals sign inside the reason", () => {
    expect(parseDeferLog(block("a@example.org", "said: 450 rate=exceeded")).get("a@example.org")?.reason).toBe(
      "said: 450 rate=exceeded"
    );
  });

  it("reads a last block with no trailing blank line and ignores a block without recipient", () => {
    const log = parseDeferLog("status=4.0.0\nreason=orphan\n\nrecipient=z@example.org\nreason=last");
    expect([...log.keys()]).toEqual(["z@example.org"]);
    expect(log.get("z@example.org")).toEqual({ status: null, reason: "last" });
  });
});
