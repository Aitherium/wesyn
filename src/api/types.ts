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

export interface Planet {
  id: string
  name: string
  role: string
  discord: string[]
  members?: number
}

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
  planets(): Promise<Planet[]>
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
