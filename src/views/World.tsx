// One world: its pinned sites and agents, forum, live chat, OSINT panel and copilot.
// AGPL-3.0-only.
//
// Everything here is the world's ONE AitherRelay workspace, read and written as the
// signed-in member. Slots other surfaces fill (the Studio pins sites and agents) are
// marked with `data-slot` so they can find them.
import { useEffect, useState, type FormEvent } from 'react'
import { ago } from '../api/helpers'
import type { ChatLine, NetworkClient, WorldDetail } from '../api/types'
import { Copilot } from '../copilot/Copilot'
import { Forum } from './Forum'
import { Osint } from './Osint'

const POLL_MS = 5000

function Chat({ client, channels }: { client: NetworkClient; channels: string[] }) {
  const [room, setRoom] = useState(channels[0] || '')
  const [lines, setLines] = useState<ChatLine[] | null>(null)
  const [draft, setDraft] = useState('')
  const [msg, setMsg] = useState('')
  useEffect(() => {
    if (!room) return
    let live = true
    const pull = () => client.world.chat(room).then(l => { if (live) setLines(l) }).catch(() => { if (live) setLines([]) })
    pull()
    const t = setInterval(pull, POLL_MS)
    return () => { live = false; clearInterval(t) }
  }, [client, room])
  const send = async (e: FormEvent) => {
    e.preventDefault()
    const r = await client.world.say(room, draft.trim())
    setMsg(r.ok ? '' : r.message)
    if (r.ok) { setDraft(''); client.world.chat(room).then(setLines) }
  }
  return (
    <section className="card" aria-label="Live chat">
      <h2>Live chat</h2>
      <nav className="row" aria-label="Rooms">{channels.map(c => (
        <button key={c} className={c === room ? 'primary' : 'ghost'} aria-pressed={c === room} onClick={() => setRoom(c)}>{c}</button>
      ))}</nav>
      {!channels.length && <p className="dim">This world has no rooms you can read.</p>}
      {lines?.length === 0 && <p className="dim">No messages yet.</p>}
      <ol className="rows chat">{lines?.map(l => (
        <li key={l.id}><a href={`#/u/${l.author}`}>@{l.author}</a> <span className="mono dim">{ago(l.timestamp)}</span> {l.body}</li>
      ))}</ol>
      {room && (
        <form className="row" onSubmit={send}>
          <input aria-label="Say something" placeholder={`Message ${room}`} value={draft} onChange={e => setDraft(e.target.value)} />
          <button className="primary" type="submit" disabled={!draft.trim()}>Send</button>
        </form>
      )}
      {msg && <p className="err">{msg}</p>}
    </section>
  )
}

export function WorldView({ client, slug, me }: { client: NetworkClient; slug: string; me: string }) {
  const [world, setWorld] = useState<WorldDetail | null>(null)
  const [err, setErr] = useState('')
  const [tick, setTick] = useState(0)
  const [osintOpen, setOsintOpen] = useState(false)
  useEffect(() => {
    let live = true
    client.world.open(slug).then(w => { if (live) setWorld(w) })
      .catch((e: unknown) => { if (live) setErr(e instanceof Error ? e.message : 'Could not open this world.') })
    return () => { live = false }
  }, [client, slug, tick])

  if (err) {
    // A workspace with no Relay space yet (e.g. a Discord binding not provisioned in Relay).
    const text = /not found/i.test(err)
      ? 'This world has no Relay space yet: its forum and rooms appear once it is set up.' : err
    return <p className="err" role="alert">{text} <a href="#/worlds">Your worlds</a></p>
  }
  if (!world) return <p className="dim">Loading…</p>
  const pinned = world.settings.pinned || []
  const showOsint = osintOpen || !!world.settings.osint
  return (
    <div className="stack" aria-label={`World: ${world.name}`}>
      <header className="card">
        <h1>{world.name}</h1>
        <p className="mono dim">{world.role} · {world.channels.length} room(s) · Relay workspace {world.slug}</p>
        {world.description && <p>{world.description}</p>}
      </header>
      <section className="card" data-slot="world-pinned" aria-label="Pinned">
        <h2>Pinned</h2>
        {pinned.length === 0 && <p className="dim">No sites or agents pinned to this world yet.</p>}
        <ul className="rows">{pinned.map(p => (
          <li key={p.url}><span className="mono dim">{p.kind}</span> <a href={p.url} target="_blank" rel="noopener noreferrer">{p.title}</a></li>
        ))}</ul>
      </section>
      <div className="world-grid">
        <div className="stack">
          <Forum client={client.world} slug={world.slug} refresh={tick} />
          <Chat client={client} channels={world.channels} />
        </div>
        <div className="stack" data-slot="world-side">
          <Copilot world={world} client={client.world} me={me} />
          {showOsint
            ? <Osint client={client.world} world={world} onSaved={() => setTick(n => n + 1)} />
            : <button className="ghost" onClick={() => setOsintOpen(true)}>Open the OSINT panel</button>}
        </div>
      </div>
    </div>
  )
}
