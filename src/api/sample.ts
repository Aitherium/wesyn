// The demo's SAMPLE data. Every person, server and post here is FICTIONAL. AGPL-3.0-only.
//
// Rules for this file (CI checks the first two):
//   * every display name ends in " (sample)", so no screenshot can pass for a member;
//   * GitHub logins and URLs point at nothing real (example.invalid);
//   * one profile is private, so the demo shows what a private Space looks like:
//     the word "private" and nothing else.
import type {
  NetworkClient, People, Person, Planet, Post, Profile, ProfileResult, Viewer,
} from './types'

const p = (username: string, name: string): Person => ({ username, displayName: `${name} (sample)` })

export const SAMPLE_VIEWER: Viewer = { username: 'rowan', displayName: 'Rowan Vale (sample)' }

const ROWAN = p('rowan', 'Rowan Vale')
const MIRA = p('mira', 'Mira Okafor')
const TEO = p('teo', 'Teo Lindqvist')
const SAGE = p('sage', 'Sage Amari')
const JUN = p('jun', 'Jun Haddad')

const base = (who: Person, extra: Partial<Profile>): Profile => ({
  username: who.username, displayName: who.displayName, headline: '', bio: '', github: null,
  certs: [], work: [], endorsements: [],
  community: { available: false, reason: 'no community profile linked', badges: [] },
  connections: { count: 0, people: [] }, relationship: 'none', ...extra,
})

export const SAMPLE_PROFILES: Record<string, Profile> = {
  rowan: base(ROWAN, {
    headline: 'Platform engineer · runs the build farm for two planets',
    bio: 'I keep CI green and on-call quiet. Ask me about reproducible builds and flaky tests.',
    github: { login: 'rowan-sample', url: 'https://example.invalid/rowan-sample', verified: true,
      mergedPrs: 214 },
    certs: [
      { name: 'Kubernetes administrator', issuer: 'Sample Cert Board', provenance: 'proved' },
      { name: 'Incident commander', issuer: 'Driftwood Collective (sample)', provenance: 'earned' },
    ],
    work: [
      { title: 'Staff platform engineer', org: 'Lantern Works (sample)', from: '2023' },
      { title: 'SRE', org: 'Harbor Labs (sample)', from: '2019', to: '2023' },
    ],
    endorsements: [
      { from: MIRA, skill: 'CI/CD', body: 'Cut our pipeline from 40 to 9 minutes and wrote down how.' },
      { from: TEO, skill: 'On-call', body: 'Calm on the worst night of the quarter.' },
    ],
    community: { available: true, reputation: 1840, level: 12, xp: 23400, shippedCount: 37,
      projectCount: 6, badges: ['Shipped 25', 'Reviewer', 'First responder'] },
    connections: { count: 3, people: [MIRA, TEO, SAGE] },
    relationship: 'self',
  }),
  mira: base(MIRA, {
    headline: 'Founder, small analytics studio · open-source maintainer',
    bio: 'Building tools for co-ops that do their own books. Maintainer of a sample charting lib.',
    github: { login: 'mira-sample', url: 'https://example.invalid/mira-sample', verified: true,
      mergedPrs: 512 },
    certs: [{ name: 'Data engineering', issuer: 'Sample Cert Board', provenance: 'proved' }],
    work: [{ title: 'Founder', org: 'Tidewater Analytics (sample)', from: '2021' }],
    endorsements: [{ from: ROWAN, skill: 'Maintainership', body: 'Reviews every PR within a day.' }],
    community: { available: true, reputation: 3120, level: 18, xp: 51200, shippedCount: 88,
      projectCount: 11, badges: ['Maintainer', 'Mentor', 'Shipped 50'] },
    connections: { count: 2, people: [ROWAN, JUN] },
    relationship: 'friends',
  }),
  teo: base(TEO, {
    headline: 'Security engineer · threat modelling for small teams',
    bio: 'Former pentester. Now I help teams pick the three controls that matter.',
    github: { login: 'teo-sample', url: 'https://example.invalid/teo-sample', verified: true,
      mergedPrs: 63 },
    work: [{ title: 'Security lead', org: 'Quiet Harbor (sample)', from: '2022' }],
    community: { available: true, reputation: 960, level: 8, xp: 9100, shippedCount: 14,
      projectCount: 3, badges: ['Bug hunter'] },
    connections: { count: 1, people: [ROWAN] },
    relationship: 'request_received',
  }),
  jun: base(JUN, {
    headline: 'Designer learning to code in public',
    bio: 'Shipping my first open-source PRs this month.',
    community: { available: true, reputation: 120, level: 2, xp: 800, shippedCount: 2,
      projectCount: 1, badges: ['First PR'] },
    connections: { count: 1, people: [MIRA] },
    relationship: 'none',
  }),
}

/** Sage's Space is private: the demo must show the gate, not the profile. */
export const SAMPLE_PRIVATE = new Set(['sage'])

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600e3).toISOString()

export const SAMPLE_FEED: Post[] = [
  { id: 's1', channel: '#builders', author: 'mira', timestamp: hoursAgo(1),
    body: 'Released v2 of the sample charting lib. 14 contributors this cycle, 6 first-timers.' },
  { id: 's2', channel: '#devops', author: 'rowan', timestamp: hoursAgo(3),
    body: 'Write-up: how we made our flaky-test quarantine automatic. Thread is in the forum.' },
  { id: 's3', channel: '#security', author: 'teo', timestamp: hoursAgo(5),
    body: 'Office hours Thursday: bring your threat model, leave with three fixes.' },
  { id: 's4', channel: '#builders', author: 'jun', timestamp: hoursAgo(9),
    body: 'My first merged PR! A docs fix, but it counts.' },
]

export const SAMPLE_PLANETS: Planet[] = [
  { id: 'p1', name: 'Driftwood Collective (sample)', role: 'maintainer',
    discord: ['Driftwood (sample server)'], members: 412 },
  { id: 'p2', name: 'Lantern Works (sample)', role: 'member', discord: [], members: 38 },
]

export const SAMPLE_PEOPLE: People = {
  connections: [MIRA, TEO, SAGE],
  incoming: [{ id: 'r1', from: TEO, message: 'Saw your flaky-test write-up. Would like to compare notes.' }],
}

export class SampleClient implements NetworkClient {
  readonly mode = 'sample' as const
  async viewer() { return SAMPLE_VIEWER }
  async profile(username: string): Promise<ProfileResult> {
    if (SAMPLE_PRIVATE.has(username)) return { gate: 'private' }
    const profile = SAMPLE_PROFILES[username]
    return profile ? { gate: 'ok', profile } : { gate: 'none' }
  }
  async feed() { return SAMPLE_FEED }
  async people() { return SAMPLE_PEOPLE }
  async planets() { return SAMPLE_PLANETS }
  async connect() {
    return { ok: false, message: 'This is the sample demo. Sign in with Aitherium to connect for real.' }
  }
  async post() { return { ok: false, message: 'Sample demo: nothing was posted. Sign in to post.' } }
  async shareStatus() {
    return { available: true, connected: false, postsLeftToday: 2, postsPerDay: 2,
      reason: 'Sample demo: sign in to connect your own account.' }
  }
  async shareConnectUrl() { return { ok: false, message: 'Sign in first.' } }
  async shareToLinkedIn() { return { ok: false, message: 'Sample demo: nothing was shared.' } }
}
