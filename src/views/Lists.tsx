// Feed, people, planets, messages. AGPL-3.0-only.
import { useEffect, useState, type FormEvent } from 'react'
import { ago, cleanHandle } from '../api/helpers'
import type { NetworkClient, People, Planet, Post } from '../api/types'
import { Composer } from './Composer'

function useLoad<T>(load: () => Promise<T>, deps: unknown[]): { data: T | null; err: string } {
  const [data, setData] = useState<T | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let live = true
    setData(null); setErr('')
    load().then(d => { if (live) setData(d) })
      .catch((e: unknown) => { if (live) setErr(e instanceof Error ? e.message : 'Could not load.') })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { data, err }
}

export function FeedView({ client }: { client: NetworkClient }) {
  const [reload, setReload] = useState(0)
  const { data, err } = useLoad<Post[]>(() => client.feed(), [client, reload])
  const rooms = [...new Set((data || []).map(p => p.channel))]
  return (
    <section className="stack" aria-label="Feed">
      <Composer client={client} rooms={rooms} onPosted={() => setReload(n => n + 1)} />
      <p className="dim">Posts from the rooms you can read. A Discord forum and its Relay room are one conversation.</p>
      {err && <p className="err">{err}</p>}
      {!data && !err && <p className="dim">Loading…</p>}
      {data?.length === 0 && <p className="dim">Nothing yet in the rooms you can read.</p>}
      {data?.map(post => (
        <article key={post.id} className="card post">
          <header><a href={`#/u/${post.author}`}>@{post.author}</a><span className="mono dim"> {post.channel} · {ago(post.timestamp)}</span></header>
          <p className="clamp">{post.body}</p>
        </article>
      ))}
    </section>
  )
}

export function PeopleView({ client, go }: { client: NetworkClient; go: (h: string) => void }) {
  const { data, err } = useLoad<People>(() => client.people(), [client])
  const [draft, setDraft] = useState('')
  const open = (e: FormEvent) => { e.preventDefault(); const h = cleanHandle(draft); if (h) go(`#/u/${h}`) }
  return (
    <section className="stack" aria-label="People">
      <form className="row" onSubmit={open}>
        <input aria-label="Find a member" placeholder="@handle" value={draft} onChange={e => setDraft(e.target.value)} />
        <button className="primary" type="submit" disabled={!cleanHandle(draft)}>Open profile</button>
      </form>
      {err && <p className="err">{err}</p>}
      {data && data.incoming.length > 0 && (
        <div className="card"><h2>Asked to connect · {data.incoming.length}</h2>
          <ul className="rows">{data.incoming.map(r => (
            <li key={r.id}><a href={`#/u/${r.from.username}`}>{r.from.displayName}</a>{r.message && <span className="dim">: {r.message}</span>}</li>
          ))}</ul>
        </div>
      )}
      <div className="card"><h2>Connections · {data?.connections.length ?? 0}</h2>
        {data?.connections.length === 0 && <p className="dim">No connections yet. Open a profile to connect.</p>}
        <ul className="rows">{data?.connections.map(c => (
          <li key={c.username}><a href={`#/u/${c.username}`}>{c.displayName}</a> <span className="mono dim">@{c.username}</span></li>
        ))}</ul>
      </div>
    </section>
  )
}

export function PlanetsView({ client }: { client: NetworkClient }) {
  const { data, err } = useLoad<Planet[]>(() => client.planets(), [client])
  return (
    <section className="stack" aria-label="Planets">
      <p className="dim">A planet is a community you belong to: a workspace, and the Discord server bound to it.</p>
      {err && <p className="err">{err}</p>}
      {data?.length === 0 && <p className="dim">You are not on any planet yet. Join one from its Discord with <code>/wesyn join</code>.</p>}
      <ul className="grid">{data?.map(p => (
        <li key={p.id} className="card">
          <h2>{p.name}</h2>
          <p className="mono dim">{p.role}{p.members !== undefined ? ` · ${p.members} members` : ''}</p>
          {p.discord.length > 0 && <p className="dim">Discord: {p.discord.join(', ')}</p>}
        </li>
      ))}</ul>
    </section>
  )
}

export function MessagesView({ client }: { client: NetworkClient }) {
  return (
    <section className="stack" aria-label="Messages">
      <div className="card">
        <h2>Messages</h2>
        <p>Direct messages live in AitherRelay and are mirrored to Discord, so a conversation keeps
          working when either side is down.</p>
        {client.mode === 'live'
          ? <a className="primary link" href="https://relay.aitherium.com/" target="_blank" rel="noopener">Open Relay</a>
          : <p className="dim">In the sample demo there are no real messages. Sign in to use yours.</p>}
      </div>
    </section>
  )
}
