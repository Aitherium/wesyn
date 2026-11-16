// Your worlds, and making a new one. AGPL-3.0-only.
//
// A world is a community you belong to: one AitherRelay workspace (its rooms and its
// forum board), with the Discord server bound to it mirrored into those same rooms.
// "Create a world" makes that Relay workspace; you are its owner.
import { useEffect, useState, type FormEvent } from 'react'
import type { NetworkClient, World } from '../api/types'
import { worldSlug } from '../api/worlds-live'

export function WorldsView({ client, go }: { client: NetworkClient; go: (h: string) => void }) {
  const [data, setData] = useState<World[] | null>(null)
  const [err, setErr] = useState('')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let live = true
    setData(null); setErr('')
    client.worlds().then(d => { if (live) setData(d) })
      .catch((e: unknown) => { if (live) setErr(e instanceof Error ? e.message : 'Could not load.') })
    return () => { live = false }
  }, [client])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true); setMsg('')
    const r = await client.world.create(name, worldSlug(name))
    setBusy(false)
    if (r.ok && r.slug) go(`#/w/${encodeURIComponent(r.slug)}`)
    else setMsg(r.message)
  }

  return (
    <section className="stack" aria-label="Worlds">
      <p className="dim">A world is a community you belong to: its Relay rooms and forum, and the Discord server bound to it.</p>
      {client.mode === 'live' && (
        <form className="row" onSubmit={create} aria-label="Create a world">
          <input aria-label="World name" placeholder="Name a new world" maxLength={64} value={name} onChange={e => setName(e.target.value)} />
          <button className="primary" type="submit" disabled={!worldSlug(name) || worldSlug(name).length < 2 || busy}>Create a world</button>
        </form>
      )}
      {msg && <p className="err" role="alert">{msg}</p>}
      {err && <p className="err">{err}</p>}
      {client.mode === 'sample' && <p className="dim">Sign in with Aitherium to see your worlds.</p>}
      {client.mode === 'live' && data?.length === 0 && (
        <p className="dim">You are not in any world yet. Occupy SaaS is the first connected world; join one from its Discord with <code>/wesyn join</code>, or create one.</p>
      )}
      <ul className="grid">{(client.mode === 'live' ? data : [])?.map(w => (
        <li key={w.slug} className="card">
          <h2><a href={`#/w/${encodeURIComponent(w.slug)}`}>{w.name}</a></h2>
          <p className="mono dim">{w.role}{w.members !== undefined ? ` · ${w.members} members` : ''}</p>
          <p className="dim">{w.discord.length ? `Discord: ${w.discord.join(', ')}` : 'No Discord server bound'}</p>
        </li>
      ))}</ul>
    </section>
  )
}
