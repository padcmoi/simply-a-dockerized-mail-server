import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "os";
import { join } from "path";
import { ConfigService } from "@nestjs/config";
import { Fail2banDbService } from "../../src/core/fail2ban/fail2ban-db.service";

const directory = mkdtempSync(join(tmpdir(), "fail2ban-db-"));
const path = join(directory, "fail2ban.sqlite3");
const service = new Fail2banDbService(new ConfigService({ FAIL2BAN_DATABASE: path }));
const missing = new Fail2banDbService(new ConfigService({ FAIL2BAN_DATABASE: join(directory, "nothing.sqlite3") }));

beforeAll(() => {
  const db = new DatabaseSync(path);
  db.exec("CREATE TABLE jails (name TEXT NOT NULL UNIQUE, enabled INTEGER NOT NULL DEFAULT 1)");
  db.exec("CREATE TABLE bips (ip TEXT, jail TEXT, timeofban INTEGER, bantime INTEGER, bancount INTEGER, data JSON)");
  db.exec("CREATE TABLE bans (jail TEXT, ip TEXT, timeofban INTEGER, bantime INTEGER, bancount INTEGER, data JSON)");
  db.exec("INSERT INTO jails VALUES ('dovecot', 1), ('manager', 1), ('retired', 0)");
  db.exec(`INSERT INTO bips VALUES
    ('203.0.113.9', 'dovecot', 1700000000, 3600, 1, NULL),
    ('203.0.113.10', 'dovecot', 1700000060, 3600, 1, NULL),
    ('198.51.100.7', 'manager', 1700000100, -1, 1, NULL)`);
  db.exec(`INSERT INTO bans VALUES
    ('dovecot', '203.0.113.9', 1700000000, 3600, 2, '{"matches": [["a", "b"], "c"], "failures": 5}'),
    ('dovecot', '203.0.113.10', 1700000060, 3600, 1, 'not json'),
    ('manager', '198.51.100.7', 1700000100, -1, 1, NULL)`);
  db.close();
});
afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe("Fail2banDbService", () => {
  it("lists the jails fail2ban has enabled, in order", () => {
    expect(service.jails()).toEqual(["dovecot", "manager"]);
  });

  it("reads the addresses each jail bans right now, newest first, a permanent one with no end", () => {
    expect(service.bans().get("dovecot")).toEqual([
      { ip: "203.0.113.10", bannedAt: 1700000060000, expiresAt: 1700003660000 },
      { ip: "203.0.113.9", bannedAt: 1700000000000, expiresAt: 1700003600000 },
    ]);
    expect(service.bans().get("manager")).toEqual([{ ip: "198.51.100.7", bannedAt: 1700000100000, expiresAt: null }]);
  });

  it("counts the bans each jail still has a record of", () => {
    expect(service.recentBans()).toEqual(
      new Map([
        ["dovecot", 2],
        ["manager", 1],
      ])
    );
  });

  it("reads the history with the log lines behind each ban, and survives a row whose data is not json", () => {
    const history = service.history();
    expect(history[0]).toEqual({
      jail: "manager",
      ip: "198.51.100.7",
      bannedAt: 1700000100000,
      expiresAt: null,
      banCount: 1,
      failures: 0,
      matches: [],
    });
    expect(history[1]).toMatchObject({ ip: "203.0.113.10", matches: [], failures: 0 });
    expect(history[2]).toMatchObject({ ip: "203.0.113.9", banCount: 2, failures: 5, matches: ["ab", "c"] });
  });

  it("answers empty everywhere while the database is not there", () => {
    expect(missing.jails()).toEqual([]);
    expect(missing.bans()).toEqual(new Map());
    expect(missing.recentBans()).toEqual(new Map());
    expect(missing.history()).toEqual([]);
  });

  it("answers empty rather than throwing when the file is not a database", () => {
    const broken = join(directory, "broken.sqlite3");
    writeFileSync(broken, "not a database");
    expect(new Fail2banDbService(new ConfigService({ FAIL2BAN_DATABASE: broken })).jails()).toEqual([]);
  });
});
