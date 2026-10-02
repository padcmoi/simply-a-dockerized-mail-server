import { access, mkdir, readFile, rename, writeFile } from "fs/promises";
import { join } from "path";

export const BACKUP_MANAGED_PATH = "/var/lib/backup-managed";

export function managedFileExists(dir: string, name: string) {
  return access(join(dir, name)).then(
    () => true,
    () => false
  );
}

export async function readManagedFile(dir: string, name: string): Promise<Record<string, string> | null> {
  const raw = await readFile(join(dir, name), "utf8").catch(() => null);
  if (raw === null) return null;
  const values: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

export async function writeManagedFile(dir: string, name: string, lines: string[]) {
  await mkdir(dir, { recursive: true });
  const tmp = join(dir, `.${name}.tmp`);
  await writeFile(tmp, `${lines.join("\n")}\n`, { mode: 0o644 });
  await rename(tmp, join(dir, name));
}
