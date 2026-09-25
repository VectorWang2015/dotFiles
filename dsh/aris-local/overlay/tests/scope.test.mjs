import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { PACKAGE_ROOT, TEST_WORK } from './checkout.mjs'
import * as runtime from '../dsh/runtime.mjs'

const { Context } = await import('@deepseek-ai/cordis')
const { createScope, scopeOf, bindScopeParent } = await import('@deepseek-ai/dsh-scope')
const { default: SkillRegistry, renderSkillContent, isModelInvocable } = await import('@deepseek-ai/dsh-skill')
const filesystem = await import('@deepseek-ai/dsh-skill-filesystem')
const arisSkills = await import('../dsh/skills.mjs')
const SKILL_ROOT = join(PACKAGE_ROOT, 'skills')

/** Only top-level bundles are the ARIS catalog; nested alternate corpora are not. */
async function packagedNames() {
  const names = []
  for (const entry of await readdir(SKILL_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    try {
      assert.ok((await stat(join(SKILL_ROOT, entry.name, 'SKILL.md'))).isFile())
      names.push(entry.name)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  assert.equal(names.length, 83, 'test the actual 83 packaged bundles, not a synthetic corpus')
  return names.sort()
}

/** All writable roots are private descendants of the explicitly permitted test-work. */
async function fixture(t) {
  await mkdir(TEST_WORK, { recursive: true })
  const dir = await mkdtemp(join(TEST_WORK, 'aris-scopes-'))
  const ctx = new Context()
  const cwd = join(dir, 'project')
  const env = {
    DSH_HOME: join(dir, 'dsh-home'),
    DSH_AGENTS_HOME: join(dir, 'agents-home'),
    DSH_BUNDLED_SKILL_DIR: join(dir, 'other-bundled'),
    ARIS_REPO: '/operator/kept-by-skill-tests',
  }
  const inherited = Object.fromEntries(Object.keys(env).map(name => [name, process.env[name]]))
  t.after(async () => {
    try {
      await ctx.fiber.dispose()
    } finally {
      for (const [name, value] of Object.entries(inherited)) {
        if (value === undefined) delete process.env[name]
        else process.env[name] = value
      }
      await rm(dir, { recursive: true, force: true })
    }
  })
  Object.assign(process.env, env)
  await mkdir(join(cwd, '.git'), { recursive: true })
  const roots = [
    [join(cwd, '.dsh/skills'), 'from-project-dsh'],
    [join(cwd, '.agents/skills'), 'from-project-agents'],
    [join(env.DSH_HOME, 'skills'), 'from-user-dsh'],
    [join(env.DSH_AGENTS_HOME, 'skills'), 'from-user-agents'],
    [env.DSH_BUNDLED_SKILL_DIR, 'from-env-bundled'],
  ]
  for (const [root, name] of roots) {
    const bundle = join(root, name)
    await mkdir(bundle, { recursive: true })
    await writeFile(join(bundle, 'SKILL.md'), `---\nname: ${name}\ndescription: Offline isolation canary\n---\n\n${name} body.\n`, { flag: 'wx' })
  }
  await ctx.plugin(SkillRegistry)
  return { ctx, cwd, localNames: roots.map(([, name]) => name).sort() }
}

const namesOf = skills => skills.map(skill => skill.name).sort()

test('skills entry uses only the real bundled provider, ignores ambient/project roots, and needs no tools', { timeout: 10000 }, async (t) => {
  assert.deepEqual(arisSkills.inject, ['skills'])
  assert.equal(Object.hasOwn(arisSkills, 'default'), false)
  const { ctx, cwd } = await fixture(t)
  const expected = await packagedNames()
  const mountedProviders = []
  ctx.on('internal/plugin', (fiber) => {
    if (fiber.runtime?.callback === filesystem.apply) mountedProviders.push(fiber)
  })
  const research = createScope(ctx, { preset: 'research' })
  const scope = scopeOf(research.ctx)
  await research.ctx.plugin(arisSkills)
  const observation = await ctx.skills.snapshot({ cwd, scope })
  assert.equal(observation.complete, true)
  assert.deepEqual(namesOf(observation.skills), expected)
  assert.ok(observation.skills.every(skill => skill.provider === 'aris' && skill.source === 'bundled'))
  assert.deepEqual(await ctx.skills.list({ cwd }), [])
  assert.equal(ctx.get('tools'), undefined)
  assert.equal(process.env.ARIS_REPO, '/operator/kept-by-skill-tests')
  assert.equal(mountedProviders.length, 1)
  const config = mountedProviders[0].config
  assert.equal(config.providerName, 'aris')
  assert.equal(config.includeDefaultRoots, false)
  assert.equal(resolve(config.bundledSkillDir), SKILL_ROOT)
  assert.equal(config.watch, false)
  await research.dispose()
  assert.deepEqual(await ctx.skills.list({ cwd, scope }), [])
  assert.equal(await ctx.skills.get('research-review', { cwd, scope }), undefined)
  assert.equal(process.env.ARIS_REPO, '/operator/kept-by-skill-tests')
})

test('real registry keeps sibling standard/research scopes isolated through inheritance, rebind and unload', { timeout: 10000 }, async (t) => {
  // This is a registry/Cordis integration test, not a Loader/Agent/Web preset boot.
  const { ctx, cwd, localNames } = await fixture(t)
  const arisNames = await packagedNames()
  ctx.provide('tools', Object.freeze({}))
  await ctx.plugin(runtime)
  ctx.skills.register({
    name: 'host-baseline', description: 'A host-owned skill remains visible to both presets.',
    source: 'runtime', content: 'Host baseline body.',
  })
  const standard = createScope(ctx, { preset: 'standard' })
  const research = createScope(ctx, { preset: 'research' })
  const standardKey = scopeOf(standard.ctx)
  const researchKey = scopeOf(research.ctx)
  assert.notEqual(standardKey, researchKey)
  const standardChild = createScope(standard.ctx, { session: 'standard-child' }, { parent: standardKey })
  const researchChild = createScope(research.ctx, { session: 'research-child' }, { parent: researchKey })
  const researchGrandchild = createScope(researchChild.ctx, { session: 'research-grandchild' }, { parent: scopeOf(researchChild.ctx) })
  const childKey = scopeOf(researchChild.ctx)
  const grandchildKey = scopeOf(researchGrandchild.ctx)
  // Match the standard preset's ordinary filesystem contribution, with only watchers disabled.
  await standard.ctx.plugin(filesystem, { watch: false })
  await research.ctx.plugin(filesystem, { watch: false })
  let arisFiber = research.ctx.plugin(arisSkills)
  await arisFiber
  const hostOnly = ['host-baseline']
  const standardNames = [...hostOnly, ...localNames].sort()
  const researchNames = [...standardNames, ...arisNames].sort()
  const listNames = async scope => namesOf(await ctx.skills.list({ cwd, scope }))
  let changes = 0
  ctx.on('skills/change', () => { changes += 1 })

  await t.test('host and standard cannot list or force-load ARIS while research lists all 83', async () => {
    assert.deepEqual(await listNames(undefined), hostOnly)
    assert.deepEqual(await listNames(standardKey), standardNames)
    assert.deepEqual(await listNames(researchKey), researchNames)
    for (const name of arisNames) {
      assert.equal(await ctx.skills.get(name, { cwd }), undefined)
      assert.equal(await ctx.skills.get(name, { cwd, scope: standardKey }), undefined)
    }
    const standardCatalog = await ctx.skills.list({ cwd, scope: standardKey })
    const researchCatalog = await ctx.skills.list({ cwd, scope: researchKey })
    assert.equal(standardCatalog.filter(isModelInvocable).some(skill => skill.provider === 'aris'), false)
    assert.equal(researchCatalog.filter(isModelInvocable).some(skill => skill.name === 'research-review'), true)
    assert.equal(researchCatalog.filter(skill => skill.provider === 'aris').length, 83)
    assert.ok(localNames.every(name => researchCatalog.find(skill => skill.name === name)?.provider === 'filesystem'))
  })

  await t.test('all real bodies load with original package resource paths, including script/shared-reference resources', async () => {
    for (const name of arisNames) {
      const definition = await ctx.skills.get(name, { cwd, scope: researchKey })
      const path = join(SKILL_ROOT, name, 'SKILL.md')
      assert.ok(definition, name)
      assert.equal(definition.provider, 'aris')
      assert.equal(definition.path, path)
      assert.deepEqual(definition.resourceBase, { kind: 'directory', path: join(SKILL_ROOT, name) })
      assert.ok(definition.content.length > 0, name)
      assert.ok((await readFile(path, 'utf8')).trimEnd().endsWith(definition.content), `${name}: body remains verbatim`)
    }
    const figure = await ctx.skills.get('figure-spec', { cwd, scope: researchKey })
    const rendered = renderSkillContent(figure)
    assert.ok(rendered.includes(`Base directory for this skill: ${join(SKILL_ROOT, 'figure-spec')}\n`))
    assert.ok(rendered.includes(figure.content))
    assert.ok((await stat(join(figure.resourceBase.path, 'scripts/figure_renderer.py'))).isFile())
    assert.ok((await stat(resolve(figure.resourceBase.path, '../shared-references/integration-contract.md'))).isFile())
    assert.ok((await stat(join(PACKAGE_ROOT, 'tools/run_state.py'))).isFile())
  })

  await t.test('child scopes inherit only their preset and reparenting invalidates the cached view', async () => {
    assert.deepEqual(await listNames(scopeOf(standardChild.ctx)), standardNames)
    assert.deepEqual(await listNames(childKey), researchNames)
    assert.deepEqual(await listNames(grandchildKey), researchNames)
    const inherited = await ctx.skills.get('figure-spec', { cwd, scope: grandchildKey })
    assert.equal(inherited.path, join(SKILL_ROOT, 'figure-spec/SKILL.md'))
    const agentKey = { session: 'blank-recompose' }
    const binding = bindScopeParent(agentKey, researchKey)
    assert.deepEqual(await listNames(agentKey), researchNames)
    binding.rebind(standardKey)
    assert.deepEqual(await listNames(agentKey), standardNames)
    assert.equal(await ctx.skills.get('research-review', { cwd, scope: agentKey }), undefined)
    binding.rebind(researchKey)
    assert.deepEqual(await listNames(agentKey), researchNames)
  })

  await t.test('unloading skills invalidates warmed parent/descendant catalogs without removing ordinary skills', async () => {
    const before = changes
    await arisFiber.dispose()
    assert.ok(changes > before, 'unload must emit registry invalidation')
    for (const scope of [researchKey, childKey, grandchildKey]) {
      assert.deepEqual(await listNames(scope), standardNames)
      assert.equal(await ctx.skills.get('research-review', { cwd, scope }), undefined)
    }
    assert.deepEqual(await listNames(standardKey), standardNames)
    assert.deepEqual(await listNames(undefined), hostOnly)
    assert.equal(process.env.ARIS_REPO, '/operator/kept-by-skill-tests')
    arisFiber = research.ctx.plugin(arisSkills)
    await arisFiber
    assert.deepEqual(await listNames(researchKey), researchNames)
    assert.deepEqual(await listNames(grandchildKey), researchNames)
  })

  await t.test('disposing the research scope removes its providers while standard and host survive', async () => {
    await research.dispose()
    for (const scope of [researchKey, childKey, grandchildKey]) {
      assert.deepEqual(await listNames(scope), hostOnly)
      assert.equal(await ctx.skills.get('research-review', { cwd, scope }), undefined)
    }
    assert.deepEqual(await listNames(standardKey), standardNames)
    assert.deepEqual(await listNames(scopeOf(standardChild.ctx)), standardNames)
    assert.deepEqual(await listNames(undefined), hostOnly)
  })
})
