export interface QueueFileEnvelope {
  arrival: number | null;
  size: number | null;
  sender: string | null;
  recipients: string[];
}

export interface DeferredRecipient {
  status: string | null;
  reason: string | null;
}

const MAX_JUMPS = 1000;

export function parseQueueFile(buf: Buffer): QueueFileEnvelope {
  const envelope: QueueFileEnvelope = { arrival: null, size: null, sender: null, recipients: [] };
  const visited = new Set<number>();
  let dataSize = -1;
  let dataOffset = -1;
  let pos = 0;

  while (pos < buf.length) {
    const type = String.fromCharCode(buf[pos++]);
    let length = 0;
    let shift = 0;
    let byte: number;
    do {
      if (pos >= buf.length || shift > 28) return envelope;
      byte = buf[pos++];
      length |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80);
    if (pos + length > buf.length) return envelope;
    const data = buf.subarray(pos, pos + length).toString("utf8");
    pos += length;

    switch (type) {
      case "C": {
        const fields = data.trim().split(/\s+/).map(Number);
        dataSize = Number.isFinite(fields[0]) ? fields[0] : -1;
        dataOffset = Number.isFinite(fields[1]) ? fields[1] : -1;
        envelope.size = dataSize >= 0 ? dataSize : null;
        break;
      }
      case "T": {
        const seconds = Number(data.trim().split(/\s+/)[0]);
        envelope.arrival = Number.isFinite(seconds) ? seconds : null;
        break;
      }
      case "S":
        envelope.sender = data;
        break;
      case "R":
        envelope.recipients.push(data);
        break;
      case "p": {
        const offset = Number(data.trim());
        if (offset > 0) {
          if (visited.has(offset) || visited.size >= MAX_JUMPS || offset >= buf.length) return envelope;
          visited.add(offset);
          pos = offset;
        }
        break;
      }
      case "M":
        if (dataOffset < 0 || dataSize < 0) return envelope;
        pos = dataOffset + dataSize;
        break;
      case "E":
        return envelope;
    }
  }
  return envelope;
}

export function parseDeferLog(text: string): Map<string, DeferredRecipient> {
  const recipients = new Map<string, DeferredRecipient>();
  let block = new Map<string, string>();
  const commit = () => {
    const address = block.get("recipient");
    if (address !== undefined)
      recipients.set(address, { status: block.get("status") ?? null, reason: block.get("reason") ?? null });
    block = new Map();
  };
  for (const line of text.split("\n")) {
    if (line === "") {
      commit();
      continue;
    }
    const eq = line.indexOf("=");
    if (eq > 0 && !line.startsWith("<")) block.set(line.slice(0, eq), line.slice(eq + 1));
  }
  commit();
  return recipients;
}
