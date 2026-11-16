// The live client: the real Aitherium backend, as the signed-in member. AGPL-3.0-only.
//
// Every request carries `Authorization: Bearer <token>` from "Sign in with Aitherium"
// and `credentials: 'omit'`: the page never rides on ambient cookies, so it can do
// nothing a member could not do with their own token. Privacy is the SERVER's: a
// Space this viewer may not see answers 403 and the profile shows only "private",
// never a cached card, a directory row or a guess.
import { mergeFeed, pickFeedChannels, plainText, profileGate, type RelayChannel } from './helpers'
import type {
  CommunityStanding, NetworkClient, Outcome, People, Post, Profile, ProfileResult,
  Relationship, ShareStatus, Viewer, World, WorldClient, WorldSettings,
} from './types'
import { LiveWorlds } from './worlds-live'

export interface LiveConfig {
  apiBase: string        // https://api.aitherium.com
  userinfoUrl: string    // the IdP's OIDC userinfo endpoint
  token: string
}

type Fetch = typeof fetch

async function json<T>(r: Response): Promise<T | null> {
  try { return (await r.json()) as T } catch { return null }
}

interface StandingBody {
  display_name?: string
  github?: { login: string; url: string; verified?: boolean } | null
  connections?: { count: number; people: { username: string; display_name: string }[] }
  relationship?: Relationship
  community?: {
    available?: boolean; reason?: string; reputation?: number; level?: number; xp?: number
    shipped_count?: number; project_count?: number
    badges?: Array<{ name?: string; title?: string } | string>
  }
}

type Block = { type?: string; config?: Record<string, unknown> }

function community(c: StandingBody['community']): CommunityStanding {
  if (!c || !c.available) return { available: false, reason: c?.reason, badges: [] }
  return {
    available: true,
    reputation: c.reputation, level: c.level, xp: c.xp,
    shippedCount: c.shipped_count, projectCount: c.project_count,
    badges: (c.badges || []).map(b => (typeof b === 'string' ? b : b.title || b.name || ''))
      .filter(Boolean),
  }
}

/** A Profile from the Space page config and the standing read (either may be thin). */
export function toProfile(username: string, config: unknown, st: StandingBody | null): Profile {
  const c = (config && typeof config === 'object' ? config : {}) as {
    display_name?: unknown; blocks?: Block[]
  }
  const blocks = Array.isArray(c.blocks) ? c.blocks : []
  const find = (t: string) => blocks.find(b => b && b.type === t)?.config || {}
  const mood = find('mood')
  const headline = [mood.emoji, mood.text].filter(v => typeof v === 'string' && v).join(' ')
  const name = typeof c.display_name === 'string' && c.display_name.trim()
    ? c.display_name.trim() : (st?.display_name || username)
  const gh = st?.github
  return {
    username,
    displayName: name,
    headline,
    bio: plainText(find('bio').html),
    // The standing route returns GitHub only when it was PROVED by OAuth sign-in.
    github: gh ? { login: gh.login, url: gh.url, verified: true } : null,
    certs: [],
    work: [],
    endorsements: [],
    community: community(st?.community),
    connections: {
      count: st?.connections?.count || 0,
      people: (st?.connections?.people || [])
        .map(p => ({ username: p.username, displayName: p.display_name || p.username })),
    },
    relationship: st?.relationship || 'none',
  }
}

type WorldRow = { workspace_id?: string; slug?: string; name: string; role: string;
  discord?: { name: string }[] }

/** The member's worlds: their workspaces (with Discord) joined with their Relay workspaces by slug. */
export function mergeWorlds(rows: WorldRow[], relay: Array<{ id?: string; slug: string; name: string; role: string;
  member_count?: number; world?: WorldSettings }>): World[] {
  const out = new Map<string, World>()
  for (const p of rows) {
    const slug = p.slug || p.workspace_id || ''
    out.set(slug, { id: p.workspace_id || slug, slug, name: p.name, role: p.role,
      discord: (p.discord || []).map(d => d.name) })
  }
  for (const w of relay) {
    const known = out.get(w.slug)
    out.set(w.slug, { ...(known || { id: w.id || w.slug, slug: w.slug, name: w.name, role: w.role, discord: [] }),
      members: w.member_count, settings: w.world })
  }
  return [...out.values()]
}

export class LiveClient implements NetworkClient {
  readonly mode = 'live' as const
  readonly world: WorldClient
  private me?: Promise<string>
  constructor(private cfg: LiveConfig, private f: Fetch = fetch.bind(globalThis)) {
    this.world = new LiveWorlds(cfg.apiBase, cfg.token, f, () => {
      this.me ||= this.viewer().then(v => v?.username || '')
      return this.me
    })
  }

  private get(path: string): Promise<Response> {
    return this.f(this.cfg.apiBase + path, {
      credentials: 'omit',
      headers: { Authorization: `Bearer ${this.cfg.token}`, Accept: 'application/json' },
    })
  }

  async viewer(): Promise<Viewer | null> {
    const r = await this.f(this.cfg.userinfoUrl, {
      credentials: 'omit', headers: { Authorization: `Bearer ${this.cfg.token}` },
    })
    if (!r.ok) return null
    const u = await json<{ preferred_username?: string; name?: string; sub?: string }>(r)
    const username = u?.preferred_username || ''
    return username ? { username, displayName: u?.name || username } : null
  }

  async profile(username: string): Promise<ProfileResult> {
    const enc = encodeURIComponent(username)
    // The PAGE read is the gate. Nothing else is asked until it says yes.
    const page = await this.get(`/api/myspace/${enc}`)
    const gate = profileGate(page.status)
    if (gate !== 'ok') return { gate }
    const body = await json<{ config?: unknown }>(page)
    const st = await this.get(`/api/myspace/${enc}/standing`)
    if (st.status === 401 || st.status === 403 || st.status === 410) {
      // Visibility changed between the two reads: the stricter answer wins.
      return { gate: profileGate(st.status) as 'private' | 'removed' }
    }
    const standing = st.ok ? await json<StandingBody>(st) : null
    return { gate: 'ok', profile: toProfile(username, body?.config, standing) }
  }

  async feed(): Promise<Post[]> {
    const r = await this.get('/api/relay/v1/channels')
    if (!r.ok) throw new Error(`Relay answered ${r.status}`)
    const names = pickFeedChannels((await json<{ channels?: RelayChannel[] }>(r))?.channels || [])
    const rooms = await Promise.all(names.map(async name => {
      const room = encodeURIComponent(name.replace(/^#/, ''))
      const m = await this.get(`/api/relay/v1/channels/${room}/messages?limit=8`)
      // A room this viewer may not read answers 403: it contributes nothing.
      if (!m.ok) return { channel: name, messages: [] }
      return { channel: name, messages: (await json<{ messages?: [] }>(m))?.messages || [] }
    }))
    return mergeFeed(rooms)
  }

  async people(): Promise<People> {
    const [f, rq] = await Promise.all([
      this.get('/api/social/friends'),
      this.get('/api/social/friends/requests?direction=incoming'),
    ])
    if (!f.ok) throw new Error(`People answered ${f.status}`)
    const friends = (await json<{ friends?: { username: string; display_name?: string }[] }>(f))
      ?.friends || []
    const incoming = rq.ok
      ? (await json<{ incoming?: { id: number; from_user: string; message?: string }[] }>(rq))
        ?.incoming || []
      : []
    return {
      connections: friends.map(p => ({ username: p.username, displayName: p.display_name || p.username })),
      incoming: incoming.map(x => ({
        id: String(x.id), from: { username: x.from_user, displayName: x.from_user },
        message: x.message || '',
      })),
    }
  }

  async worlds(): Promise<World[]> {
    // `/network/worlds` since 2026-11-15; an older backend only has `/network/planets`.
    let r = await this.get('/api/myspace/network/worlds')
    if (r.status === 404) r = await this.get('/api/myspace/network/planets')
    let rows: WorldRow[] = []
    if (r.ok) {
      const d = await json<{ worlds?: WorldRow[]; planets?: WorldRow[] }>(r)
      rows = d?.worlds || d?.planets || []
    } else if (r.status !== 404) throw new Error(`Worlds answered ${r.status}`)
    const rw = await this.get('/api/relay/v1/workspaces')
    const relay = rw.ok ? (await json<{ workspaces?: [] }>(rw))?.workspaces || [] : []
    return mergeWorlds(rows, relay)
  }

  async connect(username: string): Promise<{ ok: boolean; message: string }> {
    const r = await this.f(`${this.cfg.apiBase}/api/social/friends/request`, {
      method: 'POST', credentials: 'omit',
      headers: { Authorization: `Bearer ${this.cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    })
    if (r.ok) return { ok: true, message: 'Request sent.' }
    const d = await json<{ detail?: string }>(r)
    return { ok: false, message: typeof d?.detail === 'string' ? d.detail : `The server answered ${r.status}.` }
  }

  private postJson(path: string, body: unknown): Promise<Response> {
    return this.f(this.cfg.apiBase + path, {
      method: 'POST', credentials: 'omit',
      headers: { Authorization: `Bearer ${this.cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  private async outcome(r: Response, ok: string): Promise<Outcome> {
    if (r.ok) return { ok: true, message: ok }
    const d = await json<{ detail?: unknown }>(r)
    const plan = r.status === 403 ? ' (this may need a paid plan)' : ''
    return { ok: false, message: typeof d?.detail === 'string' ? d.detail : `The server answered ${r.status}${plan}.` }
  }

  async post(room: string, text: string): Promise<Outcome> {
    const me = await this.viewer()
    if (!me) return { ok: false, message: 'Sign in again.' }
    const r = await this.postJson(`/api/relay/v1/channels/${encodeURIComponent(room.replace(/^#/, ''))}/messages`,
      { nick: me.username, content: text })
    return this.outcome(r, `Posted to ${room}.`)
  }

  async shareStatus(): Promise<ShareStatus> {
    const r = await this.get('/api/social/linkedin/member/status')
    if (!r.ok) return { available: false, connected: false, postsLeftToday: 0, postsPerDay: 2,
      reason: r.status === 404 ? 'Not available yet.' : r.status === 403 ? 'Needs a paid plan.' : `Unavailable (${r.status}).` }
    const d = await json<{ connected?: boolean; posts_left_today?: number; posts_per_day?: number }>(r)
    return { available: true, connected: !!d?.connected, postsLeftToday: d?.posts_left_today ?? 0,
      postsPerDay: d?.posts_per_day ?? 2 }
  }

  async shareConnectUrl(): Promise<Outcome & { url?: string }> {
    const r = await this.get('/api/social/linkedin/member/connect')
    if (!r.ok) return this.outcome(r, '')
    const d = await json<{ url?: string }>(r)
    const url = d?.url || ''
    // Only ever open LinkedIn's own consent page.
    return url.startsWith('https://www.linkedin.com/oauth/v2/authorization?')
      ? { ok: true, message: '', url } : { ok: false, message: 'Unexpected consent link.' }
  }

  async shareToLinkedIn(text: string, url: string): Promise<Outcome> {
    return this.outcome(await this.postJson('/api/social/linkedin/member/share', { text, url }),
      'Shared to LinkedIn.')
  }
}
