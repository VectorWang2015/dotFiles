/** Test-only resolver: existing artifacts from one checkout, never profile fallbacks. */
import { realpathSync } from 'node:fs'
import { createRequire, registerHooks } from 'node:module'
import { sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const CHECKOUT = process.env.DSH_CHECKOUT ?? '/home/vectorwang/Workspace/deepseek-harness-0.1.7-rc.2'
export const PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url))
export const TEST_WORK = fileURLToPath(new URL('../../test-work/', import.meta.url))

const checkoutRoot = realpathSync(CHECKOUT)
const pluginRoot = realpathSync(PACKAGE_ROOT)
const requireFromFilesystem = createRequire(`${CHECKOUT}/packages/skill/skill-filesystem/package.json`)
const entries = new Map([
  ['@deepseek-ai/cordis', `${CHECKOUT}/vendor/cordis/lib/index.js`],
  ['@deepseek-ai/dsh-scope', `${CHECKOUT}/packages/core/scope/lib/index.js`],
  ['@deepseek-ai/dsh-skill', `${CHECKOUT}/packages/skill/skill/lib/index.js`],
  ['@deepseek-ai/dsh-skill-filesystem', `${CHECKOUT}/packages/skill/skill-filesystem/lib/index.js`],
  ['yaml', requireFromFilesystem.resolve('yaml')],
])

function inside(path, root) {
  return path === root || path.startsWith(`${root}${sep}`)
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const entry = entries.get(specifier)
    const resolved = nextResolve(entry === undefined ? specifier : pathToFileURL(entry).href, context)
    if (resolved.url.startsWith('file:')) {
      const path = realpathSync(fileURLToPath(resolved.url))
      if (!inside(path, checkoutRoot) && !inside(path, pluginRoot)) {
        throw new Error(`ARIS tests refuse a module outside the pinned checkout/plugin: ${path}`)
      }
      if (specifier.startsWith('@deepseek-ai/') && !inside(path, checkoutRoot)) {
        throw new Error(`ARIS tests require checkout-built DSH/Cordis modules: ${path}`)
      }
    }
    return resolved
  },
})
