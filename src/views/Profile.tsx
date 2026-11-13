// A member's profile: earned standing, proved identity, connections. AGPL-3.0-only.
import { useEffect, useState } from 'react'
import { profileAction } from '../api/helpers'
import type { NetworkClient, Profile as P, ProfileResult } from '../api/types'

const GATE_TEXT: Record<string, string> = {
  private: 'This profile is private.',
  none: 'No member by that name.',
  removed: 'This profile was removed.',
  error: 'Could not load this profile.',
}

export function ProfileView({ client, username, go }: {
  client: NetworkClient; username: string; go: (hash: string) => void
}) {
  const [res, setRes] = useState<ProfileResult | null>(null)
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    let live = true
    setRes(null); setNote('')
    client.profile(username).then(r => { if (live) setRes(r) })
      .catch(() => { if (live) setRes({ gate: 'error' }) })
    return () => { live = false }
  }, [client, username])

  if (!res) return <p className="dim">Loading…</p>
  // A gate other than ok shows ONE line and nothing else about the member.
  if (res.gate !== 'ok') return <p className="gate" role="status">{GATE_TEXT[res.gate]}</p>
  const p = res.profile
  const action = profileAction(p.relationship)
  const act = async () => {
    if (action.kind === 'connect' || action.kind === 'accept') {
      const r = await client.connect(p.username)
      setNote(r.message)
    } else if (action.kind === 'message') go('#/messages')
    else if (action.kind === 'edit' && client.mode === 'sample') setNote('This is a sample profile. Sign in to edit yours.')
    else if (action.kind === 'edit') window.open('https://app.aitherium.com/spaces/' + encodeURIComponent(p.username), '_blank', 'noopener')
  }
  const copyLink = async () => {
    const url = `https://aitherium.github.io/wesyn/#/u/${encodeURIComponent(p.username)}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setNote('Could not copy link.')
    }
  }
  return (
    <article className="stack" aria-label={`Profile of ${p.displayName}`}>
      <header className="card hero">
        <div className="avatar" aria-hidden>{p.displayName.slice(0, 1)}</div>
        <div className="grow">
          <h1>{p.displayName}</h1>
          <p className="mono dim">@{p.username}</p>
          {p.headline && <p>{p.headline}</p>}
        </div>
        <button className="primary" onClick={act} disabled={action.kind === 'pending' || action.kind === 'signin'}>
          {action.label}
        </button>
        <button className="link" onClick={copyLink} type="button">{copied ? 'Copied!' : 'Copy link'}</button>
      </header>
      {note && <p className="dim" role="status">{note}</p>}
      {p.bio && <section className="card"><h2>About</h2><p>{p.bio}</p></section>}
      <Standing p={p} />
      <Engineering p={p} />
      {p.work.length > 0 && (
        <section className="card"><h2>Work</h2>
          <ul className="rows">{p.work.map(w => (
            <li key={w.title + w.org}><b>{w.title}</b> · {w.org}<span className="mono dim"> {w.from}–{w.to || 'now'}</span></li>
          ))}</ul>
        </section>
      )}
      {p.endorsements.length > 0 && (
        <section className="card"><h2>Endorsed for</h2>
          <ul className="rows">{p.endorsements.map(e => (
            <li key={e.from.username + e.skill}><b>{e.skill}</b>: “{e.body}” <a href={`#/u/${e.from.username}`}>{e.from.displayName}</a></li>
          ))}</ul>
        </section>
      )}
      <section className="card"><h2>Connections · {p.connections.count}</h2>
        <ul className="chips">{p.connections.people.map(c => (
          <li key={c.username}><a href={`#/u/${c.username}`}>{c.displayName}</a></li>
        ))}</ul>
      </section>
    </article>
  )
}

function Standing({ p }: { p: P }) {
  const c = p.community
  return (
    <section className="card" aria-label="Earned standing">
      <h2>Earned standing</h2>
      {!c.available
        ? <p className="dim">No community standing linked to this account yet.</p>
        : (
          <>
            <dl className="stats">
              <div><dt>reputation</dt><dd>{c.reputation ?? 0}</dd></div>
              <div><dt>level</dt><dd>{c.level ?? 1}</dd></div>
              <div><dt>shipped</dt><dd>{c.shippedCount ?? 0}</dd></div>
              <div><dt>projects</dt><dd>{c.projectCount ?? 0}</dd></div>
            </dl>
            {c.badges.length > 0 && <ul className="chips">{c.badges.map(b => <li key={b}>{b}</li>)}</ul>}
          </>
        )}
      <p className="fine">Earned in communities. Nobody types their own reputation.</p>
    </section>
  )
}

function Engineering({ p }: { p: P }) {
  if (!p.github && p.certs.length === 0) return null
  return (
    <section className="card" aria-label="Engineering">
      <h2>Engineering</h2>
      <ul className="rows">
        {p.github && (
          <li>
            GitHub <a href={p.github.url} rel="noopener noreferrer">{p.github.login}</a>
            {p.github.verified && <span className="tag ok">proved by sign-in</span>}
            {p.github.mergedPrs !== undefined && <span className="mono dim"> · {p.github.mergedPrs} merged PRs</span>}
          </li>
        )}
        {p.certs.map(c => (
          <li key={c.name}>{c.name} · {c.issuer} <span className={`tag ${c.provenance === 'claimed' ? '' : 'ok'}`}>{c.provenance}</span></li>
        ))}
      </ul>
    </section>
  )
}
