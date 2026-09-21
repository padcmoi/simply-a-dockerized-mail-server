import { Injectable } from "@nestjs/common";
import { readFile, stat } from "fs/promises";
import { PublicSuffixList } from "./public-suffix-list";

function fallbackOrganizationalDomain(domain: string) {
  return domain.toLowerCase().split(".").slice(-2).join(".");
}

@Injectable()
export class DmarcPslService {
  private list: PublicSuffixList | null = null;
  private loadedMtime = 0;

  private path() {
    return process.env.DMARC_PSL_PATH ?? "/var/lib/opendmarc/public_suffix_list.dat";
  }

  private async load(): Promise<PublicSuffixList | null> {
    try {
      const { mtimeMs } = await stat(this.path());
      if (!this.list || mtimeMs !== this.loadedMtime) {
        const list = new PublicSuffixList(await readFile(this.path(), "utf8"));
        this.list = list.size ? list : null;
        this.loadedMtime = mtimeMs;
      }
    } catch {
      this.list = null;
    }
    return this.list;
  }

  async organizationalDomain(domain: string): Promise<string> {
    const list = await this.load();
    return list ? list.organizationalDomain(domain) : fallbackOrganizationalDomain(domain);
  }
}
