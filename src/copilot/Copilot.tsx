// The Wesyn copilot panel: in-tab Bonsai, Wesyn tools, a click for anything outward.
// AGPL-3.0-only.
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { WorldClient, WorldDetail } from '../api/types'
import { runTurn, type Step } from './loop'
import { BonsaiBrain, MODELS, webgpuAvailable, type ChatMsg, type ModelId } from './runtime'
import { WESYN_TOOLS, type Draft, type ToolContext } from './tools'
import { registerWebMcp } from './webmcp'

interface Turn { id: number; user: string; reply: string; steps: Step[]; by: string; error?: string }

declare global { interface Window { __wesynCopilot?: Record<string, unknown> } }

/** The copilot off a world (on a profile): no rooms or forum, so the world tools say so. */
export const PROFILE_PLACE: WorldDetail = {
  slug: '', name: 'a profile', description: '', role: 'member', channels: [], settings: {}, settingsStored: false,
}

export function Copilot({ world, client, me }: { world: WorldDetail; client: WorldClient; me: string }) {
  const [gpu, setGpu] = useState<boolean | null>(null)
  const [model, setModel] = useState<ModelId>('bonsai-4b')
  const [state, setState] = useState<'off' | 'loading' | 'ready' | 'busy' | 'failed'>('off')
  const [pct, setPct] = useState(0)
  const [err, setErr] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [done, setDone] = useState<string[]>([])
  const [q, setQ] = useState('')
  const brain = useRef<BonsaiBrain | null>(null)
  const history = useRef<ChatMsg[]>([])

  const ctx: ToolContext = useMemo(() => ({
    slug: world.slug, worldName: world.name, client, channels: world.channels,
    osintTopic: world.settings.osint?.query || '',
    stage: d => {
      const id = `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
      setDrafts(x => [...x, { ...d, id }])
      return id
    },
  }), [world, client])
  const ctxRef = useRef(ctx)
  ctxRef.current = ctx

  useEffect(() => { webgpuAvailable().then(setGpu) }, [])
  useEffect(() => registerWebMcp(WESYN_TOOLS, () => ctxRef.current), [])
  useEffect(() => () => brain.current?.stop(), [])
  useEffect(() => {
    window.__wesynCopilot = { state, model, pct, turns, drafts, done, err }
  }, [state, model, pct, turns, drafts, done, err])

  const load = async () => {
    brain.current?.stop()
    const b = new BonsaiBrain(model, setPct)
    brain.current = b
    setState('loading'); setErr('')
    try { await b.load(); setState('ready') } catch (e) {
      setState('failed'); setErr(e instanceof Error ? e.message : String(e))
    }
  }

  const ask = async (e: FormEvent) => {
    e.preventDefault()
    const text = q.trim()
    const b = brain.current
    if (!text || !b || state !== 'ready') return
    setQ(''); setState('busy')
    const id = Date.now()
    const upd = (p: Partial<Turn>) => setTurns(x => x.map(y => (y.id === id ? { ...y, ...p } : y)))
    setTurns(x => [...x, { id, user: text, reply: '', steps: [], by: b.label }])
    const steps: Step[] = []
    try {
      const out = await runTurn({ brain: b, ctx, tools: WESYN_TOOLS, me, history: history.current, user: text,
        onStep: s => { steps.push(s); upd({ steps: [...steps] }) } })
      history.current = out.history.slice(-12)
      upd({ reply: out.reply || '(no answer)', steps: out.steps })
    } catch (er) { upd({ error: er instanceof Error ? er.message : String(er) }) }
    setState('ready')
  }

  // The ONLY place a copilot draft leaves the page: the member's own click.
  const send = async (d: Draft) => {
    const r = d.kind === 'reply' ? await client.reply(world.slug, d.target, d.text) : await client.message(d.target, d.text)
    setDrafts(x => x.filter(y => y.id !== d.id))
    setDone(x => [...x, `${d.label}: ${r.message}`])
  }

  const mb = MODELS.find(m => m.id === model)?.mb
  return (
    <aside className="card copilot" aria-label="Copilot">
      <h2>Copilot <span className="mono dim">in-tab Bonsai</span></h2>
      <p className="dim">Runs on your GPU inside this tab, as you (@{me || 'you'}). It reads {world.slug ? 'this world' : 'a world when you open one'} and
        the OSINT board, and it can only <b>draft</b> a reply or a message: nothing is sent until you click.</p>
      {gpu === false && <p className="err">This browser has no usable WebGPU, so the in-tab copilot cannot run here.</p>}
      {gpu && state !== 'ready' && state !== 'busy' && (
        <div className="row">
          <select aria-label="Model" value={model} onChange={e => setModel(e.target.value as ModelId)} disabled={state === 'loading'}>
            {MODELS.map(m => <option key={m.id} value={m.id}>{m.label} ({m.mb} MB)</option>)}
          </select>
          <button className="primary" onClick={load} disabled={state === 'loading'}>
            {state === 'loading' ? `Loading ${pct}%` : `Load on my GPU (${mb} MB, once)`}
          </button>
        </div>
      )}
      {err && <p className="err">{err}</p>}
      <ol className="turns">{turns.map(t => (
        <li key={t.id}>
          <p><b>you</b>: {t.user}</p>
          {t.steps.map((s, j) => (
            <p key={j} className="mono dim step">tool {s.tool} {Object.keys(s.args).length ? JSON.stringify(s.args) : ''} → {s.result.slice(0, 140)}</p>
          ))}
          {t.reply && <p className="answer">{t.reply}</p>}
          {t.error && <p className="err">{t.error}</p>}
          <p className="mono dim">{t.reply || t.error ? `${t.by}, on your GPU` : 'thinking…'}</p>
        </li>
      ))}</ol>
      {drafts.map(d => (
        <div key={d.id} className="card draft" role="group" aria-label={`Draft: ${d.label}`}>
          <p className="mono dim">Draft · {d.label}</p>
          <p>{d.text}</p>
          <div className="row">
            <button className="primary" onClick={() => send(d)}>{d.kind === 'message' ? 'Send' : 'Post'}</button>
            <button className="ghost" onClick={() => setDrafts(x => x.filter(y => y.id !== d.id))}>Discard</button>
          </div>
        </div>
      ))}
      {done.map((m, i) => <p key={i} className="ok" role="status">{m}</p>)}
      <form className="row" onSubmit={ask}>
        <input aria-label="Ask the copilot" placeholder={state === 'ready' ? 'Ask about this world…' : 'Load the copilot first'}
          value={q} onChange={e => setQ(e.target.value)} disabled={state !== 'ready'} />
        <button className="primary" type="submit" disabled={state !== 'ready' || !q.trim()}>Ask</button>
      </form>
    </aside>
  )
}
