import { createRequire, registerHooks } from 'node:module'
import { pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
export const CHECKOUT = process.env.DSH_CHECKOUT ?? '/home/vectorwang/Workspace/deepseek-harness-0.1.7-rc.2'
if (JSON.parse(readFileSync(`${CHECKOUT}/package.json`, 'utf8')).version !== '0.1.7-rc.2') throw new Error('Tests pin DSH 0.1.7-rc.2')
const require = createRequire(`${CHECKOUT}/apps/cli/package.json`)
const modules = {
  '@deepseek-ai/cordis': 'vendor/cordis',
  '@deepseek-ai/schemastery': 'vendor/schemastery',
  '@deepseek-ai/cordis-plugin-group': 'vendor/group',
  '@deepseek-ai/dsh-session-projection': 'packages/session/session-projection',
  '@deepseek-ai/dsh-system-prompt': 'packages/core/system-prompt',
  '@deepseek-ai/dsh-agent-preset-registry': 'packages/preset/agent-preset-registry',
  '@deepseek-ai/dsh-tools': 'packages/core/tools',
  '@deepseek-ai/dsh-scope': 'packages/core/scope',
}
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === '@deepseek-ai/schemastery') return nextResolve(pathToFileURL(require.resolve(specifier)).href, context)
  if (modules[specifier]) return nextResolve(pathToFileURL(`${CHECKOUT}/${modules[specifier]}/lib/index.js`).href, context)
  return nextResolve(specifier, context)
} })
export const load = async name => import(pathToFileURL(modules[name] ? `${CHECKOUT}/${modules[name]}/lib/index.js` : require.resolve(name)).href)
