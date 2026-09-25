import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { test } from 'node:test'
import { CHECKOUT, PACKAGE_ROOT } from './checkout.mjs'
const { applyEntryPatches, entryListSchema } = await import(pathToFileURL(`${CHECKOUT}/vendor/include/lib/index.js`).href)
const { createRequire } = await import('node:module')
const require = createRequire(`${CHECKOUT}/vendor/include/package.json`)
const { load } = require('js-yaml')

// Real rc.2 patch parser and composition engine; no live profile/config is read.
test('cold bundle assembly preserves operator defaults and scopes ARIS to Research', async () => {
  const parse = async file => load(await readFile(file, 'utf8'), { schema: entryListSchema })
  const standard = await parse(`${CHECKOUT}/packages/bundle/web-app/presets/standard.patch.yml`)
  const runtime = await parse(`${PACKAGE_ROOT}/dsh/cordis.patch.yml`)
  const research = await parse(`${PACKAGE_ROOT}/presets/research.patch.yml`)
  const standardLocal = await parse(`${PACKAGE_ROOT}/../standard-local.patch.yml`)
  const defaultModel = { id: 'agent-default-model', name: '@deepseek-ai/dsh-agent-default-model', config: { provider: 'operator', model: 'kept' } }
  const warnings = []
  const rows = applyEntryPatches([defaultModel], [...standard, ...runtime, ...research, ...standardLocal], (...parts) => warnings.push(parts))
  assert.deepEqual(warnings, [])
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length)
  assert.deepEqual(rows.find(row => row.id === 'agent-default-model'), defaultModel)
  assert.deepEqual(rows.filter(row => row.name === 'dsh-aris'), [{ id: 'aris-skills', name: 'dsh-aris' }])
  assert.equal(rows.some(row => row.name === 'dsh-aris/skills'), false)
  const a = rows.find(row => row.id === 'preset-standard').config.plugins
  const b = rows.find(row => row.id === 'preset-research').config.plugins
  assert.deepEqual(b.slice(0, -1), a)
  assert.deepEqual(b.at(-1), { id: 'aris-skills', name: 'dsh-aris/skills' })
  const codex = rows.find(row => row.id === 'aris-codex')
  assert.equal(codex.name, 'dsh-aris/codex')
  assert.equal(codex.config.toolCallTimeoutMs, 1200000)
  assert.equal(codex.config.failOnStartupError, true)
  assert.equal(codex.config.model, undefined)
})
