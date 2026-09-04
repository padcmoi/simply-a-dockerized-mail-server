// A QR code encoder, byte mode, for the one thing the interface draws one for:
// the otpauth URI an authenticator app scans. Written here rather than pulled
// in: the algorithm is fixed by the standard (ISO 18004), a dependency would be
// a hundred times this file for the same square, and the image that carries a
// TOTP secret is drawn from code this repository can read.
//
// `qrModules(text)` answers the matrix, `qrSvgPath(modules)` an SVG path of the
// dark cells, which is what the component draws. Error correction level M,
// versions 1 to 40, mask chosen by the standard's penalty score.

type Bit = 0 | 1;
type Matrix = Bit[][];

const EC_LEVEL_M = 0;
// Per version: total codewords, then EC codewords per block and block count for
// level M (ISO 18004 table 9), which is all this encoder ever uses.
const VERSIONS: [total: number, ecPerBlock: number, blocks: number][] = [
  [26, 10, 1],
  [44, 16, 1],
  [70, 26, 1],
  [100, 18, 2],
  [134, 24, 2],
  [172, 16, 4],
  [196, 18, 4],
  [242, 22, 4],
  [292, 22, 5],
  [346, 26, 5],
  [404, 30, 5],
  [466, 22, 8],
  [532, 22, 9],
  [581, 24, 9],
  [655, 24, 10],
  [733, 28, 10],
  [815, 28, 11],
  [901, 26, 13],
  [991, 26, 14],
  [1085, 26, 16],
  [1156, 26, 17],
  [1258, 28, 17],
  [1364, 28, 18],
  [1474, 28, 20],
  [1588, 28, 21],
  [1706, 28, 23],
  [1828, 28, 25],
  [1921, 28, 26],
  [2051, 28, 28],
  [2185, 28, 29],
  [2323, 28, 31],
  [2465, 28, 33],
  [2611, 28, 35],
  [2761, 28, 37],
  [2876, 28, 38],
  [3034, 28, 40],
  [3196, 28, 43],
  [3362, 28, 45],
  [3532, 28, 47],
  [3706, 28, 49],
];

function versionInfo(version: number) {
  const info = VERSIONS[version - 1];
  if (!info) throw new Error(`QR version ${version} does not exist`);
  return info;
}

function size(version: number) {
  return version * 4 + 17;
}

function dataCodewords(version: number) {
  const [total, ecPerBlock, blocks] = versionInfo(version);
  return total - ecPerBlock * blocks;
}

// Byte mode: mode indicator, count (8 bits up to version 9, 16 after), data.
function bitsNeeded(version: number, bytes: number) {
  return 4 + (version <= 9 ? 8 : 16) + bytes * 8;
}

function smallestVersion(bytes: number) {
  for (let version = 1; version <= 40; version += 1) {
    if (bitsNeeded(version, bytes) <= dataCodewords(version) * 8) return version;
  }
  throw new Error("Too much data for a QR code");
}

function cell(modules: Matrix, row: number, col: number) {
  return modules[row]?.[col] ?? 0;
}

function setCell(modules: Matrix, row: number, col: number, value: Bit) {
  const line = modules[row];
  if (line && col >= 0 && col < line.length) line[col] = value;
}

// Galois field GF(256) with the QR polynomial 0x11d, for the Reed-Solomon
// error correction.
const EXP: number[] = [];
const LOG: number[] = new Array<number>(256).fill(0);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255] ?? 0;
})();

function multiply(a: number, b: number) {
  return a === 0 || b === 0 ? 0 : (EXP[(LOG[a] ?? 0) + (LOG[b] ?? 0)] ?? 0);
}

function generatorPolynomial(degree: number) {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array<number>(poly.length + 1).fill(0);
    poly.forEach((coefficient, j) => {
      next[j] = (next[j] ?? 0) ^ coefficient;
      next[j + 1] = (next[j + 1] ?? 0) ^ multiply(coefficient, EXP[i] ?? 0);
    });
    poly = next;
  }
  return poly;
}

function errorCorrection(data: number[], degree: number) {
  const generator = generatorPolynomial(degree);
  const remainder = new Array<number>(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ (remainder.shift() ?? 0);
    remainder.push(0);
    for (let i = 0; i < degree; i += 1) remainder[i] = (remainder[i] ?? 0) ^ multiply(generator[i + 1] ?? 0, factor);
  }
  return remainder;
}

// The data bits, padded to the version's capacity, split into blocks with their
// EC codewords, then interleaved the way the standard reads them back.
function codewords(version: number, bytes: Uint8Array) {
  const capacity = dataCodewords(version) * 8;
  const bits: Bit[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push(((value >>> i) & 1) as Bit);
  };
  push(0b0100, 4);
  push(bytes.length, version <= 9 ? 8 : 16);
  for (const byte of bytes) push(byte, 8);
  push(0, Math.min(4, capacity - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);

  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | (bits[i + j] ?? 0);
    data.push(byte);
  }

  const [total, ecPerBlock, blockCount] = versionInfo(version);
  const shortBlocks = blockCount - (total % blockCount);
  const shortLength = Math.floor(total / blockCount) - ecPerBlock;
  const blocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  for (let b = 0; b < blockCount; b += 1) {
    const length = shortLength + (b < shortBlocks ? 0 : 1);
    const block = data.slice(offset, offset + length);
    offset += length;
    blocks.push(block);
    ecBlocks.push(errorCorrection(block, ecPerBlock));
  }

  const out: number[] = [];
  for (let i = 0; i <= shortLength; i += 1) {
    for (const block of blocks) if (i < block.length) out.push(block[i] ?? 0);
  }
  for (let i = 0; i < ecPerBlock; i += 1) {
    for (const block of ecBlocks) out.push(block[i] ?? 0);
  }
  return out;
}

function alignmentPositions(version: number) {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((size(version) - 13) / (2 * count - 2)) * 2;
  const positions = [6];
  for (let pos = size(version) - 7; positions.length < count; pos -= step) positions.splice(1, 0, pos);
  return positions;
}

// Function patterns and the reserved areas, marked in `reserved` so the data
// bits flow around them and the mask never touches them.
function functionPatterns(version: number) {
  const n = size(version);
  const modules: Matrix = Array.from({ length: n }, () => new Array<Bit>(n).fill(0));
  const reserved: boolean[][] = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  const set = (row: number, col: number, dark: boolean) => {
    if (row < 0 || col < 0 || row >= n || col >= n) return;
    setCell(modules, row, col, dark ? 1 : 0);
    const line = reserved[row];
    if (line) line[col] = true;
  };
  const isReserved = (row: number, col: number) => reserved[row]?.[col] ?? false;

  const finder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const edge = Math.max(Math.abs(r - 3), Math.abs(c - 3));
        set(row + r, col + c, edge !== 2 && edge !== 4);
      }
    }
  };
  finder(0, 0);
  finder(0, n - 7);
  finder(n - 7, 0);

  for (let i = 8; i < n - 8; i += 1) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  // Every crossing of the alignment positions carries a pattern, except the
  // three corners taken by the finder patterns. The ones lying on a timing
  // line are drawn: the timing line is reserved too, and skipping a pattern
  // for that reason left two of them out, which shifted every data bit that
  // followed and made the whole square unreadable.
  const positions = alignmentPositions(version);
  const last = positions.length - 1;
  positions.forEach((row, i) => {
    positions.forEach((col, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let r = -2; r <= 2; r += 1) {
        for (let c = -2; c <= 2; c += 1) set(row + r, col + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
      }
    });
  });

  for (let i = 0; i < 9; i += 1) {
    if (i !== 6) {
      set(8, i, false);
      set(i, 8, false);
    }
  }
  for (let i = 0; i < 8; i += 1) {
    set(8, n - 1 - i, false);
    set(n - 1 - i, 8, false);
  }
  set(n - 8, 8, true);

  if (version >= 7) {
    let bits = version << 12;
    for (let i = 17; i >= 12; i -= 1) if ((bits >>> i) & 1) bits ^= 0x1f25 << (i - 12);
    const info = (version << 12) | bits;
    for (let i = 0; i < 18; i += 1) {
      const dark = ((info >>> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = n - 11 + (i % 3);
      set(a, b, dark);
      set(b, a, dark);
    }
  }

  return { modules, isReserved };
}

function placeData(modules: Matrix, isReserved: (_row: number, _col: number) => boolean, data: number[]) {
  const n = modules.length;
  let bitIndex = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vert = 0; vert < n; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const col = right - j;
        const upward = ((right + 1) & 2) === 0;
        const row = upward ? n - 1 - vert : vert;
        if (isReserved(row, col)) continue;
        const byte = data[bitIndex >>> 3] ?? 0;
        setCell(modules, row, col, ((byte >>> (7 - (bitIndex & 7))) & 1) as Bit);
        bitIndex += 1;
      }
    }
  }
}

function maskBit(mask: number, row: number, col: number) {
  switch (mask) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6:
      return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    default:
      return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
  }
}

function applyMask(modules: Matrix, isReserved: (_row: number, _col: number) => boolean, mask: number) {
  const n = modules.length;
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      if (!isReserved(row, col) && maskBit(mask, row, col)) setCell(modules, row, col, (cell(modules, row, col) ^ 1) as Bit);
    }
  }
}

function writeFormat(modules: Matrix, mask: number) {
  const n = modules.length;
  const data = (EC_LEVEL_M << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i: number) => (((bits >>> i) & 1) === 1 ? 1 : 0) as Bit;
  // First copy: down column 8 beside the top-left finder, then along row 8.
  for (let i = 0; i <= 5; i += 1) setCell(modules, i, 8, bit(i));
  setCell(modules, 7, 8, bit(6));
  setCell(modules, 8, 8, bit(7));
  setCell(modules, 8, 7, bit(8));
  for (let i = 9; i < 15; i += 1) setCell(modules, 8, 14 - i, bit(i));
  // Second copy: along row 8 under the top-right finder, then down column 8
  // beside the bottom-left one, above the module that is always dark.
  for (let i = 0; i < 8; i += 1) setCell(modules, 8, n - 1 - i, bit(i));
  for (let i = 8; i < 15; i += 1) setCell(modules, n - 15 + i, 8, bit(i));
  setCell(modules, n - 8, 8, 1);
}

// The standard's four penalties, so the mask picked is the one that leaves the
// fewest features a scanner could mistake for a finder pattern.
function penalty(modules: Matrix) {
  const n = modules.length;
  let score = 0;
  const runs = (line: (_i: number) => Bit) => {
    let run = 1;
    for (let i = 1; i < n; i += 1) {
      if (line(i) === line(i - 1)) {
        run += 1;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else run = 1;
    }
  };
  for (let i = 0; i < n; i += 1) {
    runs((j) => cell(modules, i, j));
    runs((j) => cell(modules, j, i));
  }
  for (let row = 0; row < n - 1; row += 1) {
    for (let col = 0; col < n - 1; col += 1) {
      const v = cell(modules, row, col);
      if (v === cell(modules, row, col + 1) && v === cell(modules, row + 1, col) && v === cell(modules, row + 1, col + 1)) {
        score += 3;
      }
    }
  }
  const pattern = [1, 0, 1, 1, 1, 0, 1];
  const finderLike = (line: (_i: number) => Bit) => {
    for (let i = 0; i <= n - 11; i += 1) {
      const matches = (offset: number) => pattern.every((p, k) => line(i + offset + k) === p);
      const quiet = (start: number) => [0, 1, 2, 3].every((k) => line(i + start + k) === 0);
      if ((matches(0) && quiet(7)) || (quiet(0) && matches(4))) score += 40;
    }
  };
  for (let i = 0; i < n; i += 1) {
    finderLike((j) => cell(modules, i, j));
    finderLike((j) => cell(modules, j, i));
  }
  let dark = 0;
  for (const row of modules) for (const value of row) dark += value;
  const ratio = (dark * 100) / (n * n);
  score += Math.floor(Math.abs(ratio - 50) / 5) * 10;
  return score;
}

export function qrModules(text: string) {
  const bytes = new TextEncoder().encode(text);
  const version = smallestVersion(bytes.length);
  const data = codewords(version, bytes);
  let best: Matrix = [];
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    const { modules, isReserved } = functionPatterns(version);
    placeData(modules, isReserved, data);
    applyMask(modules, isReserved, mask);
    writeFormat(modules, mask);
    const score = penalty(modules);
    if (score < bestScore) {
      bestScore = score;
      best = modules;
    }
  }
  return best;
}

// One path for the whole square: a rectangle per dark cell, in module units, so
// the SVG scales to any size with `viewBox` alone.
export function qrSvgPath(modules: Matrix) {
  const parts: string[] = [];
  modules.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) parts.push(`M${x} ${y}h1v1h-1z`);
    });
  });
  return parts.join("");
}
