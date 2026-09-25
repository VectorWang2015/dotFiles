/**
 * Host-level ARIS integration, without a skill-catalog contribution.
 *
 * Publish the shared package root, expose Codex continuation metadata, and
 * serve the existing read-only ARIS view. Mount this once on the host; mount
 * `dsh-aris/skills` separately inside each research Agent Preset.
 */

import { fileURLToPath } from 'node:url'
import { registerRunStatus } from './run-status.mjs'

export const name = 'aris-runtime'
export const inject = ['tools']

/** Package root; identical in a git checkout and under node_modules. */
const PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url))

/** Codex MCP tools whose reply carries a continuation threadId. */
const CODEX_TOOLS = new Set(['mcp__codex__codex', 'mcp__codex__codex-reply'])

export async function apply(ctx) {
  // An operator-set root wins. This is one shared package, not a project root.
  ctx.effect(() => {
    const inherited = process.env.ARIS_REPO
    if (inherited === undefined) process.env.ARIS_REPO = PACKAGE_ROOT
    return () => {
      if (inherited === undefined && process.env.ARIS_REPO === PACKAGE_ROOT) {
        delete process.env.ARIS_REPO
      }
    }
  }, 'ARIS package root')

  registerRunStatus(ctx)

  // Native MCP rendering includes content, not structuredContent. Project the
  // continuation id into content so it remains visible and durably logged.
  ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next()
    if (!CODEX_TOOLS.has(exec.name)) return decision
    if (result.isError || decision.kind !== 'accept') return decision
    if (Object.hasOwn(decision, 'value')) return decision

    const threadId = result.value?.structuredContent?.threadId
    if (typeof threadId !== 'string') return decision

    return {
      ...decision,
      content: [
        {
          type: 'text',
          text: `Codex continuation metadata (not part of the reviewer response): threadId=${threadId}\n\n`,
        },
        ...decision.content ?? result.content,
      ],
    }
  })
}
