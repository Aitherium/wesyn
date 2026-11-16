// The LinkedIn import moved to Aionyn, the identity + professional network (2026-11-15).
// Wesyn keeps only the reader, so an import kept on this device before the move still
// shows on the profile until the member forgets it. AGPL-3.0-only.
import { useState } from 'react'
import type { ImportedProfile } from '../import/exportZip'

export const IMPORT_KEY = 'wesyn.import.v1'
export const AIONYN_IMPORT = 'https://aionyn.aitherium.com/#/import'

export function loadImport(): ImportedProfile | null {
  try { const v = localStorage.getItem(IMPORT_KEY); return v ? JSON.parse(v) as ImportedProfile : null }
  catch { return null }
}

export function ImportView() {
  const [saved, setSaved] = useState<ImportedProfile | null>(() => loadImport())
  const forget = () => {
    try { localStorage.removeItem(IMPORT_KEY) } catch { /* nothing stored */ }
    setSaved(null)
  }
  return (
    <section className="stack" aria-label="Import from LinkedIn">
      <div className="card">
        <h2>Import from LinkedIn moved to Aionyn</h2>
        <p>Your professional profile, connections and imports now live on Aionyn.</p>
        <div className="row" style={{ marginTop: 12 }}>
          <a className="button primary" href={AIONYN_IMPORT}>Open the import on Aionyn</a>
          {saved && <button onClick={forget}>Forget the import kept here</button>}
        </div>
      </div>
    </section>
  )
}
