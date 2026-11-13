import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_OIDC, authorizeUrl, challengeFor, handleCallback } from './oidc'

class Mem implements Storage {
  m = new Map<string, string>()
  get length() { return this.m.size }
  clear() { this.m.clear() }
  getItem(k: string) { return this.m.get(k) ?? null }
  key(i: number) { return [...this.m.keys()][i] ?? null }
  removeItem(k: string) { this.m.delete(k) }
  setItem(k: string, v: string) { this.m.set(k, v) }
}

describe('PKCE', () => {
  it('S256 is base64url(sha256(verifier)), cross-checked with Python hashlib', async () => {
    expect(await challengeFor('w'.repeat(64))).toBe('VLdPo7dRMXA8V_FxhD3Fi37GM4EMHUFGl6ezFNX8bV0')
  })

  it('authorize carries S256, the public client and the exact callback', async () => {
    const url = new URL(await authorizeUrl(DEFAULT_OIDC, new Mem(), '#/people'))
    expect(url.searchParams.get('client_id')).toBe('wesyn-pages')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('redirect_uri')).toBe('https://aitherium.github.io/wesyn/')
  })

  it('refuses a callback whose state this tab did not mint', async () => {
    const s = new Mem()
    await authorizeUrl(DEFAULT_OIDC, s, '#/')
    const f = vi.fn()
    const r = await handleCallback(DEFAULT_OIDC, s, '?code=abc&state=forged', f as unknown as typeof fetch)
    expect(r.kind).toBe('error')
    expect(f).not.toHaveBeenCalled()
  })

  it('redeems the code with the verifier and keeps the token', async () => {
    const s = new Mem()
    const url = new URL(await authorizeUrl(DEFAULT_OIDC, s, '#/planets'))
    const f = vi.fn(async () => new Response(JSON.stringify({ access_token: 'at' }), { status: 200 }))
    const r = await handleCallback(DEFAULT_OIDC, s, `?code=abc&state=${url.searchParams.get('state')}`,
      f as unknown as typeof fetch)
    expect(r).toEqual({ kind: 'ok', token: 'at', returnTo: '#/planets' })
    const body = String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body)
    expect(body).toContain('code_verifier=')
    expect(s.getItem('wesyn.token')).toBe('at')
  })
})
