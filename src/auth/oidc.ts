// "Sign in with Aitherium": OIDC authorization code + PKCE (S256), no client secret.
// AGPL-3.0-only.
//
// The IdP registers this app as the PUBLIC client `wesyn-pages` with exactly one
// callback, the app's own Pages root. The verifier and state live in sessionStorage
// for the one round trip; the access token lives in sessionStorage for the tab and is
// sent only as a bearer header to the configured API, never as a cookie.

export interface OidcConfig {
  issuer: string         // https://idp.aitherium.com/identity
  clientId: string       // wesyn-pages
  redirectUri: string    // https://aitherium.github.io/wesyn/
}

export const DEFAULT_OIDC: OidcConfig = {
  issuer: 'https://idp.aitherium.com/identity',
  clientId: 'wesyn-pages',
  redirectUri: 'https://aitherium.github.io/wesyn/',
}

const K_VERIFIER = 'wesyn.pkce.verifier'
const K_STATE = 'wesyn.pkce.state'
const K_RETURN = 'wesyn.pkce.return'
const K_TOKEN = 'wesyn.token'

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function randomString(n = 48): string {
  const a = new Uint8Array(n)
  crypto.getRandomValues(a)
  return b64url(a)
}

/** RFC 7636 S256: base64url(sha256(verifier)). */
export async function challengeFor(verifier: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return b64url(new Uint8Array(d))
}

export async function authorizeUrl(cfg: OidcConfig, store: Storage, returnTo: string): Promise<string> {
  const verifier = randomString()
  const state = randomString(24)
  store.setItem(K_VERIFIER, verifier)
  store.setItem(K_STATE, state)
  store.setItem(K_RETURN, returnTo)
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: 'openid profile email',
    state,
    code_challenge: await challengeFor(verifier),
    code_challenge_method: 'S256',
  })
  return `${cfg.issuer}/oidc/authorize?${q}`
}

export type CallbackResult =
  | { kind: 'none' }
  | { kind: 'ok'; token: string; returnTo: string }
  | { kind: 'error'; message: string }

/** Finish the round trip when the URL carries ?code&state. Refuses a state it did not mint. */
export async function handleCallback(
  cfg: OidcConfig, store: Storage, search: string, f: typeof fetch = fetch.bind(globalThis),
): Promise<CallbackResult> {
  const q = new URLSearchParams(search)
  if (q.get('error')) return { kind: 'error', message: q.get('error_description') || q.get('error') || '' }
  const code = q.get('code')
  if (!code) return { kind: 'none' }
  const expected = store.getItem(K_STATE)
  const verifier = store.getItem(K_VERIFIER)
  const returnTo = store.getItem(K_RETURN) || '#/'
  store.removeItem(K_STATE)
  store.removeItem(K_VERIFIER)
  store.removeItem(K_RETURN)
  if (!expected || !verifier || q.get('state') !== expected) {
    return { kind: 'error', message: 'Sign-in did not match this tab. Try again.' }
  }
  const r = await f(`${cfg.issuer}/oidc/token`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: cfg.redirectUri,
      client_id: cfg.clientId, code_verifier: verifier,
    }),
  })
  if (!r.ok) return { kind: 'error', message: `The sign-in server answered ${r.status}.` }
  const body = (await r.json().catch(() => null)) as { access_token?: string } | null
  if (!body?.access_token) return { kind: 'error', message: 'No token came back.' }
  store.setItem(K_TOKEN, body.access_token)
  return { kind: 'ok', token: body.access_token, returnTo }
}

export const readToken = (store: Storage) => store.getItem(K_TOKEN)
export const signOut = (store: Storage) => store.removeItem(K_TOKEN)
