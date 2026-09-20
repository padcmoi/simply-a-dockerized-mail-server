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

// Written against the clock rather than at a fixed moment: a jail answers with
// the bans it still holds, and a fixture banned in 2023 for an hour is a row
// fail2ban has long let go of.
const SECONDS = Math.floor(Date.now() / 1000);
const RUNNING = SECONDS - 60;
const OLDER = SECONDS - 120;
const PERMANENT = SECONDS - 180;
const OVER = SECONDS - 7200;

beforeAll(() => {
  const db = new DatabaseSync(path);
  db.exec("CREATE TABLE jails (name TEXT NOT NULL UNIQUE, enabled INTEGER NOT NULL DEFAULT 1)");
  db.exec("CREATE TABLE bips (ip TEXT, jail TEXT, timeofban INTEGER, bantime INTEGER, bancount INTEGER, data JSON)");
  db.exec("CREATE TABLE bans (jail TEXT, ip TEXT, timeofban INTEGER, bantime INTEGER, bancount INTEGER, data JSON)");
  db.exec("INSERT INTO jails VALUES ('dovecot', 1), ('manager', 1), ('retired', 0)");
  db.exec(`INSERT INTO bips VALUES
    ('203.0.113.9', 'dovecot', ${OLDER}, 3600, 1, NULL),
    ('203.0.113.10', 'dovecot', ${RUNNING}, 3600, 1, NULL),
    ('203.0.113.55', 'dovecot', ${OVER}, 3600, 1, NULL),
    ('198.51.100.7', 'manager', ${PERMANENT}, -1, 1, NULL)`);
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

  // A ban whose hour is up is gone from the jail although fail2ban still holds
  // its row: what is counted is what is blocked.
  it("reads the addresses each jail bans right now, newest first, a permanent one with no end, the expired ones left out", () => {
    expect(service.bans().get("dovecot")).toEqual([
      { ip: "203.0.113.10", bannedAt: RUNNING * 1000, expiresAt: (RUNNING + 3600) * 1000 },
      { ip: "203.0.113.9", bannedAt: OLDER * 1000, expiresAt: (OLDER + 3600) * 1000 },
    ]);
    expect(service.bans().get("manager")).toEqual([{ ip: "198.51.100.7", bannedAt: PERMANENT * 1000, expiresAt: null }]);
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
