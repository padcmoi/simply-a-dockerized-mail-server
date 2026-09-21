export const GOOGLE_REPORT = `<?xml version="1.0" encoding="UTF-8" ?>
<feedback>
  <report_metadata>
    <org_name>google.com</org_name>
    <email>noreply-dmarc-support@google.com</email>
    <extra_contact_info>https://support.google.com/a/answer/2466580</extra_contact_info>
    <report_id>12345678901234567890</report_id>
    <date_range>
      <begin>1789862400</begin>
      <end>1789948799</end>
    </date_range>
  </report_metadata>
  <policy_published>
    <domain>example.com</domain>
    <adkim>r</adkim>
    <aspf>s</aspf>
    <p>quarantine</p>
    <sp>reject</sp>
    <pct>100</pct>
  </policy_published>
  <record>
    <row>
      <source_ip>203.0.113.5</source_ip>
      <count>17</count>
      <policy_evaluated>
        <disposition>none</disposition>
        <dkim>pass</dkim>
        <spf>pass</spf>
      </policy_evaluated>
    </row>
    <identifiers>
      <header_from>Example.com</header_from>
    </identifiers>
    <auth_results>
      <dkim>
        <domain>example.com</domain>
        <selector>dkim202602</selector>
        <result>pass</result>
      </dkim>
      <spf>
        <domain>example.com</domain>
        <result>pass</result>
      </spf>
    </auth_results>
  </record>
  <record>
    <row>
      <source_ip>198.51.100.7</source_ip>
      <count>2</count>
      <policy_evaluated>
        <disposition>quarantine</disposition>
        <dkim>fail</dkim>
        <spf>fail</spf>
        <reason>
          <type>forwarded</type>
          <comment>looks forwarded</comment>
        </reason>
      </policy_evaluated>
    </row>
    <identifiers>
      <envelope_to>someone@gmail.com</envelope_to>
      <envelope_from>Bounce.Spam.test</envelope_from>
      <header_from>example.com</header_from>
    </identifiers>
    <auth_results>
      <dkim>
        <domain>spam.test</domain>
        <result>fail</result>
      </dkim>
      <dkim>
        <domain>relay.test</domain>
        <selector>r1</selector>
        <result>pass</result>
      </dkim>
      <spf>
        <domain>bounce.spam.test</domain>
        <scope>mfrom</scope>
        <result>softfail</result>
      </spf>
    </auth_results>
  </record>
</feedback>
`;

export function mimeMessage(
  attachment: { filename: string; type: string; content: Uint8Array } | null,
  body = "Report attached."
) {
  const boundary = "b-1234567890";
  const lines = [
    "From: DMARC Reports <noreply-dmarc-support@google.com>",
    "To: dmarc@example.com",
    "Subject: Report domain: example.com Submitter: google.com Report-ID: 12345678901234567890",
    "Message-ID: <report-1@google.com>",
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ];
  if (attachment) {
    lines.push(
      `--${boundary}`,
      `Content-Type: ${attachment.type}; name="${attachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      "",
      ...(Buffer.from(attachment.content)
        .toString("base64")
        .match(/.{1,76}/g) ?? [])
    );
  }
  lines.push(`--${boundary}--`, "");
  return new TextEncoder().encode(lines.join("\r\n"));
}
