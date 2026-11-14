// "Import from LinkedIn": the member's own data-export ZIP, read in this tab. AGPL-3.0-only.
import { useState } from 'react'
import { importExport, type ImportedProfile } from '../import/exportZip'

export const IMPORT_KEY = 'wesyn.import.v1'

export function loadImport(): ImportedProfile | null {
  try { const v = localStorage.getItem(IMPORT_KEY); return v ? JSON.parse(v) as ImportedProfile : null }
  catch { return null }
}

const INVITE = 'I am on Wesyn, the open network where reputation is earned: https://aitherium.github.io/wesyn/'

export function ImportView() {
  const [data, setData] = useState<ImportedProfile | null>(null)
  const [saved, setSaved] = useState<ImportedProfile | null>(() => loadImport())
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')

  const pick = async (f: File | undefined) => {
    setErr(''); setNote(''); setData(null)
    if (!f) return
    try {
      const p = await importExport(f)
      if (!p.files.length) { setErr('No profile files found. Use the ZIP from your data export.'); return }
      setData(p)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not read that file.') }
  }
  const keep = () => {
    if (!data) return
    // Kept on THIS device only, and only after the member chose to.
    try { localStorage.setItem(IMPORT_KEY, JSON.stringify({ ...data, contacts: data.contacts.slice(0, 500) })) }
    catch { setErr('This browser would not store it.'); return }
    setSaved(loadImport()); setNote('Kept on this device. It shows on your profile as claimed, not earned.')
  }
  const forget = () => { try { localStorage.removeItem(IMPORT_KEY) } catch { /* nothing stored */ } setSaved(null); setNote('Forgotten.') }
  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(INVITE); setNote('Invite text copied. Send it yourself; Wesyn contacts nobody.') }
    catch { setNote(INVITE) }
  }
  const shown = data || saved

  return (
    <section className="stack" aria-label="Import from LinkedIn">
      <div className="card">
        <h2>Import from LinkedIn</h2>
        <p>Use the ZIP from LinkedIn's "Get a copy of your data" (Settings, Data privacy). Wesyn reads
          positions, skills, education and connections <b>in this browser</b>. Nothing is uploaded.</p>
        <p className="fine">Imported facts are shown as <i>claimed</i>. Standing on Wesyn is earned in communities.</p>
        <div className="row" style={{ marginTop: 12 }}>
          <input aria-label="Data export ZIP" type="file" accept=".zip,application/zip" onChange={e => pick(e.target.files?.[0])} />
        </div>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      {note && <p className="dim" role="status">{note}</p>}
      {shown && (
        <>
          <div className="card" aria-label="Imported positions"><h2>Positions · {shown.positions.length}</h2>
            <ul className="rows">{shown.positions.slice(0, 20).map((p, i) => (
              <li key={i}><b>{p.title}</b> · {p.company}<span className="mono dim"> {p.from}{p.to ? `–${p.to}` : '–now'}</span></li>
            ))}</ul>
          </div>
          <div className="card"><h2>Skills · {shown.skills.length}</h2>
            <ul className="chips">{shown.skills.slice(0, 40).map(s => <li key={s}>{s}</li>)}</ul>
          </div>
          <div className="card"><h2>Education · {shown.education.length}</h2>
            <ul className="rows">{shown.education.map((e, i) => <li key={i}><b>{e.school}</b>{e.degree ? ` · ${e.degree}` : ''}</li>)}</ul>
          </div>
          <div className="card" aria-label="Invite suggestions"><h2>People you know · {shown.contacts.length}</h2>
            <p className="dim">Invite suggestions only. Wesyn never messages them for you.</p>
            <ul className="rows">{shown.contacts.slice(0, 10).map((c, i) => (
              <li key={i}>{c.name}{c.company ? <span className="dim"> · {c.company}</span> : null}</li>
            ))}</ul>
            <button onClick={copyInvite}>Copy invite text</button>
          </div>
          <div className="row">
            {data && <button className="primary" onClick={keep}>Keep on this device</button>}
            {saved && <button onClick={forget}>Forget my import</button>}
          </div>
        </>
      )}
    </section>
  )
}
