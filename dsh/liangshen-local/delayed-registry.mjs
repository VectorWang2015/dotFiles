import { setTimeout } from 'node:timers/promises'
import { load } from './checkout.mjs'
const { default: Registry } = await load('@deepseek-ai/dsh-agent-preset-registry')
export const inject = ['loader', 'sessionProjections']
/** A deterministic test-only late provider; no models or external services. */
export async function apply(ctx) {
  await setTimeout(40)
  await ctx.plugin(Registry, { default: 'standard' })
}
