// Write a post to a room, and opt in to also share it to the member's LinkedIn. AGPL-3.0-only.
import { useEffect, useState } from 'react'
import type { NetworkClient, ShareStatus } from '../api/types'

export function Composer({ client, rooms, onPosted }: {
  client: NetworkClient; rooms: string[]; onPosted?: () => void
}) {
  const [room, setRoom] = useState('')
  const [text, setText] = useState('')
  const [alsoShare, setAlsoShare] = useState(false)   // opt-in, never on by default
  const [share, setShare] = useState<ShareStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => { client.shareStatus().then(setShare).catch(() => setShare(null)) }, [client])
  useEffect(() => { if (!room && rooms.length) setRoom(rooms[0]) }, [rooms, room])

  const canShare = !!share?.connected && (share?.postsLeftToday ?? 0) > 0
  const submit = async () => {
    setBusy(true); setNote('')
    try {
      const r = await client.post(room, text.trim())
      let msg = r.message
      if (r.ok && alsoShare && canShare) {
        const s = await client.shareToLinkedIn(text.trim(), 'https://aitherium.github.io/wesyn/')
        msg += ' ' + s.message
        setShare(await client.shareStatus())
      }
      setNote(msg)
      if (r.ok) { setText(''); onPosted?.() }
    } finally { setBusy(false) }
  }
  const connect = async () => {
    const r = await client.shareConnectUrl()
    if (r.ok && r.url) window.open(r.url, '_blank', 'noopener')
    else setNote(r.message || share?.reason || 'Not available.')
  }

  return (
    <div className="card" aria-label="Write a post">
      <h2>Post</h2>
      <textarea aria-label="Post text" rows={3} value={text} maxLength={3000}
        onChange={e => setText(e.target.value)} placeholder="Share what you shipped, learned or need." />
      <div className="row wrap">
        <select aria-label="Room" value={room} onChange={e => setRoom(e.target.value)}>
          {rooms.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <label className="check">
          <input type="checkbox" checked={alsoShare} disabled={!canShare}
            onChange={e => setAlsoShare(e.target.checked)} />
          Also share to LinkedIn
          {share?.connected
            ? <span className="mono dim"> · {share.postsLeftToday} of {share.postsPerDay} left today</span>
            : <button className="linkish" type="button" onClick={connect}>connect</button>}
        </label>
        <button className="primary" disabled={busy || !text.trim() || !room} onClick={submit}>Post</button>
      </div>
      {!share?.connected && share?.reason && <p className="fine">{share.reason}</p>}
      {note && <p className="dim" role="status">{note}</p>}
    </div>
  )
}
