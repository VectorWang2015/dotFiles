import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

if (!process.env.DSH_CHECKOUT) throw new Error('Set DSH_CHECKOUT to the installed 0.1.7-rc.2 source checkout')
const checkout = resolve(process.env.DSH_CHECKOUT)
const result = spawnSync(process.execPath, [
  '--import', `${checkout}/node_modules/tsx/dist/esm/index.mjs`,
  '--test', fileURLToPath(new URL('./composition.test.mjs', import.meta.url)),
], {
  stdio: 'inherit',
  env: { ...process.env, DSH_CHECKOUT: checkout, TSX_TSCONFIG_PATH: `${checkout}/tsconfig.json` },
})
if (result.error) throw result.error
process.exitCode = result.status ?? 1
