// The Wesyn copilot's tools: what it may read and what it may only DRAFT. AGPL-3.0-only.
//
// Reads run at once, as the signed-in member, through the same WorldClient the page uses
// (so Relay decides what this member may see). Anything that speaks for the member
// (a forum reply, a new thread, a direct message) is never sent by the model: the tool
// only STAGES a draft, and the page sends it when the member clicks Post. The model is
// told so, so it cannot claim it posted.
import type { WorldClient } from '../api/types'

export interface ToolDef {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

export type DraftKind = 'reply' | 'message'

export interface Draft {
  id: string
  kind: DraftKind
  /** reply: the thread id; message: the username. */
  target: string
  text: string
  /** What the member sees on the confirmation card. */
  label: string
}

export interface ToolContext {
  slug: string
  worldName: string
  client: WorldClient
  channels: string[]
  osintTopic: string
  stage(d: Omit<Draft, 'id'>): string
}

const LIMIT = 1800
const clip = (s: string, n = LIMIT) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const obj = (props: Record<string, unknown>, required: string[] = []) =>
  ({ type: 'object', properties: props, required })
const s = (description: string) => ({ type: 'string', description })

export const WESYN_TOOLS: ToolDef[] = [
  { type: 'function', function: { name: 'wesyn_read_feed',
    description: 'Read this world: the latest chat lines and the forum threads with their opening posts. Use it to summarise the world or its forum.',
    parameters: obj({}) } },
  { type: 'function', function: { name: 'wesyn_search_threads',
    description: "Search this world's forum threads by words in the title or the author's name.",
    parameters: obj({ query: s('Words to search for.') }, ['query']) } },
  { type: 'function', function: { name: 'wesyn_read_thread',
    description: 'Read every post of one forum thread. Give its id from wesyn_read_feed or wesyn_search_threads.',
    parameters: obj({ thread_id: s('The thread id.') }, ['thread_id']) } },
  { type: 'function', function: { name: 'wesyn_post_reply',
    description: 'Draft a reply to a forum thread for the member. It is NOT posted: the member reviews it and clicks Post.',
    parameters: obj({ thread_id: s('The thread id.'), text: s('The reply, in the member\'s voice.') }, ['thread_id', 'text']) } },
  { type: 'function', function: { name: 'wesyn_message_member',
    description: 'Draft a direct message to one member. It is NOT sent: the member reviews it and clicks Send.',
    parameters: obj({ username: s('Their handle, without @.'), text: s('The message.') }, ['username', 'text']) } },
  { type: 'function', function: { name: 'osint_news',
    description: 'Open-source news for a region or topic from the public ShadowBroker board. Leads to verify, not facts.',
    parameters: obj({ query: s('A region, place or topic. Empty: this world\'s own topic.') }) } },
  { type: 'function', function: { name: 'osint_telemetry',
    description: 'Aircraft, ships, satellites and events for a region or keyword from the public ShadowBroker board.',
    parameters: obj({ query: s('A region, callsign or keyword. Empty: this world\'s own topic.') }) } },
]

export const OUTWARD = new Set(['wesyn_post_reply', 'wesyn_message_member'])

async function readFeed(ctx: ToolContext): Promise<string> {
  const out: string[] = [`World: ${ctx.worldName}`]
  for (const ch of ctx.channels.slice(0, 2)) {
    const lines = await ctx.client.chat(ch).catch(() => [])
    out.push(`Chat ${ch}: ${lines.length ? '' : '(no messages)'}`)
    for (const l of lines.slice(-8)) out.push(`- @${l.author}: ${clip(l.body, 200)}`)
  }
  const boards = await ctx.client.boards(ctx.slug)
  const threads = (await Promise.all(boards.map(b => ctx.client.threads(ctx.slug, b.id).catch(() => [])))).flat()
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 8)
  out.push(`Forum: ${threads.length} recent thread(s).`)
  for (const t of threads) {
    const first = await ctx.client.thread(ctx.slug, t.id).then(x => x.posts[0]?.body || '').catch(() => '')
    out.push(`- [${t.id}] "${t.title}" by @${t.author}, ${t.replies} repl${t.replies === 1 ? 'y' : 'ies'}: ${clip(first, 240)}`)
  }
  return clip(out.join('\n'), 3000)
}

async function osint(ctx: ToolContext, kind: 'news' | 'telemetry', q: string): Promise<string> {
  const query = q || ctx.osintTopic
  if (!query) return 'This world has no OSINT topic; ask the member for a region or topic.'
  const r = await ctx.client.osint(kind, query)
  if (r.error) return `The OSINT board did not answer: ${r.error}`
  if (!r.items.length) return `No ${kind} rows on the board for "${query}" right now.`
  const rows = r.items.slice(0, 6).map(i => `- ${i.title}${i.source ? ` (${i.source})` : ''}${i.time ? ` ${i.time}` : ''}`
    + `${i.lat !== undefined ? ` at ${i.lat.toFixed(2)},${(i.lng ?? 0).toFixed(2)}` : ''}${i.link ? ` ${i.link}` : ''}`)
  return clip([`${kind} for "${query}" (${r.notice || 'leads to verify, not facts'}):`, ...rows].join('\n'))
}

/** Run one tool call. Never throws: a failure is the result, named, so the model can say so. */
export async function runTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  if (!ctx.slug && name.startsWith('wesyn_') && name !== 'wesyn_message_member') {
    return "You are not in a world right now: open one of the member's worlds to read or reply to its forum."
  }
  try {
    switch (name) {
      case 'wesyn_read_feed': return await readFeed(ctx)
      case 'wesyn_search_threads': {
        const q = str(args.query)
        if (!q) return 'Give words to search for.'
        const hits = await ctx.client.search(ctx.slug, q)
        return hits.length ? hits.slice(0, 10).map(t => `- [${t.id}] "${t.title}" by @${t.author}`).join('\n')
          : `No threads match "${q}".`
      }
      case 'wesyn_read_thread': {
        const id = str(args.thread_id)
        if (!id) return 'Give a thread id.'
        const { thread, posts } = await ctx.client.thread(ctx.slug, id)
        return clip([`"${thread.title}" (${posts.length} posts)`, ...posts.map(p => `- @${p.author}: ${clip(p.body, 400)}`)].join('\n'))
      }
      case 'wesyn_post_reply': {
        const id = str(args.thread_id), text = str(args.text)
        if (!id || !text) return 'A reply needs a thread id and text.'
        const title = await ctx.client.thread(ctx.slug, id).then(x => x.thread.title).catch(() => '')
        if (!title) return `There is no thread ${id} in this world.`
        ctx.stage({ kind: 'reply', target: id, text: clip(text, 4000), label: `Reply to "${title}"` })
        return 'Drafted. NOT posted yet: it is waiting on the member\'s Post button. Tell the member what you drafted.'
      }
      case 'wesyn_message_member': {
        const who = str(args.username).replace(/^@+/, ''), text = str(args.text)
        if (!/^[\w.-]{1,64}$/.test(who) || !text) return 'A message needs a valid handle and text.'
        ctx.stage({ kind: 'message', target: who, text: clip(text, 2000), label: `Message @${who}` })
        return 'Drafted. NOT sent yet: it is waiting on the member\'s Send button. Tell the member what you drafted.'
      }
      case 'osint_news': return await osint(ctx, 'news', str(args.query))
      case 'osint_telemetry': return await osint(ctx, 'telemetry', str(args.query))
    }
    return `There is no tool named ${name}.`
  } catch (e) {
    return `${name} failed: ${e instanceof Error ? e.message : String(e)}`
  }
}
