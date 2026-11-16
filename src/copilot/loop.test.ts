import { describe, expect, it, vi } from 'vitest'
import type { WorldClient } from '../api/types'
import { runTurn, systemPrompt } from './loop'
import type { Brain, ChatMsg, ParsedCall } from './runtime'
import { runTool, WESYN_TOOLS, type Draft, type ToolContext } from './tools'

const THREAD = { id: 't1', boardId: 'general', title: 'Release train', author: 'ada', replies: 1,
  updatedAt: '2026-11-15T00:00:00Z', pinned: false, locked: false }

function world(): WorldClient & { reply: ReturnType<typeof vi.fn>; message: ReturnType<typeof vi.fn> } {
  return {
    create: vi.fn(), open: vi.fn(), saveSettings: vi.fn(), startThread: vi.fn(), say: vi.fn(),
    boards: vi.fn(async () => [{ id: 'general', name: 'General', description: '', threadCount: 1 }]),
    threads: vi.fn(async () => [THREAD]),
    thread: vi.fn(async () => ({ thread: THREAD, posts: [{ id: 'p', author: 'ada', body: 'Cut on the 12th?', createdAt: '', agent: false }] })),
    search: vi.fn(async () => [THREAD]),
    chat: vi.fn(async () => [{ id: 'c', author: 'bo', body: 'standup at 10', timestamp: '' }]),
    osint: vi.fn(async (_k: string, q: string) => ({ query: q, items: [{ title: `Storm near ${q}`, summary: '', source: 'wire',
      link: 'https://news.example/x', time: '' }], notice: 'Leads to verify, not facts.', board: 'b', software: 's', license: 'AGPL-3.0' })),
    reply: vi.fn(async () => ({ ok: true, message: 'Reply posted.' })),
    message: vi.fn(async () => ({ ok: true, message: 'Sent.' })),
  } as never
}

function ctxFor(client: WorldClient, drafts: Draft[] = []): ToolContext {
  return { slug: 'driftwood', worldName: 'Driftwood', client, channels: ['#driftwood-general'], osintTopic: 'Baltic Sea',
    stage: d => { drafts.push({ ...d, id: `d${drafts.length}` }); return `d${drafts.length - 1}` } }
}

/** A brain that answers from a script and parses `<tool_call>{json}</tool_call>`. */
function scripted(outputs: string[]): Brain & { seen: ChatMsg[][] } {
  const seen: ChatMsg[][] = []
  return {
    label: 'Test brain', seen,
    async generate(m) { seen.push(m); return outputs.shift() ?? 'done' },
    parse(text) {
      const calls: ParsedCall[] = []
      const rest = text.replace(/<tool_call>([\s\S]*?)<\/tool_call>/g, (_m, j) => { calls.push(JSON.parse(j)); return '' })
      return { calls, rest }
    },
  }
}

describe('the copilot tool loop', () => {
  it('reads the world, then answers from what the tool returned', async () => {
    const c = world()
    const brain = scripted(['<tool_call>{"name":"wesyn_read_feed","arguments":{}}</tool_call>', 'One thread: the release train.'])
    const out = await runTurn({ brain, ctx: ctxFor(c), tools: WESYN_TOOLS, me: 'pip', history: [], user: 'summarise the forum' })
    expect(out.reply).toBe('One thread: the release train.')
    expect(out.steps.map(s => s.tool)).toEqual(['wesyn_read_feed'])
    expect(out.steps[0].result).toContain('"Release train" by @ada')
    expect(out.steps[0].result).toContain('Cut on the 12th?')
    // The second round saw the tool's result.
    expect(brain.seen[1].some(m => m.role === 'tool' && m.content.includes('Release train'))).toBe(true)
  })

  it('a reply is only a DRAFT: nothing is posted until the page sends it', async () => {
    const c = world()
    const drafts: Draft[] = []
    const brain = scripted(['<tool_call>{"name":"wesyn_post_reply","arguments":{"thread_id":"t1","text":"The 12th works for me."}}</tool_call>',
      'I drafted a reply; click Post to send it.'])
    const out = await runTurn({ brain, ctx: ctxFor(c, drafts), tools: WESYN_TOOLS, me: 'pip', history: [], user: 'reply yes' })
    expect(c.reply).not.toHaveBeenCalled()
    expect(drafts).toEqual([{ id: 'd0', kind: 'reply', target: 't1', text: 'The 12th works for me.', label: 'Reply to "Release train"' }])
    expect(out.steps[0].result).toMatch(/NOT posted/)
  })

  it('a message is only a draft too, and a bad handle is refused', async () => {
    const c = world()
    const drafts: Draft[] = []
    expect(await runTool('wesyn_message_member', { username: '@ada', text: 'hi' }, ctxFor(c, drafts))).toMatch(/NOT sent/)
    expect(await runTool('wesyn_message_member', { username: 'a b', text: 'hi' }, ctxFor(c, drafts))).toMatch(/valid handle/)
    expect(c.message).not.toHaveBeenCalled()
    expect(drafts.map(d => d.target)).toEqual(['ada'])
  })

  it('OSINT uses the world topic when no region is given, and keeps the notice', async () => {
    const c = world()
    const r = await runTool('osint_news', {}, ctxFor(c))
    expect(c.osint).toHaveBeenCalledWith('news', 'Baltic Sea')
    expect(r).toContain('Storm near Baltic Sea')
    expect(r).toContain('Leads to verify')
  })

  it('an unknown tool is not run, and the loop stops after MAX_STEPS', async () => {
    const c = world()
    const call = '<tool_call>{"name":"wesyn_search_threads","arguments":{"query":"release"}}</tool_call>'
    const brain = scripted([call, call, call, call, call])
    const out = await runTurn({ brain, ctx: ctxFor(c), tools: WESYN_TOOLS, me: '', history: [], user: 'loop' })
    expect(out.steps).toHaveLength(3)
    expect(brain.seen).toHaveLength(4)
    const unknown = scripted(['<tool_call>{"name":"delete_everything","arguments":{}}</tool_call> ok'])
    const o2 = await runTurn({ brain: unknown, ctx: ctxFor(c), tools: WESYN_TOOLS, me: '', history: [], user: 'x' })
    expect(o2.steps).toEqual([])
  })

  it('off a world (a profile), forum tools say so instead of reading anything', async () => {
    const c = world()
    const r = await runTool('wesyn_read_feed', {}, { ...ctxFor(c), slug: '' })
    expect(r).toMatch(/not in a world/)
    expect(c.boards).not.toHaveBeenCalled()
  })

  it('the system prompt lists every tool and says drafts need a click', () => {
    const p = systemPrompt({ worldName: 'Driftwood', osintTopic: 'Baltic Sea' }, WESYN_TOOLS, 'pip')
    for (const t of WESYN_TOOLS) expect(p).toContain(`"name":"${t.function.name}"`)
    expect(p).toContain('the member must click')
  })
})
