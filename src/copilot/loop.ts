// The copilot's tool loop, run in the page. AGPL-3.0-only.
//
// The worker only turns messages into text. This loop puts the tool list in the system
// message (the Qwen3 / ChatML tool block the runtime's own template uses), parses the
// `<tool_call>` blocks out of the answer with the runtime's parser, runs each call
// through tools.ts, and asks again with the results, up to MAX_STEPS rounds.
import type { Brain, ChatMsg } from './runtime'
import { runTool, type ToolContext, type ToolDef } from './tools'

export const MAX_STEPS = 4

export interface Step { tool: string; args: Record<string, unknown>; result: string }

export function systemPrompt(ctx: Pick<ToolContext, 'worldName' | 'osintTopic'>, tools: ToolDef[], me: string): string {
  return [
    `You are ${me ? `@${me}'s` : "the member's"} Wesyn copilot, running on their own GPU inside this browser tab.`,
    `They are looking at the world "${ctx.worldName}".${ctx.osintTopic ? ` Its OSINT topic is "${ctx.osintTopic}".` : ''}`,
    'Use a tool for anything about this world, its forum or the news; never invent posts, people or sources.',
    'You cannot post or send anything yourself: the reply and message tools only make a draft the member must click to send.',
    'Answer briefly and plainly.',
    '',
    '# Tools',
    '',
    'You may call one or more functions to assist with the user query.',
    '',
    'You are provided with function signatures within <tools></tools> XML tags:',
    '<tools>',
    ...tools.map(t => JSON.stringify(t)),
    '</tools>',
    '',
    'For each function call, return a json object with function name and arguments within <tool_call></tool_call> XML tags:',
    '<tool_call>',
    '{"name": <function-name>, "arguments": <args-json-object>}',
    '</tool_call>',
  ].join('\n')
}

export async function runTurn(opts: {
  brain: Brain
  ctx: ToolContext
  tools: ToolDef[]
  me: string
  history: ChatMsg[]
  user: string
  onStep?: (s: Step) => void
  onToken?: (t: string) => void
}): Promise<{ reply: string; steps: Step[]; history: ChatMsg[] }> {
  const { brain, ctx, tools, me, user } = opts
  const known = new Set(tools.map(t => t.function.name))
  const turn: ChatMsg[] = [{ role: 'user', content: user }]
  const steps: Step[] = []
  const sys: ChatMsg = { role: 'system', content: systemPrompt(ctx, tools, me) }
  for (let i = 0; i < MAX_STEPS; i++) {
    const last = i === MAX_STEPS - 1
    const msgs = [sys, ...opts.history, ...turn,
      ...(last ? [{ role: 'user' as const, content: 'Answer now from the tool results above, without another tool call.' }] : [])]
    const text = await brain.generate(msgs, opts.onToken)
    const { calls, rest } = brain.parse(text)
    const usable = last ? [] : calls.filter(c => known.has(c.name))
    if (!usable.length) {
      const reply = (rest || text).replace(/<\/?tool_call>/g, '').trim()
      turn.push({ role: 'assistant', content: reply })
      return { reply, steps, history: [...opts.history, ...turn] }
    }
    turn.push({ role: 'assistant', content: rest.trim(), tool_calls: usable.map(c => ({ function: { name: c.name, arguments: c.arguments || {} } })) })
    for (const c of usable) {
      const result = await runTool(c.name, c.arguments || {}, ctx)
      const step = { tool: c.name, args: c.arguments || {}, result }
      steps.push(step)
      opts.onStep?.(step)
      turn.push({ role: 'tool', content: result })
    }
  }
  return { reply: '', steps, history: [...opts.history, ...turn] }
}
