// A world's forum: Relay's workspace forum, read and written as the member. AGPL-3.0-only.
import { useEffect, useState, type FormEvent } from 'react'
import { ago } from '../api/helpers'
import type { ForumBoard, ForumPost, ForumThread, WorldClient } from '../api/types'

export function Forum({ client, slug, refresh }: { client: WorldClient; slug: string; refresh: number }) {
  const [boards, setBoards] = useState<ForumBoard[]>([])
  const [board, setBoard] = useState('')
  const [threads, setThreads] = useState<ForumThread[] | null>(null)
  const [open, setOpen] = useState<{ thread: ForumThread; posts: ForumPost[] } | null>(null)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<ForumThread[] | null>(null)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [reply, setReply] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    client.boards(slug).then(b => { setBoards(b); setBoard(cur => cur || b[0]?.id || '') })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'The forum did not answer.'))
  }, [client, slug, tick, refresh])
  useEffect(() => {
    if (!board) return
    setThreads(null)
    client.threads(slug, board).then(setThreads).catch(() => setThreads([]))
  }, [client, slug, board, tick, refresh])

  const openThread = (id: string) => client.thread(slug, id).then(setOpen)
    .catch((e: unknown) => setMsg(e instanceof Error ? e.message : 'Could not open the thread.'))
  const search = (e: FormEvent) => { e.preventDefault(); if (q.trim()) client.search(slug, q.trim()).then(setHits) }
  const start = async (e: FormEvent) => {
    e.preventDefault()
    const r = await client.startThread(slug, board, title.trim(), text.trim())
    setMsg(r.message)
    if (r.ok) { setTitle(''); setText(''); setTick(n => n + 1); if (r.id) openThread(r.id) }
  }
  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!open) return
    const r = await client.reply(slug, open.thread.id, reply.trim())
    setMsg(r.message)
    if (r.ok) { setReply(''); openThread(open.thread.id); setTick(n => n + 1) }
  }
  useEffect(() => { if (open && refresh) openThread(open.thread.id) }, [refresh]) // eslint-disable-line react-hooks/exhaustive-deps

  const row = (t: ForumThread) => (
    <li key={t.id}><button className="linkish" onClick={() => openThread(t.id)}>{t.pinned ? '[pinned] ' : ''}{t.title}</button>
      <span className="mono dim"> @{t.author} · {t.replies} repl{t.replies === 1 ? 'y' : 'ies'} · {ago(t.updatedAt)}</span></li>
  )
  return (
    <section className="card" aria-label="Forum">
      <h2>Forum</h2>
      {err && <p className="err">{err}</p>}
      <nav className="row" aria-label="Boards">{boards.map(b => (
        <button key={b.id} className={b.id === board ? 'primary' : 'ghost'} aria-pressed={b.id === board}
          onClick={() => { setBoard(b.id); setOpen(null); setHits(null) }}>{b.name} · {b.threadCount}</button>
      ))}</nav>
      <form className="row" onSubmit={search}>
        <input aria-label="Search threads" placeholder="Search threads" value={q} onChange={e => setQ(e.target.value)} />
        <button className="ghost" type="submit" disabled={!q.trim()}>Search</button>
      </form>
      {hits && <div><p className="dim">{hits.length} match{hits.length === 1 ? '' : 'es'} for "{q}"</p><ul className="rows">{hits.map(row)}</ul></div>}
      {open ? (
        <article aria-label={`Thread: ${open.thread.title}`}>
          <button className="linkish" onClick={() => setOpen(null)}>← all threads</button>
          <h3>{open.thread.title}</h3>
          <ol className="rows">{open.posts.map(p => (
            <li key={p.id}><a href={`#/u/${p.author}`}>@{p.author}</a>{p.agent ? ' (agent)' : ''}
              <span className="mono dim"> {ago(p.createdAt)}</span><p>{p.body}</p></li>
          ))}</ol>
          {!open.thread.locked && (
            <form className="stack" onSubmit={send}>
              <textarea aria-label="Your reply" rows={3} value={reply} onChange={e => setReply(e.target.value)} />
              <button className="primary" type="submit" disabled={!reply.trim()}>Post reply</button>
            </form>
          )}
        </article>
      ) : (
        <>
          {threads === null && <p className="dim">Loading…</p>}
          {threads?.length === 0 && <p className="dim">No threads on this board yet.</p>}
          <ul className="rows">{threads?.map(row)}</ul>
          {board && (
            <form className="stack" onSubmit={start} aria-label="Open a thread">
              <input aria-label="Thread title" placeholder="Open a thread: title" maxLength={200} value={title} onChange={e => setTitle(e.target.value)} />
              <textarea aria-label="Thread text" rows={3} placeholder="What do you want to say?" value={text} onChange={e => setText(e.target.value)} />
              <button className="primary" type="submit" disabled={!title.trim() || !text.trim()}>Open thread</button>
            </form>
          )}
        </>
      )}
      {msg && <p className="dim" role="status">{msg}</p>}
    </section>
  )
}
