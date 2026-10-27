// A ZIP file written by hand, for a Word file (a .docx is a ZIP of XML parts and pictures): each file deflated with
// the browser's CompressionStream('deflate-raw') where that's there and makes it smaller, else stored as it is.
// No ZIP64, no encryption, no comments: a note's .docx is far under 4 GB and holds a few dozen files at most.

export interface ZipFile {
  name: string;
  data: Uint8Array;
  /** false: stored as it is (pictures, already compressed) */
  deflate?: boolean;
}

let table: Uint32Array | null = null;
/** The CRC-32 a ZIP keeps of each file (the IEEE polynomial, as zlib's). */
export function crc32(data: Uint8Array): number {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = table[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Raw deflate (no zlib header), or null where the browser can't. */
async function deflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw' as CompressionFormat));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null; // an older browser knows gzip and deflate only
  }
}

/** A date and time as MS-DOS writes them (local time, 2-second steps, from 1980). */
function dosTime(d: Date): { time: number; date: number } {
  const y = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** The ZIP of `files`, in their order, each dated `when`. `compress: false` stores every file. */
export async function zip(files: ZipFile[], when = new Date(), compress = true): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const { time, date } = dosTime(when);
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const packed = compress && f.deflate !== false ? await deflateRaw(f.data) : null;
    const deflated = !!packed && packed.length < f.data.length;
    const body = deflated ? packed! : f.data;
    const crc = crc32(f.data);
    const flags = /[^\x20-\x7e]/.test(f.name) ? 0x0800 : 0; // UTF-8 names (ours are ASCII)

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed: 2.0
    local.setUint16(6, flags, true);
    local.setUint16(8, deflated ? 8 : 0, true);
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, body.length, true);
    local.setUint32(22, f.data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, body);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true); // made by: 2.0, MS-DOS
    entry.setUint16(6, 20, true);
    entry.setUint16(8, flags, true);
    entry.setUint16(10, deflated ? 8 : 0, true);
    entry.setUint16(12, time, true);
    entry.setUint16(14, date, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, body.length, true);
    entry.setUint32(24, f.data.length, true);
    entry.setUint16(28, name.length, true);
    // (extra, comment, disk, internal and external attributes: 0)
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), name);

    offset += 30 + name.length + body.length;
  }
  const dirSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, dirSize, true);
  end.setUint32(16, offset, true);

  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) (out.set(p, at), (at += p.length));
  return out;
}
