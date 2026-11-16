// The in-tab Bonsai brain, borrowed at run time from aitherium.com. AGPL-3.0-only (this file).
//
// The model runtime is NOT part of this repository. It is the same worker and tool parser
// that https://aitherium.com/edge-agent/ and aitherium.com's own chat run
// (`/workers/webgpu-brain-bonsai-worker.js`, `/gobbonet/bonsai-tools.js`), loaded from
// aitherium.com when the member opens the copilot and asks it to load. That runtime is
// Aitherium's own, separately licensed software; this page only talks to it through the
// worker's message protocol. The model runs on the member's GPU: no prompt leaves the tab.
//
// A cross-origin script cannot be a Worker directly, so the worker is a one-line module
// that imports it (aitherium.com serves both files with `Access-Control-Allow-Origin: *`).

export const RUNTIME_ORIGIN = 'https://aitherium.com'
export const WORKER_URL = `${RUNTIME_ORIGIN}/workers/webgpu-brain-bonsai-worker.js`
export const PARSER_URL = `${RUNTIME_ORIGIN}/gobbonet/bonsai-tools.js`

export const MODELS = [
  { id: 'bonsai-4b', label: 'Bonsai 4B', mb: 545 },
  { id: 'bonsai-1.7b', label: 'Bonsai 1.7B', mb: 236 },
] as const
export type ModelId = (typeof MODELS)[number]['id']

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: { function: { name: string; arguments: Record<string, unknown> } }[]
}

export interface ParsedCall { name: string; arguments: Record<string, unknown> }

/** What the page-side loop needs from a brain; the tests give it a scripted one. */
export interface Brain {
  readonly label: string
  generate(messages: ChatMsg[], onToken?: (t: string) => void): Promise<string>
  parse(text: string): { calls: ParsedCall[]; rest: string }
}

type Parser = { parseToolCalls(t: string): { toolCalls: ParsedCall[]; remainingText: string } }

function loadParser(): Promise<Parser> {
  const w = window as unknown as { AitherBonsaiTools?: Parser }
  if (w.AitherBonsaiTools) return Promise.resolve(w.AitherBonsaiTools)
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = PARSER_URL
    s.crossOrigin = 'anonymous'
    s.onload = () => (w.AitherBonsaiTools ? resolve(w.AitherBonsaiTools) : reject(new Error('the tool parser did not load')))
    s.onerror = () => reject(new Error('the tool parser did not load'))
    document.head.append(s)
  })
}

export async function webgpuAvailable(): Promise<boolean> {
  const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
  if (!gpu) return false
  try { return !!(await gpu.requestAdapter()) } catch { return false }
}

interface Job { resolve(t: string): void; reject(e: Error): void; onToken(t: string): void; text: string }

export class BonsaiBrain implements Brain {
  readonly label: string
  private worker: Worker | null = null
  private job: Job | null = null
  private parser: Parser | null = null
  private ready?: Promise<void>

  constructor(readonly model: ModelId, private onProgress: (pct: number) => void = () => {}) {
    this.label = MODELS.find(m => m.id === model)?.label || model
  }

  load(): Promise<void> {
    if (this.ready) return this.ready
    this.ready = (async () => {
      this.parser = await loadParser()
      const boot = URL.createObjectURL(new Blob([`import ${JSON.stringify(WORKER_URL)};`], { type: 'text/javascript' }))
      await new Promise<void>((resolve, reject) => {
        const w = new Worker(boot, { type: 'module' })
        this.worker = w
        w.onerror = ev => reject(new Error(`the Bonsai worker failed${ev.message ? `: ${ev.message}` : ''}`))
        w.onmessage = ev => this.onMessage(ev.data || {}, resolve, reject)
        w.postMessage({ type: 'load', modelId: this.model })
      })
    })()
    this.ready.catch(() => { this.ready = undefined; this.stop() })
    return this.ready
  }

  private onMessage(msg: Record<string, unknown>, ready: () => void, fail: (e: Error) => void) {
    const job = this.job
    if (msg.type === 'ready') ready()
    else if (msg.type === 'progress' && typeof msg.progress === 'number' && !job) {
      this.onProgress(Math.round(msg.progress <= 1 ? msg.progress * 100 : msg.progress))
    } else if (msg.type === 'token' && job) {
      job.text += String(msg.text || '')
      job.onToken(String(msg.text || ''))
    } else if (msg.type === 'done' && job) {
      this.job = null
      job.resolve(typeof msg.text === 'string' && msg.text ? msg.text : job.text)
    } else if (msg.type === 'error') {
      const e = new Error(String(msg.message || 'the in-tab model failed'))
      if (job) { this.job = null; job.reject(e) } else fail(e)
    }
  }

  async generate(messages: ChatMsg[], onToken: (t: string) => void = () => {}): Promise<string> {
    await this.load()
    if (this.job) throw new Error('the copilot is still answering')
    return new Promise((resolve, reject) => {
      this.job = { resolve, reject, onToken, text: '' }
      // No `tools`: this page runs its own tool loop, so the worker's built-in registry
      // never executes anything. The tool list is in the system message instead.
      this.worker!.postMessage({ type: 'generate', messages, maxTokens: 512, temperature: 0.3, reasoningBudget: 0 })
    })
  }

  parse(text: string) {
    const out = this.parser!.parseToolCalls(text)
    return { calls: out.toolCalls, rest: out.remainingText }
  }

  stop() {
    try { this.worker?.terminate() } catch { /* already gone */ }
    this.worker = null
    if (this.job) { this.job.reject(new Error('stopped')); this.job = null }
  }
}
