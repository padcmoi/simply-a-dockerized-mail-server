import { z } from "zod";

export const BACKUP_ARCHIVE_PATTERN = /^backup-\d{4}-\d{2}-\d{2}\.tar\.gz$/;
export const BACKUP_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const BACKUP_OFFSITE_PATTERN = /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:\/[A-Za-z0-9._/-]*$/;

const HOST_FOLDER = /^\/[^\0\r\n]*$/;
const PROJECT_FOLDER = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;

const archiveName = z.string().regex(BACKUP_ARCHIVE_PATTERN);
const text = (max: number) => z.string().max(max);

export const backupReportSchema = z.object({
  run: z.object({
    startedAt: z.iso.datetime(),
    finishedAt: z.iso.datetime(),
    result: z.enum(["success", "partial", "failed"]),
    step: z.enum(["check", "outage", "compress", "store", "offsite", "rotation", "done", "unknown"]),
    error: text(500),
    durationSeconds: z.number().int().min(0).max(864_000),
    outageSeconds: z.number().int().min(0).max(864_000),
    archive: z.union([archiveName, z.literal("")]),
    archiveBytes: z.number().int().min(0),
    storedIn: text(255),
    offsiteTarget: text(255),
    offsiteSent: z.boolean(),
    log: z.array(text(1000)).max(400),
  }),
  archivesDir: z.string().max(255).regex(HOST_FOLDER, "The archives folder must be a full path"),
  archivesProjectDir: z
    .string()
    .max(255)
    .refine((v) => v === "" || (PROJECT_FOLDER.test(v) && !v.split("/").some((part) => part === "." || part === "..")), {
      message: "The archives folder inside the project must be a plain relative path, or empty",
    }),
  localFiles: z.array(z.object({ name: archiveName, bytes: z.number().int().min(0), modifiedAt: z.iso.datetime() })).max(1000),
  offsiteDeleted: z.array(archiveName).max(1000),
});

export type BackupReportDto = z.infer<typeof backupReportSchema>;

export const backupConfigSchema = z.object({
  time: z.string().regex(BACKUP_TIME_PATTERN, "The time must be HH:MM, from 00:00 to 23:59"),
  keepDays: z.number().int().min(1).max(999),
  offsite: z
    .string()
    .trim()
    .max(255)
    .refine((v) => v === "" || BACKUP_OFFSITE_PATTERN.test(v), {
      message: "The off-site destination must be user@host:/path, or empty",
    }),
  offsiteDeleteLocal: z.boolean(),
});

export type BackupConfigDto = z.infer<typeof backupConfigSchema>;
