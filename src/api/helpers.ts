// Pure helpers shared by the live client and the screens. AGPL-3.0-only.
import type { Post, ProfileGate, Relationship } from './types'

/** What a profile may show, from the page read's status ONLY. */
export function profileGate(status: number): ProfileGate {
  if (status >= 200 && status < 300) return 'ok'
  if (status === 401 || status === 403) return 'private'
  if (status === 404) return 'none'
  if (status === 410) return 'removed'
  return 'error'
}

/** A member handle from what someone typed ("@ada" -> "ada"), or '' when unusable. */
export function cleanHandle(input: string): string {
  const h = (input || '').trim().replace(/^@+/, '')
  return /^[\w.-]{1,64}$/.test(h) ? h : ''
}

/** Plain text from HTML. Rendered as text, never as markup. */
export function plainText(html: unknown, max = 280): string {
  if (typeof html !== 'string') return ''
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export interface ProfileAction {
  kind: 'edit' | 'message' | 'accept' | 'connect' | 'signin' | 'pending'
  label: string
}

/** The ONE button a profile shows, from the relationship the server reported. */
export function profileAction(rel: Relationship): ProfileAction {
  switch (rel) {
    case 'self': return { kind: 'edit', label: 'Edit your Space' }
    case 'friends': return { kind: 'message', label: 'Message' }
    case 'request_received': return { kind: 'accept', label: 'Accept' }
    case 'request_sent': return { kind: 'pending', label: 'Requested' }
    case 'anonymous': return { kind: 'signin', label: 'Sign in to connect' }
    default: return { kind: 'connect', label: 'Connect' }
  }
}

export interface RelayChannel {
  name: string
  mode?: string
  owner_only?: boolean
  message_count?: number
}

/** The rooms worth reading for a feed: listable, readable, busiest first. */
export function pickFeedChannels(channels: RelayChannel[], max = 6): string[] {
  return channels
    .filter(c => c && c.name && !c.owner_only && c.mode !== 'co-viewing' && (c.message_count || 0) > 0)
    .sort((a, b) => (b.message_count || 0) - (a.message_count || 0))
    .slice(0, max)
    .map(c => c.name)
}

/** Ordinary messages from several rooms, newest first. System lines and thread replies stay out. */
export function mergeFeed(
  rooms: { channel: string; messages: Array<Record<string, unknown>> }[],
  limit = 40,
): Post[] {
  const out: Post[] = []
  for (const room of rooms) {
    for (const m of room.messages || []) {
      const type = (m.type as string) || 'message'
      const body = typeof m.content === 'string' ? m.content.trim() : ''
      if (type !== 'message' || !body || m.thread_id) continue
      out.push({
        id: `${room.channel}:${String(m.id ?? out.length)}`,
        channel: room.channel,
        author: String(m.nick || ''),
        body,
        timestamp: String(m.timestamp || ''),
      })
    }
  }
  // ISO-8601 strings order correctly by code unit; localeCompare is locale-dependent.
  return out.sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0))
    .slice(0, limit)
}

/** "3h ago" style, from an ISO timestamp; '' when unparseable. */
export function ago(iso: string, now = Date.now()): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
