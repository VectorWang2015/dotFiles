/**
 * Opt-in ARIS corpus for an Agent Preset.
 *
 * Register only the packaged skills. The provider inherits the mounting
 * preset's scope; it never publishes environment variables, tools, or RPCs.
 * Keep this entry out of the host bundle to avoid global catalog exposure.
 */

import { fileURLToPath } from 'node:url'
import * as skillFilesystem from '@deepseek-ai/dsh-skill-filesystem'

export const name = 'aris-skills'
export const inject = ['skills']

const SKILL_ROOT = fileURLToPath(new URL('../skills/', import.meta.url))

export async function apply(ctx) {
  await ctx.plugin(skillFilesystem, {
    providerName: 'aris',
    includeDefaultRoots: false,
    bundledSkillDir: SKILL_ROOT,
    watch: false,
  })
}
