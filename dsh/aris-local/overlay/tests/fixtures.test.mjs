import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { CHECKOUT, PACKAGE_ROOT } from './checkout.mjs'

const { parseDocument } = await import('yaml')

/** Preserve !!js as inert data; fixture checks never evaluate configuration code. */
async function readYaml(path) {
  const document = parseDocument(await readFile(path, 'utf8'), {
    customTags: [{ tag: 'tag:yaml.org,2002:js', resolve: text => ({ javascript: text }) }],
  })
  assert.deepEqual(document.errors, [], path)
  assert.deepEqual(document.warnings, [], path)
  return document.toJS()
}

test('test dependencies resolve to the current checkout built packages, not profiles or a legacy checkout', () => {
  for (const [name, path] of [
    ['@deepseek-ai/cordis', 'vendor/cordis/lib/index.js'],
    ['@deepseek-ai/dsh-scope', 'packages/core/scope/lib/index.js'],
    ['@deepseek-ai/dsh-skill', 'packages/skill/skill/lib/index.js'],
    ['@deepseek-ai/dsh-skill-filesystem', 'packages/skill/skill-filesystem/lib/index.js'],
  ]) {
    assert.equal(fileURLToPath(import.meta.resolve(name)), join(CHECKOUT, path))
  }
  assert.ok(fileURLToPath(import.meta.resolve('yaml')).startsWith(`${CHECKOUT}/`))
})

test('package exports keep runtime and opt-in skills separate and include the research template', async () => {
  const pkg = JSON.parse(await readFile(join(PACKAGE_ROOT, 'package.json'), 'utf8'))
  assert.equal(pkg.name, 'dsh-aris')
  assert.equal(pkg.version, '0.1.1-local.2')
  assert.equal(pkg.exports['.'], './dsh/index.mjs')
  assert.equal(pkg.exports['./runtime'], './dsh/runtime.mjs')
  assert.equal(pkg.exports['./skills'], './dsh/skills.mjs')
  assert.deepEqual(pkg.dsh.bundle.patch, ['./dsh/cordis.patch.yml', './presets/research.patch.yml'])
  assert.equal(pkg.peerDependencies['@deepseek-ai/dsh'], '0.1.7-rc.2')
  assert.ok(pkg.files.includes('presets'))
  for (const relative of ['presets/research.patch.yml']) {
    assert.ok((await stat(join(PACKAGE_ROOT, relative))).isFile())
  }
  const defaultEntry = await import('dsh-aris')
  const runtime = await import('dsh-aris/runtime')
  const skills = await import('dsh-aris/skills')
  assert.equal(defaultEntry.apply, runtime.apply)
  assert.deepEqual(defaultEntry.inject, ['tools'])
  assert.deepEqual(skills.inject, ['skills'])
  assert.notEqual(skills.apply, runtime.apply)
})

test('host bundle keeps its compatibility row id but mounts runtime, never the scoped skill provider', async () => {
  const patch = await readYaml(join(PACKAGE_ROOT, 'dsh/cordis.patch.yml'))
  const inserted = patch.flatMap(row => row.insert ?? [])
  const runtimeRows = inserted.filter(row => row.name === 'dsh-aris' || row.name === 'dsh-aris/runtime')
  assert.deepEqual(runtimeRows, [{ id: 'aris-skills', name: 'dsh-aris' }])
  assert.equal(inserted.some(row => row.name === 'dsh-aris/skills'), false)
  assert.equal(inserted.some(row => row.name === '@deepseek-ai/dsh-skill-filesystem'), false)
  const mountedEntry = await import(runtimeRows[0].name)
  const runtime = await import('dsh-aris/runtime')
  assert.equal(mountedEntry.apply, runtime.apply)
  assert.deepEqual(mountedEntry.inject, ['tools'])
})

test('research template is the full current standard composition plus one scoped skills row', async () => {
  const standardPatch = await readYaml(join(CHECKOUT, 'packages/bundle/web-app/presets/standard.patch.yml'))
  const researchPatch = await readYaml(join(PACKAGE_ROOT, 'presets/research.patch.yml'))
  const metadata = researchPatch[0].insert[0].config
  assert.equal(metadata.id, 'research')
  assert.equal(researchPatch[0].insert[0].id, 'preset-research')
  const standard = standardPatch[0].insert[0].config.plugins
  standard.find(row => row.id === 'compaction').config.find(row => row.id === 'compaction-basic').config = {
    modelPolicies: [{ provider: 'copilot-chat', model: 'claude-opus-5-5', thresholdRatio: 0.3, retainRatio: 0.08 }],
  }
  standard.find(row => row.id === 'delegation').config.find(row => row.id === 'tool-ralph').disabled = false
  const research = metadata.plugins
  assert.equal(research.length, standard.length + 1)
  assert.deepEqual(research.slice(0, -1), standard, 'standard tool grants and service realms remain unchanged')
  assert.deepEqual(research.at(-1), { id: 'aris-skills', name: 'dsh-aris/skills' })
  assert.equal(research.some(row => row.name === 'dsh-aris' || row.name === 'dsh-aris/runtime'), false)
  assert.equal(metadata.name, '科研模式')
  assert.equal(typeof metadata.description, 'string')
  assert.equal(typeof metadata.order, 'number')
})
