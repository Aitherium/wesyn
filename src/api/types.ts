// Wesyn's data model. Copyright (C) 2026 Aitherium and the Wesyn contributors. AGPL-3.0-only.
//
// The social shapes (profile, endorsement, work history, connection request, post,
// group) follow the data model of ShlinkedIn (github.com/cbh123/shlinked, AGPL-3.0),
// with its satire mechanics removed: no points currency, no "life score", no
// interns, no jabs, no ads. What is left is earned or proved, never self-claimed.

/** Where a fact came from. Only `proved` and `earned` count toward standing. */
export type Provenance = 'proved' | 'earned' | 'claimed'

export interface Person {
  username: string
  displayName: string
}

export interface GithubProof {
  login: string
  url: string
  /** True only when the account signed in with GitHub (OAuth), never a typed handle. */
  verified: boolean
  mergedPrs?: number
}

export interface Cert {
  name: string
  issuer: string
  url?: string
  provenance: Provenance
}

export interface WorkEntry {
  title: string
  org: string
  from: string
  to?: string
}

export interface Endorsement {
  from: Person
  skill: string
  body: string
}

export interface CommunityStanding {
  available: boolean
  reason?: string
  reputation?: number
  level?: number
  xp?: number
  shippedCount?: number
  projectCount?: number
  badges: string[]
}

export type Relationship =
  | 'self' | 'friends' | 'request_sent' | 'request_received' | 'none' | 'anonymous'

export interface Profile {
  username: string
  displayName: string
  headline: string
  bio: string
  github: GithubProof | null
  certs: Cert[]
  work: WorkEntry[]
  endorsements: Endorsement[]
  community: CommunityStanding
  connections: { count: number; people: Person[] }
  relationship: Relationship
}

/** What the server let this viewer see. A gate other than `ok` shows NOTHING else. */
export type ProfileGate = 'ok' | 'private' | 'none' | 'removed' | 'error'

export type ProfileResult =
  | { gate: 'ok'; profile: Profile }
  | { gate: Exclude<ProfileGate, 'ok'> }

export interface Post {
  id: string
  /** A Relay room; the Discord forum mirrored into it is the same conversation. */
  channel: string
  author: string
  body: string
  timestamp: string
}

/**
 * A world: a community you belong to. It IS one AitherRelay workspace (its channels plus
 * a forum board), and the Discord server bound to it mirrors into those same rooms.
 * Called a "planet" until 2026-11-15.
 */
export interface World {
  id: string
  /** The Relay workspace slug: the world's address (`#/w/<slug>`). */
  slug: string
  name: string
  role: string
  discord: string[]
  members?: number
  settings?: WorldSettings
}

/** @deprecated The pre-2026-11-15 name of {@link World}; kept for one release. */
export type Planet = World

export interface WorldSettings {
  /** The world's region or topic for its read-only OSINT panel (ShadowBroker). */
  osint?: { query: string; label: string }
  /** Sites and agents pinned into the world (the Studio pins them here). */
  pinned?: Pinned[]
}

export interface Pinned { kind: 'site' | 'agent'; title: string; url: string }

export interface ConnectionRequest {
  id: string
  from: Person
  message: string
}

export interface People {
  connections: Person[]
  incoming: ConnectionRequest[]
}

export interface Viewer {
  username: string
  displayName: string
}

/** Every screen reads through this. Sample and live are two implementations. */
export interface NetworkClient {
  readonly mode: 'sample' | 'live'
  viewer(): Promise<Viewer | null>
  profile(username: string): Promise<ProfileResult>
  feed(): Promise<Post[]>
  people(): Promise<People>
  worlds(): Promise<World[]>
  /** One world's rooms, forum and panels. */
  readonly world: WorldClient
  /** Ask to connect. Live: an authenticated POST with the bearer, never ambient credentials. */
  connect(username: string): Promise<{ ok: boolean; message: string }>
  /** Post to a Relay room (the Discord forum it mirrors is the same conversation). */
  post(room: string, text: string): Promise<Outcome>
  /** Opt-in cross-post: is the member's LinkedIn connected, and how many posts are left today. */
  shareStatus(): Promise<ShareStatus>
  /** The consent link for the member's own LinkedIn (opened in a new tab). */
  shareConnectUrl(): Promise<Outcome & { url?: string }>
  /** One post to the member's own LinkedIn; the server enforces the daily cap. */
  shareToLinkedIn(text: string, url: string): Promise<Outcome>
}

export interface Outcome { ok: boolean; message: string }

export interface ShareStatus {
  available: boolean
  connected: boolean
  postsLeftToday: number
  postsPerDay: number
  reason?: string
}

export interface ForumBoard { id: string; name: string; description: string; threadCount: number }

export interface ForumThread {
  id: string
  boardId: string
  title: string
  author: string
  replies: number
  updatedAt: string
  pinned: boolean
  locked: boolean
}

export interface ForumPost { id: string; author: string; body: string; createdAt: string; agent: boolean }

export interface ChatLine { id: string; author: string; body: string; timestamp: string }

export interface WorldDetail {
  slug: string
  name: string
  description: string
  role: string
  /** Relay rooms of this world, e.g. `#driftwood-general`. */
  channels: string[]
  settings: WorldSettings
  /** False when this Relay does not keep world settings yet (an older backend). */
  settingsStored: boolean
}

export interface OsintItem {
  title: string
  summary: string
  source: string
  link?: string
  time: string
  lat?: number
  lng?: number
  type?: string
}

export interface OsintResult {
  query: string
  items: OsintItem[]
  notice: string
  /** The board and its software licence, shown beside every panel. */
  board: string
  software: string
  license: string
  error?: string
}

/** A world's rooms, forum and OSINT panel, as the signed-in member. */
export interface WorldClient {
  create(name: string, slug: string): Promise<Outcome & { slug?: string }>
  open(slug: string): Promise<WorldDetail>
  boards(slug: string): Promise<ForumBoard[]>
  threads(slug: string, boardId: string): Promise<ForumThread[]>
  thread(slug: string, threadId: string): Promise<{ thread: ForumThread; posts: ForumPost[] }>
  search(slug: string, query: string): Promise<ForumThread[]>
  startThread(slug: string, boardId: string, title: string, body: string): Promise<Outcome & { id?: string }>
  reply(slug: string, threadId: string, body: string): Promise<Outcome>
  chat(channel: string): Promise<ChatLine[]>
  say(channel: string, text: string): Promise<Outcome>
  saveSettings(slug: string, settings: WorldSettings): Promise<Outcome>
  osint(kind: 'news' | 'telemetry', query: string): Promise<OsintResult>
  /** A Relay direct message to one member. */
  message(to: string, text: string): Promise<Outcome>
}
