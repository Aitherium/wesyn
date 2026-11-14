// Test helper: build a small ZIP (stored or deflated entries). Tests and E2E fixtures only.
function crc32(b: Uint8Array): number {
  let c = ~0
  for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)) }
  return ~c >>> 0
}
async function deflateRaw(b: Uint8Array): Promise<Uint8Array> {
  const s = new Blob([b]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(s).arrayBuffer())
}
export async function makeZip(files: Record<string, string>, deflate = true): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = [], central: Uint8Array[] = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const raw = enc.encode(text), nm = enc.encode(name)
    const data = deflate ? await deflateRaw(raw) : raw
    const h = new DataView(new ArrayBuffer(30))
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(8, deflate ? 8 : 0, true)
    h.setUint32(14, crc32(raw), true); h.setUint32(18, data.length, true); h.setUint32(22, raw.length, true)
    h.setUint16(26, nm.length, true)
    const c = new DataView(new ArrayBuffer(46))
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true)
    c.setUint16(10, deflate ? 8 : 0, true); c.setUint32(16, crc32(raw), true)
    c.setUint32(20, data.length, true); c.setUint32(24, raw.length, true); c.setUint16(28, nm.length, true)
    c.setUint32(42, offset, true)
    parts.push(new Uint8Array(h.buffer), nm, data)
    central.push(new Uint8Array(c.buffer), nm)
    offset += 30 + nm.length + data.length
  }
  const cdSize = central.reduce((n, p) => n + p.length, 0)
  const e = new DataView(new ArrayBuffer(22))
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, Object.keys(files).length, true)
  e.setUint16(10, Object.keys(files).length, true); e.setUint32(12, cdSize, true); e.setUint32(16, offset, true)
  const all = [...parts, ...central, new Uint8Array(e.buffer)]
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0))
  let o = 0; for (const p of all) { out.set(p, o); o += p.length }
  return out
}

export const SAMPLE_EXPORT: Record<string, string> = {
  'Positions.csv': 'Company Name,Title,Description,Location,Started On,Finished On\r\n"Lantern Works (sample)",Platform engineer,"Builds, CI",Remote,Jan 2023,\r\nHarbor Labs (sample),SRE,,,Mar 2019,Dec 2022\r\n',
  'Skills.csv': 'Name\nKubernetes\nCI/CD\nKubernetes\n',
  'Education.csv': 'School Name,Start Date,End Date,Notes,Degree Name,Activities\nSample State University,2012,2016,,BSc Computer Science,\n',
  'Connections.csv': 'Notes:\n"When exporting your connection data, you may notice..."\n\nFirst Name,Last Name,URL,Email Address,Company,Position,Connected On\nMira,Okafor (sample),https://example.invalid/m,,Tidewater Analytics (sample),Founder,01 Feb 2025\n',
  'Messages.csv': 'never,read\n',
}
