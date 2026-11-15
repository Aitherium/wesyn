// The shell: mode banner, navigation, sign-in, hash routes. AGPL-3.0-only.
import { useEffect, useMemo, useState } from 'react'
import { LiveClient } from './api/live'
import type { NetworkClient, Viewer } from './api/types'
import { DEFAULT_OIDC, authorizeUrl, handleCallback, readToken, signOut } from './auth/oidc'
import { FeedView, MessagesView, PeopleView, PlanetsView } from './views/Lists'
import { ProfileView } from './views/Profile'
import { ImportView } from './views/Import'
import { JobsView } from './views/Jobs'
import { WelcomeView } from './views/Welcome'

export const API_BASE = 'https://api.aitherium.com'
const USERINFO = `${DEFAULT_OIDC.issuer}/oidc/userinfo`

const KNOWN = new Set(['/', '/people', '/worlds', '/planets', '/messages', '/jobs', '/import'])

const TABS = [
  ['#/', 'feed'], ['#/people', 'people'], ['#/worlds', 'worlds'], ['#/messages', 'messages'], ['#/jobs', 'jobs'], ['#/import', 'import'],
] as const

function useHash(): [string, (h: string) => void] {
  const [hash, setHash] = useState(window.location.hash || '#/')
  useEffect(() => {
    const on = () => setHash(window.location.hash || '#/')
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return [hash, (h: string) => { window.location.hash = h }]
}

export default function App() {
  const [hash, go] = useHash()
  const [token, setToken] = useState<string | null>(() => readToken(sessionStorage))
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [authErr, setAuthErr] = useState('')

  // Finish a sign-in round trip (the IdP calls back to the app root with ?code&state).
  useEffect(() => {
    if (!window.location.search) return
    handleCallback(DEFAULT_OIDC, sessionStorage, window.location.search).then(r => {
      if (r.kind === 'none') return
      window.history.replaceState(null, '', window.location.pathname + (r.kind === 'ok' ? r.returnTo : '#/'))
      if (r.kind === 'ok') { setToken(r.token); window.dispatchEvent(new HashChangeEvent('hashchange')) }
      else setAuthErr(r.message)
    })
  }, [])

  // Signed out = no client. Wesyn never shows sample people (owner, 2026-11-14).
  const client: NetworkClient | null = useMemo(
    () => (token ? new LiveClient({ apiBase: API_BASE, userinfoUrl: USERINFO, token }) : null),
    [token],
  )
  useEffect(() => {
    if (!client) { setViewer(null); return }
    let live = true
    client.viewer().then(v => {
      if (!live) return
      if (!v) { signOut(sessionStorage); setToken(null); setAuthErr('Your sign-in expired.') }
      setViewer(v)
    }).catch(() => { if (live) setViewer(null) })
    return () => { live = false }
  }, [client])

  const signIn = async () => { window.location.href = await authorizeUrl(DEFAULT_OIDC, sessionStorage, hash) }
  const leave = () => { signOut(sessionStorage); setToken(null); setAuthErr('') }

  const route = hash.replace(/^#/, '') || '/'
  const user = route.startsWith('/u/') ? decodeURIComponent(route.slice(3)) : ''
  return (
    <div className="shell">
      <header className="top">
        <a className="brand" href="#/">wesyn<span className="beta">beta</span></a>
        <nav aria-label="Sections">
          {TABS.map(([h, label]) => (
            <a key={h} href={h} aria-current={hash === h ? 'page' : undefined}>{label}</a>
          ))}
          {viewer && <a href={`#/u/${viewer.username}`} aria-current={user === viewer.username ? 'page' : undefined}>you</a>}
        </nav>
        {client
          ? <button className="ghost" onClick={leave}>Sign out{viewer ? ` @${viewer.username}` : ''}</button>
          : <button className="primary" onClick={signIn}>Sign in with Aitherium</button>}
      </header>
      {authErr && <p className="err" role="alert">{authErr}</p>}
      <main>
        {!client && route !== '/import' && !(route !== '/' && !KNOWN.has(route) && !user) ? <WelcomeView signIn={signIn} />
          : user && client ? <ProfileView client={client} username={user} go={go} />
          : route === '/import' ? <ImportView />
          : !client ? <p className="err" role="alert">No such page. <a href="#/">Back to the start</a></p>
          : route === '/people' ? <PeopleView client={client} go={go} />
          : route === '/worlds' || route === '/planets' ? <PlanetsView client={client} />
          : route === '/messages' ? <MessagesView client={client} />
          : route === '/jobs' ? <JobsView client={client} />
          : route === '/' ? <FeedView client={client} />
          : <p className="err" role="alert">No such page. <a href="#/">Back to the feed</a></p>}
      </main>
      <footer className="foot">
        Open source (AGPL-3.0) · <a href="https://github.com/Aitherium/wesyn">github.com/Aitherium/wesyn</a> · Join from Discord with <code>/wesyn join</code>
      </footer>
    </div>
  )
}
