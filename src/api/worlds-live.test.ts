import { describe, expect, it } from 'vitest'
import { mergeWorlds } from './live'
import { LiveWorlds, safeLink, toOsint, worldSlug } from './worlds-live'

type Call = { url: string; init: RequestInit }

function fake(answers: Record<string, { status: number; body: unknown }>) {
  const calls: Call[] = []
  const f = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init })
    const key = Object.keys(answers).find(k => url.includes(k))
    const a = key ? answers[key] : { status: 404, body: {} }
    return new Response(JSON.stringify(a.body), { status: a.status })
  }) as unknown as typeof fetch
  return { f, calls }
}

const api = 'https://api.example'

describe('a world, live', () => {
  it('reads the forum from the Relay workspace with the bearer and no cookies', async () => {
    const { f, calls } = fake({ '/forum/categories': { status: 200, body: { categories: [{ id: 'general', name: 'General', thread_count: 2 }] } } })
    const w = new LiveWorlds(api, 'tok', f, async () => 'pip')
    expect(await w.boards('drift wood')).toEqual([{ id: 'general', name: 'General', description: '', threadCount: 2 }])
    expect(calls[0].url).toBe(`${api}/api/relay/v1/workspaces/drift%20wood/forum/categories`)
    expect(calls[0].init.credentials).toBe('omit')
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
  })

  it('a refused read says the server\'s reason, never "nothing here"', async () => {
    const { f } = fake({ '/forum/categories': { status: 403, body: { detail: 'Not a member of this workspace' } } })
    await expect(new LiveWorlds(api, 't', f, async () => '').boards('x')).rejects.toThrow('Not a member of this workspace')
  })

  it('a reply posts to the thread as the member', async () => {
    const { f, calls } = fake({ '/posts': { status: 200, body: { success: true } } })
    const r = await new LiveWorlds(api, 't', f, async () => 'pip').reply('drift', 't1', 'yes')
    expect(r.ok).toBe(true)
    expect(calls[0].url).toBe(`${api}/api/relay/v1/workspaces/drift/forum/threads/t1/posts`)
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ content: 'yes', author: 'pip' })
  })

  it('an older Relay that ignores world settings is reported, not claimed as saved', async () => {
    const { f } = fake({ '/workspaces/drift': { status: 200, body: { workspace: { slug: 'drift' } } } })
    const r = await new LiveWorlds(api, 't', f, async () => '').saveSettings('drift', { osint: { query: 'Ohio', label: 'Ohio' } })
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/does not keep world settings/)
  })

  it('OSINT asks our public door with no token, and drops non-http links', async () => {
    const { f, calls } = fake({ '/api/osint/news': { status: 200, body: { results: [
      { title: 'A', link: 'javascript:alert(1)' }, { title: 'B', link: 'https://n.example/b', lat: 1, lng: 2 }],
      notice: 'Leads to verify.', source: { board: 'https://board.example', software: 'https://github.com/wizzense/Shadowbroker', software_license: 'AGPL-3.0' } } } })
    const r = await new LiveWorlds(api, 'secret-token', f, async () => '').osint('news', 'Baltic Sea')
    expect(calls[0].url).toBe(`${api}/api/osint/news?q=Baltic%20Sea&limit=8`)
    expect(JSON.stringify(calls[0].init)).not.toContain('secret-token')
    expect(r.items[0].link).toBeUndefined()
    expect(r.items[1]).toMatchObject({ title: 'B', link: 'https://n.example/b', lat: 1, lng: 2 })
    expect(r.license).toBe('AGPL-3.0')
  })

  it('helpers', () => {
    expect(worldSlug('Occupy SaaS!')).toBe('occupy-saas')
    expect(safeLink('data:text/html,x')).toBeUndefined()
    expect(toOsint({ label: 'SHIP 1', type: 'ship', lat: 'x' }).lat).toBeUndefined()
  })
})

describe('the member\'s worlds', () => {
  it('joins their workspaces (with Discord) and their Relay workspaces by slug', () => {
    const out = mergeWorlds(
      [{ workspace_id: 'ws-1', slug: 'occupy', name: 'Occupy SaaS', role: 'editor', discord: [{ name: 'Occupy Discord' }] }],
      [{ id: 'r1', slug: 'occupy', name: 'Occupy SaaS', role: 'member', member_count: 40, world: { osint: { query: 'Ohio', label: 'Ohio' } } },
        { id: 'r2', slug: 'new-world', name: 'New world', role: 'owner' }])
    expect(out).toEqual([
      { id: 'ws-1', slug: 'occupy', name: 'Occupy SaaS', role: 'editor', discord: ['Occupy Discord'], members: 40,
        settings: { osint: { query: 'Ohio', label: 'Ohio' } } },
      { id: 'r2', slug: 'new-world', name: 'New world', role: 'owner', discord: [], members: undefined, settings: undefined },
    ])
  })
})
