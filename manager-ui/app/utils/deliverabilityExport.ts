// Two shapes, because two readers. JSON keeps every field for a script, a
// ticket attachment or a diff between two runs; the text report is what a human
// pastes into a mail to a host or a registrar - it carries the evidence and the
// action to take, in the reader's own language, with no interface around it.

export function reportAsJson(report: DeliverabilityReport) {
  return JSON.stringify(report, null, 2);
}

export interface ReportLabels {
  title: string;
  sections: Record<string, string>;
  status: Record<string, string>;
  label: (id: string) => string;
  hint: (id: string) => string | null;
  checkedAt: string;
}

export function reportAsText(report: DeliverabilityReport, labels: ReportLabels) {
  const lines: string[] = [];
  lines.push(`# ${labels.title} - ${report.domain}`, "");
  lines.push(`${labels.checkedAt}`);
  if (report.mxHost) lines.push(`MX: ${report.mxHost}${report.mailIp ? ` (${report.mailIp})` : ""}`);
  lines.push(
    "",
    Object.entries(report.counts)
      .map(([status, count]) => `${labels.status[status] ?? status}: ${count}`)
      .join("  |  "),
    ""
  );

  for (const [section, title] of Object.entries(labels.sections)) {
    const checks = report.checks.filter((c) => c.section === section);
    if (!checks.length) continue;
    lines.push(`## ${title}`, "");
    for (const check of checks) {
      lines.push(`[${(labels.status[check.status] ?? check.status).toUpperCase()}] ${labels.label(check.id)}`);
      if (check.evidence) lines.push(`    ${check.evidence}`);
      // The fix only rides along where it is due: a passing check needs no
      // instruction, and a report full of advice nobody has to follow is a
      // report nobody reads.
      const hint = check.status === "pass" ? null : labels.hint(check.id);
      if (hint) lines.push(`    -> ${hint}`);
      lines.push("");
    }
  }
  // CRLF, for the same reason as the BOM: this file is opened by whatever the
  // reader has, and a lone LF is still one long line in some Windows editors.
  return lines.join("\r\n");
}

// A Blob always encodes a string as UTF-8, so the bytes were already right -
// what was missing is the marker that says so. Without it, an editor that
// defaults to a legacy 8 bit codepage (Notepad, Excel, plenty of Windows
// tooling) reads "délivrabilité" as "dÃ©livrabilitÃ©". The BOM goes on the text
// report only: JSON parsers are entitled to reject one (RFC 8259), so the
// machine-readable shape stays byte-clean.
export function downloadReport(content: string, filename: string, mime: string) {
  const body = mime === "application/json" ? content : `\ufeff${content}`;
  const url = URL.createObjectURL(new Blob([body], { type: `${mime};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function reportFilename(domain: string, checkedAt: string, extension: string) {
  const stamp = checkedAt.slice(0, 19).replace(/[:T]/g, "-");
  return `deliverability-${domain}-${stamp}.${extension}`;
}
