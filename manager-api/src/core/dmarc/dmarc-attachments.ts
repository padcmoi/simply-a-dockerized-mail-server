import { gunzipSync, unzipSync } from "fflate";
import PostalMime from "postal-mime";

const MAX_XML_BYTES = 50 * 1024 * 1024;

function isGzip(bytes: Uint8Array) {
  return bytes[0] === 0x1f && bytes[1] === 0x8b;
}

function isZip(bytes: Uint8Array) {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function looksLikeXml(value: string) {
  return /^\s*(<\?xml[^>]*>\s*)?<(\w+:)?feedback[\s>]/.test(value);
}

function decode(bytes: Uint8Array): string | null {
  if (bytes.length > MAX_XML_BYTES) return null;
  const value = new TextDecoder("utf-8").decode(bytes);
  return looksLikeXml(value) ? value : null;
}

export function xmlDocumentsIn(bytes: Uint8Array): string[] {
  if (isGzip(bytes)) {
    const unpacked = gunzipSync(bytes);
    const xml = decode(unpacked);
    return xml ? [xml] : [];
  }
  if (isZip(bytes)) {
    const files = unzipSync(bytes, { filter: (file) => file.originalSize <= MAX_XML_BYTES });
    return Object.values(files)
      .map(decode)
      .filter((xml): xml is string => xml !== null);
  }
  const xml = decode(bytes);
  return xml ? [xml] : [];
}

export interface DmarcMessage {
  messageId: string | null;
  from: string | null;
  subject: string | null;
  documents: string[];
}

export async function readDmarcMessage(raw: Uint8Array): Promise<DmarcMessage> {
  const email = await PostalMime.parse(raw);
  const documents: string[] = [];
  for (const attachment of email.attachments) {
    const content =
      typeof attachment.content === "string" ? new TextEncoder().encode(attachment.content) : new Uint8Array(attachment.content);
    try {
      documents.push(...xmlDocumentsIn(content));
    } catch {
      continue;
    }
  }
  if (!documents.length && email.text && looksLikeXml(email.text)) documents.push(email.text);

  return { messageId: email.messageId ?? null, from: email.from?.address ?? null, subject: email.subject ?? null, documents };
}
