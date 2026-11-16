// A world, live: AitherRelay's workspace rooms and forum, and the public OSINT door.
// AGPL-3.0-only.
//
// A world IS one Relay workspace. Its forum is Relay's own workspace forum
// (`/v1/workspaces/<slug>/forum/*`) and its chat is that workspace's rooms; Wesyn keeps
// no second forum engine and no message table. Every request carries the member's
// bearer token and `credentials: 'omit'`, so Relay decides membership and authorship
// from the verified identity, never from a field this page sends.
//
// OSINT comes from the platform's public read door (`/api/osint/news|telemetry`), which
// holds the ShadowBroker board's signing secret on the server. This page never sees it.
import type {
  ChatLine, ForumBoard, ForumPost, ForumThread, OsintItem, OsintResult, Outcome, WorldClient,
  WorldDetail, WorldSettings,
} from './types'

type Fetch = typeof fetch
type Json = Record<string, unknown>

const OSINT_DEFAULTS = {
  board: 'https://shadowbroker.aitherium.com',
  software: 'https://github.com/wizzense/Shadowbroker',
  license: 'AGPL-3.0',
}

async function body<T = Json>(r: Response): Promise<T | null> {
  try { return (await r.json()) as T } catch { return null }
}

/** The server's own reason, or the status, never an empty "failed". */
export async function reason(r: Response): Promise<string> {
  const d = await body<{ detail?: unknown }>(r)
  if (typeof d?.detail === 'string') return d.detail
  return `The server answered ${r.status}.`
}

export function toThread(t: Json): ForumThread {
  return {
    id: String(t.id ?? ''), boardId: String(t.category_id ?? ''), title: String(t.title ?? ''),
    author: String(t.author ?? ''), replies: Number(t.replies ?? 0) || 0,
    updatedAt: String(t.updated_at ?? t.created_at ?? ''), pinned: !!t.pinned, locked: !!t.locked,
  }
}

/** Only http(s) links survive: a row can never hand the page a javascript: URL. */
export function safeLink(v: unknown): string | undefined {
  return typeof v === 'string' && /^https?:\/\//i.test(v) ? v : undefined
}

export function toOsint(row: Json): OsintItem {
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
  return {
    title: String(row.title ?? row.label ?? ''), summary: String(row.summary ?? ''),
    source: String(row.source ?? row.type ?? ''), link: safeLink(row.link),
    time: String(row.time ?? ''), lat: num(row.lat), lng: num(row.lng),
    type: typeof row.type === 'string' ? row.type : undefined,
  }
}

/** A world slug the way Relay will store it (it slugifies the same way). */
export function worldSlug(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

export class LiveWorlds implements WorldClient {
  constructor(private apiBase: string, private token: string, private f: Fetch,
    private me: () => Promise<string>) {}

  private call(path: string, init: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.token}`, Accept: 'application/json' }
    if (init.body) headers['Content-Type'] = 'application/json'
    return this.f(this.apiBase + path, { ...init, credentials: 'omit', headers })
  }

  private ws(slug: string, rest = ''): string {
    return `/api/relay/v1/workspaces/${encodeURIComponent(slug)}${rest}`
  }

  async create(name: string, slug: string): Promise<Outcome & { slug?: string }> {
    const r = await this.call('/api/relay/v1/workspaces', {
      method: 'POST', body: JSON.stringify({ name: name.trim(), slug: worldSlug(slug || name) }),
    })
    if (!r.ok) return { ok: false, message: await reason(r) }
    const d = await body<{ workspace?: { slug?: string } }>(r)
    return { ok: true, message: 'World created.', slug: d?.workspace?.slug }
  }

  async open(slug: string): Promise<WorldDetail> {
    const r = await this.call(this.ws(slug))
    if (!r.ok) throw new Error(await reason(r))
    const d = await body<{ workspace?: Json; your_role?: string }>(r)
    const w = d?.workspace || {}
    const stored = Object.prototype.hasOwnProperty.call(w, 'world')
    return {
      slug: String(w.slug ?? slug), name: String(w.name ?? slug), description: String(w.description ?? ''),
      role: String(d?.your_role ?? 'member'),
      channels: Array.isArray(w.channels) ? (w.channels as unknown[]).map(String) : [],
      settings: (stored ? w.world : {}) as WorldSettings, settingsStored: stored,
    }
  }

  async boards(slug: string): Promise<ForumBoard[]> {
    const r = await this.call(this.ws(slug, '/forum/categories'))
    if (!r.ok) throw new Error(await reason(r))
    const rows = (await body<{ categories?: Json[] }>(r))?.categories || []
    return rows.map(c => ({ id: String(c.id), name: String(c.name ?? c.id), description: String(c.description ?? ''),
      threadCount: Number(c.thread_count ?? 0) || 0 }))
  }

  async threads(slug: string, boardId: string): Promise<ForumThread[]> {
    const r = await this.call(this.ws(slug, `/forum/categories/${encodeURIComponent(boardId)}/threads?limit=30`))
    if (!r.ok) throw new Error(await reason(r))
    return ((await body<{ threads?: Json[] }>(r))?.threads || []).map(toThread)
  }

  async thread(slug: string, threadId: string) {
    const r = await this.call(this.ws(slug, `/forum/threads/${encodeURIComponent(threadId)}`))
    if (!r.ok) throw new Error(await reason(r))
    const d = await body<{ thread?: Json; posts?: Json[] }>(r)
    const posts: ForumPost[] = (d?.posts || []).map(p => ({ id: String(p.id ?? ''), author: String(p.author ?? ''),
      body: String(p.content ?? ''), createdAt: String(p.created_at ?? ''), agent: !!p.is_agent }))
    return { thread: toThread(d?.thread || {}), posts }
  }

  async search(slug: string, query: string): Promise<ForumThread[]> {
    const r = await this.call(this.ws(slug, `/forum/search?q=${encodeURIComponent(query)}&limit=20`))
    if (!r.ok) throw new Error(await reason(r))
    return ((await body<{ threads?: Json[] }>(r))?.threads || []).map(toThread)
  }

  async startThread(slug: string, boardId: string, title: string, text: string) {
    // `author` is required by the request model; Relay replaces it with the verified nick.
    const r = await this.call(this.ws(slug, '/forum/threads'), { method: 'POST',
      body: JSON.stringify({ category_id: boardId, title, content: text, author: await this.me() }) })
    if (!r.ok) return { ok: false, message: await reason(r) }
    const d = await body<{ thread?: Json }>(r)
    return { ok: true, message: 'Thread posted.', id: d?.thread ? String(d.thread.id) : undefined }
  }

  async reply(slug: string, threadId: string, text: string): Promise<Outcome> {
    const r = await this.call(this.ws(slug, `/forum/threads/${encodeURIComponent(threadId)}/posts`), {
      method: 'POST', body: JSON.stringify({ content: text, author: await this.me() }) })
    return r.ok ? { ok: true, message: 'Reply posted.' } : { ok: false, message: await reason(r) }
  }

  async chat(channel: string): Promise<ChatLine[]> {
    const room = encodeURIComponent(channel.replace(/^#/, ''))
    const r = await this.call(`/api/relay/v1/channels/${room}/messages?limit=30`)
    if (!r.ok) throw new Error(await reason(r))
    const rows = (await body<{ messages?: Json[] }>(r))?.messages || []
    return rows.filter(m => (m.type ?? 'message') === 'message' && typeof m.content === 'string' && !m.thread_id)
      .map(m => ({ id: String(m.id ?? ''), author: String(m.nick ?? ''), body: String(m.content), timestamp: String(m.timestamp ?? '') }))
  }

  async say(channel: string, text: string): Promise<Outcome> {
    const room = encodeURIComponent(channel.replace(/^#/, ''))
    const r = await this.call(`/api/relay/v1/channels/${room}/messages`, { method: 'POST',
      body: JSON.stringify({ nick: await this.me(), content: text }) })
    return r.ok ? { ok: true, message: 'Sent.' } : { ok: false, message: await reason(r) }
  }

  async saveSettings(slug: string, settings: WorldSettings): Promise<Outcome> {
    const r = await this.call(this.ws(slug), { method: 'PUT', body: JSON.stringify({ world: settings }) })
    if (!r.ok) return { ok: false, message: await reason(r) }
    const d = await body<{ workspace?: Json }>(r)
    if (!d?.workspace || !Object.prototype.hasOwnProperty.call(d.workspace, 'world')) {
      return { ok: false, message: 'This Relay does not keep world settings yet; nothing was saved.' }
    }
    return { ok: true, message: 'Saved.' }
  }

  async osint(kind: 'news' | 'telemetry', query: string): Promise<OsintResult> {
    const q = query.trim()
    const r = await this.f(`${this.apiBase}/api/osint/${kind}?q=${encodeURIComponent(q)}&limit=${kind === 'news' ? 8 : 25}`,
      { credentials: 'omit', headers: { Accept: 'application/json' } })
    if (!r.ok) return { query: q, items: [], notice: '', ...OSINT_DEFAULTS, error: await reason(r) }
    const d = await body<{ results?: Json[]; notice?: string; source?: Json }>(r)
    const src = d?.source || {}
    return {
      query: q, items: (d?.results || []).map(toOsint), notice: String(d?.notice ?? ''),
      board: safeLink(src.board) || OSINT_DEFAULTS.board, software: safeLink(src.software) || OSINT_DEFAULTS.software,
      license: String(src.software_license ?? OSINT_DEFAULTS.license),
    }
  }

  async message(to: string, text: string): Promise<Outcome> {
    const r = await this.call('/api/relay/v1/dms', { method: 'POST', body: JSON.stringify({ to_nick: to, content: text }) })
    return r.ok ? { ok: true, message: `Sent to @${to}.` } : { ok: false, message: await reason(r) }
  }
}
