export class PublicSuffixList {
  private readonly rules = new Set<string>();
  private readonly wildcards = new Set<string>();
  private readonly exceptions = new Set<string>();

  constructor(text: string) {
    for (const raw of text.split("\n")) {
      const rule = raw.trim().split(/\s/)[0]?.toLowerCase() ?? "";
      if (!rule || rule.startsWith("//")) continue;
      if (rule.startsWith("!")) this.exceptions.add(rule.slice(1));
      else if (rule.startsWith("*.")) this.wildcards.add(rule.slice(2));
      else this.rules.add(rule);
    }
  }

  get size() {
    return this.rules.size + this.wildcards.size + this.exceptions.size;
  }

  publicSuffix(domain: string): string {
    const labels = domain.toLowerCase().replace(/\.$/, "").split(".");
    for (let i = 0; i < labels.length; i += 1) {
      const candidate = labels.slice(i).join(".");
      if (this.exceptions.has(candidate)) return labels.slice(i + 1).join(".");
      const parent = labels.slice(i + 1).join(".");
      if (i + 1 < labels.length && this.wildcards.has(parent)) return candidate;
      if (this.rules.has(candidate)) return candidate;
    }
    return labels[labels.length - 1] ?? "";
  }

  organizationalDomain(domain: string): string {
    const clean = domain.toLowerCase().replace(/\.$/, "");
    const suffix = this.publicSuffix(clean);
    if (!suffix || clean === suffix) return clean;
    const labels = clean.slice(0, clean.length - suffix.length - 1).split(".");
    return `${labels[labels.length - 1]}.${suffix}`;
  }
}
