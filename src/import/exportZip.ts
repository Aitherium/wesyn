// Read a member's OWN data-export ZIP in the browser. Nothing is uploaded. AGPL-3.0-only.
//
// The export is a plain ZIP of CSV files. We read its central directory, inflate each
// wanted entry with the browser's DecompressionStream('deflate-raw'), and parse the CSV.
// No third-party code, no network: the file never leaves this tab.

export interface Position { title: string; company: string; from: string; to: string }
export interface Education { school: string; degree: string; from: string; to: string }
export interface Contact { name: string; company: string; position: string; email: string }

export interface ImportedProfile {
  positions: Position[]
  skills: string[]
  education: Education[]
  /** People the member already knows: invite SUGGESTIONS, never contacted automatically. */
  contacts: Contact[]
  files: string[]
}

const WANTED = ['positions.csv', 'skills.csv', 'education.csv', 'connections.csv']
const MAX_BYTES = 50 * 1024 * 1024

function u16(b: Uint8Array, o: number) { return b[o] | (b[o + 1] << 8) }
function u32(b: Uint8Array, o: number) { return (u16(b, o) | (u16(b, o + 2) << 16)) >>> 0 }

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** name -> text for the entries we want. Throws on anything that is not a readable ZIP. */
export async function readZipTexts(buf: ArrayBuffer, wanted = WANTED): Promise<Record<string, string>> {
  if (buf.byteLength > MAX_BYTES) throw new Error('That file is larger than 50 MB.')
  const b = new Uint8Array(buf)
  // End of central directory: signature 0x06054b50, searched from the end.
  let eocd = -1
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (u32(b, i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('That is not a ZIP file.')
  const count = u16(b, eocd + 10)
  let p = u32(b, eocd + 16)
  const out: Record<string, string> = {}
  const dec = new TextDecoder('utf-8')
  for (let n = 0; n < count && p + 46 <= b.length; n++) {
    if (u32(b, p) !== 0x02014b50) throw new Error('The ZIP directory is damaged.')
    const method = u16(b, p + 10)
    const csize = u32(b, p + 20)
    const nlen = u16(b, p + 28), xlen = u16(b, p + 30), clen = u16(b, p + 32)
    const local = u32(b, p + 42)
    const name = dec.decode(b.subarray(p + 46, p + 46 + nlen))
    p += 46 + nlen + xlen + clen
    const base = name.split('/').pop()!.toLowerCase()
    if (!wanted.includes(base)) continue
    if (u32(b, local) !== 0x04034b50) continue
    const start = local + 30 + u16(b, local + 26) + u16(b, local + 28)
    const raw = b.subarray(start, start + csize)
    const bytes = method === 0 ? raw : method === 8 ? await inflateRaw(raw) : null
    if (bytes) out[base] = dec.decode(bytes).replace(/^﻿/, '')
  }
  return out
}

/** RFC 4180 CSV: quoted fields, doubled quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') q = false
      else field += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(v => v.trim()))
}

/** Rows as objects keyed by header. The connections file starts with notes lines: skip to the header. */
export function records(text: string, mustHave: string): Record<string, string>[] {
  const rows = parseCsv(text)
  const h = rows.findIndex(r => r.some(c => c.trim().toLowerCase() === mustHave.toLowerCase()))
  if (h < 0) return []
  const head = rows[h].map(c => c.trim().toLowerCase())
  return rows.slice(h + 1).map(r => Object.fromEntries(head.map((k, i) => [k, (r[i] || '').trim()])))
}

export function toProfile(texts: Record<string, string>): ImportedProfile {
  const pos = texts['positions.csv'] ? records(texts['positions.csv'], 'Title') : []
  const sk = texts['skills.csv'] ? records(texts['skills.csv'], 'Name') : []
  const ed = texts['education.csv'] ? records(texts['education.csv'], 'School Name') : []
  const co = texts['connections.csv'] ? records(texts['connections.csv'], 'First Name') : []
  return {
    positions: pos.map(r => ({ title: r['title'] || '', company: r['company name'] || '',
      from: r['started on'] || '', to: r['finished on'] || '' })).filter(p => p.title || p.company),
    skills: [...new Set(sk.map(r => r['name']).filter(Boolean))],
    education: ed.map(r => ({ school: r['school name'] || '', degree: r['degree name'] || '',
      from: r['start date'] || '', to: r['end date'] || '' })).filter(e => e.school),
    contacts: co.map(r => ({ name: [r['first name'], r['last name']].filter(Boolean).join(' '),
      company: r['company'] || '', position: r['position'] || '',
      email: r['email address'] || '' })).filter(c => c.name),
    files: Object.keys(texts).sort(),
  }
}

export async function importExport(file: Blob): Promise<ImportedProfile> {
  return toProfile(await readZipTexts(await file.arrayBuffer()))
}
