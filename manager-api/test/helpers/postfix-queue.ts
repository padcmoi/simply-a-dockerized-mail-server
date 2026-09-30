export function record(type: string, data: string | Buffer): Buffer {
  const body = typeof data === "string" ? Buffer.from(data) : data;
  const length: number[] = [];
  let n = body.length;
  do {
    let byte = n & 0x7f;
    n >>= 7;
    if (n) byte |= 0x80;
    length.push(byte);
  } while (n);
  return Buffer.concat([Buffer.from(type), Buffer.from(length), body]);
}

function sizeRecord(dataSize: number, dataOffset: number, rcpts: number) {
  return record("C", [dataSize, dataOffset, rcpts, 0, dataSize].map((v) => String(v).padStart(15)).join(" "));
}

export function queueFile(opts: {
  sender: string;
  recipients: string[];
  extracted?: string[];
  done?: string[];
  arrival?: number;
}) {
  const content = Buffer.concat([record("N", "Subject: test"), record("N", ""), record("N", "Body.")]);
  const envelope = (offset: number) =>
    Buffer.concat([
      sizeRecord(content.length, offset, opts.recipients.length),
      record("T", `${opts.arrival ?? 1790688555} 570083`),
      record("A", "create_time=1790688555"),
      record("S", opts.sender),
      ...(opts.done ?? []).map((r) => record("D", r)),
      ...opts.recipients.flatMap((r) => [record("O", r), record("R", r)]),
      record("p", "0".padStart(15)),
      record("M", ""),
    ]);
  const head = envelope(envelope(0).length);
  return Buffer.concat([head, content, record("X", ""), ...(opts.extracted ?? []).map((r) => record("R", r)), record("E", "")]);
}
