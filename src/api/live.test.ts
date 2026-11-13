import { describe, expect, it, vi } from 'vitest'
import { LiveClient } from './live'

const cfg = { apiBase: 'https://api.example', userinfoUrl: 'https://idp.example/userinfo', token: 'tok' }
const res = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('LiveClient', () => {
  it('a private Space shows the gate and reads NOTHING else', async () => {
    const f = vi.fn(async () => res(403, { detail: 'Access denied' }))
    const out = await new LiveClient(cfg, f as unknown as typeof fetch).profile('sage')
    expect(out).toEqual({ gate: 'private' })
    expect(f).toHaveBeenCalledTimes(1)          // the standing route is never asked
  })

  it('visibility tightening between the two reads wins', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(res(200, { config: { display_name: 'Ada' } }))
      .mockResolvedValueOnce(res(403))
    const out = await new LiveClient(cfg, f as unknown as typeof fetch).profile('ada')
    expect(out).toEqual({ gate: 'private' })
  })

  it('a visible Space maps standing; GitHub only when the server proved it', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(res(200, { config: { display_name: 'Ada', blocks: [
        { type: 'bio', config: { html: '<p>Hi <b>there</b></p>' } }] } }))
      .mockResolvedValueOnce(res(200, { relationship: 'none', github: { login: 'ada', url: 'https://github.com/ada' },
        connections: { count: 1, people: [{ username: 'bo', display_name: 'Bo' }] },
        community: { available: true, reputation: 9, badges: [{ title: 'Shipped' }] } }))
    const out = await new LiveClient(cfg, f as unknown as typeof fetch).profile('ada')
    expect(out.gate).toBe('ok')
    if (out.gate !== 'ok') return
    expect(out.profile.bio).toBe('Hi there')
    expect(out.profile.github?.verified).toBe(true)
    expect(out.profile.community.badges).toEqual(['Shipped'])
    expect(out.profile.connections.people[0].displayName).toBe('Bo')
  })

  it('sends the bearer and never ambient credentials', async () => {
    const f = vi.fn(async () => res(200, { friends: [] }))
    await new LiveClient(cfg, f as unknown as typeof fetch).people()
    for (const call of f.mock.calls as unknown as [string, RequestInit][]) {
      expect(call[1].credentials).toBe('omit')
      expect((call[1].headers as Record<string, string>).Authorization).toBe('Bearer tok')
    }
  })
})
