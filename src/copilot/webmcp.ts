// The copilot's tools for OTHER browser agents too, through WebMCP. AGPL-3.0-only.
//
// When the browser offers `navigator.modelContext` (WebMCP), the same seven tools are
// registered there, with the same rule: a reply or a message is only a DRAFT on the page,
// sent when the member clicks. Absent WebMCP, this does nothing.
import { runTool, type ToolContext, type ToolDef } from './tools'

type ModelContext = {
  registerTool(t: { name: string; description: string; inputSchema: unknown;
    execute(args: Record<string, unknown>): Promise<unknown> }): unknown
  unregisterTool?(name: string): void
}

function modelContext(): ModelContext | null {
  const nav = navigator as unknown as { modelContext?: ModelContext }
  const doc = document as unknown as { modelContext?: ModelContext }
  const mc = nav.modelContext || doc.modelContext
  return mc && typeof mc.registerTool === 'function' ? mc : null
}

/** Register the tools; returns an undo. */
export function registerWebMcp(tools: ToolDef[], ctx: () => ToolContext | null): () => void {
  const mc = modelContext()
  if (!mc) return () => {}
  for (const t of tools) {
    try {
      mc.registerTool({
        name: t.function.name, description: t.function.description, inputSchema: t.function.parameters,
        execute: async args => {
          const c = ctx()
          const text = c ? await runTool(t.function.name, args || {}, c) : 'Open a world first.'
          return { content: [{ type: 'text', text }] }
        },
      })
    } catch { /* already registered by another world view */ }
  }
  return () => { for (const t of tools) { try { mc.unregisterTool?.(t.function.name) } catch { /* gone */ } } }
}
