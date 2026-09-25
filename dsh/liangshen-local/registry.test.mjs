import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { CHECKOUT, load } from './checkout.mjs'
const { Context } = await load('@deepseek-ai/cordis')
const { default: Loader } = await load('@deepseek-ai/cordis-plugin-loader')
const { default: Group } = await load('@deepseek-ai/cordis-plugin-group')
const { default: Projections } = await load('@deepseek-ai/dsh-session-projection')
const { default: Prompt } = await load('@deepseek-ai/dsh-system-prompt')
const { default: Registry } = await load('@deepseek-ai/dsh-agent-preset-registry')
const { default: Tools } = await load('@deepseek-ai/dsh-tools')
const upstream = await import('./upstream/lib/index.js')
const patched = await import('./patched/lib/index.js')
const tick = () => new Promise(resolve => setImmediate(resolve))
async function host(t) {
  const ctx = new Context()
  ctx.baseUrl = pathToFileURL(`${CHECKOUT}/apps/cli/cordis.yml`).href
  t.after(() => ctx.fiber.dispose())
  await ctx.plugin(Loader)
  ctx.loader.builtins.group = Group
  await ctx.plugin(Projections)
  await ctx.plugin(Prompt, {personaPrefix:'You are a helpful software engineer assistant.'})
  return ctx
}
async function registry(ctx) { await ctx.plugin(Registry, { default: 'standard' }); await tick() }
const find = async ctx => (await ctx.agentPresets.list()).find(row => row.id === 'liangshen')

test('real YAML Loader fixture reproduces disappearance and its fixed overlay registers', async () => {
  const { boot, loadOverlayPatches } = await load('@deepseek-ai/dsh-app-boot')
  for (const fixed of [false, true]) {
    const patches = fixed ? loadOverlayPatches('liangshen-repro', fileURLToPath(new URL('./fixed.overlay.yml', import.meta.url))) : []
    const ctx = await boot('liangshen-repro', fileURLToPath(new URL('./repro.cordis.yml', import.meta.url)), patches, async ctx => {
      await ctx.plugin(Projections)
      await ctx.plugin(Prompt)
    }, pathToFileURL(`${CHECKOUT}/apps/cli/`).href)
    try { assert.equal(Boolean(await find(ctx)), fixed) }
    finally { await ctx.fiber.dispose() }
  }
})

test('published 0.4.2 loses the declaration when its real registry arrives later', async t => {
  const ctx = await host(t)
  const fiber = ctx.plugin(upstream)
  await tick()
  assert.equal(fiber.state, 2)
  await registry(ctx)
  assert.equal(await find(ctx), undefined)
})

test('actual patched lib waits for the registry, registers unchanged composition, and disposes/remounts', async t => {
  const ctx = await host(t)
  const fiber = ctx.plugin(patched)
  await tick()
  assert.equal(fiber.state, 0)
  await registry(ctx)
  assert.equal(fiber.state, 2)
  assert.equal((await find(ctx)).name, '梁神模式')
  // This narrow host intentionally omits ordinary shell/fs/subagent providers.
  // The real registry must expose the declaration AND their diagnostics, not hide it.
  assert.match((await find(ctx)).broken, /waiting for tools/)
  const document = await ctx.agentPresets.readDocument('liangshen')
  for (const needle of ['Thinking Disruption:', 'presentation: both', 'tool-activate.mjs', 'fact-ledger.mjs', '@deepseek-ai/dsh-tool-bash', 'instructionSource: host', 'thresholdChars: 4096']) assert.ok(document.content.includes(needle), needle)
  assert.ok(!document.content.includes('tool-bootstrap.mjs'))
  await fiber.dispose()
  assert.equal(await find(ctx), undefined)
  const again = ctx.plugin(patched)
  await tick()
  assert.ok(await find(ctx))
  await again.dispose()
  assert.equal(await find(ctx), undefined)
})

test('already-active provider works with both versions; identity stays liangshen', async t => {
  const ctx = await host(t)
  await registry(ctx)
  for (const plugin of [upstream, patched]) {
    const fiber = ctx.plugin(plugin)
    await tick()
    assert.equal((await find(ctx)).id, 'liangshen')
    await fiber.dispose()
    assert.equal(await find(ctx), undefined)
  }
})

test('enabled:false does not register even when dependency is ready', async t => {
  const ctx = await host(t)
  await registry(ctx)
  await ctx.plugin(patched, { enabled: false })
  await tick()
  assert.equal(await find(ctx), undefined)
})

test('patch preserves every shipped preset byte and the package/client identities', async () => {
  for (const name of await readdir(new URL('./upstream/presets/liangshen/', import.meta.url))) {
    assert.deepEqual(await readFile(new URL(`./upstream/presets/liangshen/${name}`, import.meta.url)), await readFile(new URL(`./patched/presets/liangshen/${name}`, import.meta.url)), name)
  }
  for (const name of ['package.json', 'cordis.patch.yml', 'lib/client.js']) assert.deepEqual(await readFile(new URL(`./upstream/${name}`, import.meta.url)), await readFile(new URL(`./patched/${name}`, import.meta.url)))
  assert.deepEqual(upstream.inject, ['systemPrompt'])
  assert.deepEqual(patched.inject, ['systemPrompt', 'agentPresets'])
})

test('real new tools registry executes LiangShen fact_register and unregisters on disposal', async t => {
  const ctx = await host(t)
  await ctx.plugin(Tools)
  const plugin = await import('./patched/presets/liangshen/fact-ledger.mjs')
  const fiber = ctx.plugin(plugin)
  await fiber
  assert.ok(ctx.tools.schemas().some(row => row.name === 'fact_register'))
  const exec = args => ctx.tools.execute({ name: 'fact_register', arguments: args, callId: 'offline-ledger', signal: new AbortController().signal })
  const result = await exec({ fact: 'No paid models', tag: 'constraint' })
  assert.ok(JSON.stringify(result).includes('Pinned'))
  assert.ok(!result.error)
  const invalid = await exec({})
  assert.ok(JSON.stringify(invalid).includes('requires either'))
  await fiber.dispose()
  assert.equal(ctx.tools.get('fact_register'), undefined)
})

test('real tool_activate validates target namespaces and disposes registrations', async t => {
  const ctx = await host(t)
  await ctx.plugin(Tools)
  const fakeExternal = ctx.plugin({ apply(child) {
    child.tools.register({name: 'mcp__offline__inspect', description: 'Offline canary', parameters: {type:'object',properties:{}}, output:{schema:{type:'object',properties:{text:{type:'string'}},required:['text']},render:(_args,value)=>[{type:'text',text:value.text}]}, async execute() { return {text:'never called'} }})
  }, inject: ['tools'] })
  await fakeExternal
  const plugin = await import('./patched/presets/liangshen/tool-activate.mjs')
  const fiber = ctx.plugin(plugin)
  await fiber
  const exec = namespace => ctx.tools.execute({ name: 'tool_activate', arguments: {namespace}, callId: 'offline-activate', signal: new AbortController().signal })
  assert.ok(JSON.stringify(await exec('offline')).includes('Activated namespace'))
  assert.ok(JSON.stringify(await exec('missing')).includes('unknown paged namespace'))
  await fiber.dispose()
  assert.equal(ctx.tools.get('tool_activate'), undefined)
})

test('paging and fact replay survive serialized history and enforce LRU capacity', async () => {
  const { replayActivations, partitionWireTools } = await import('./patched/presets/liangshen/paging.mjs')
  const { foldFactLedger } = await import('./patched/presets/liangshen/fact-ledger.mjs')
  const events = ['a','b','c','d'].map((namespace,i) => ({type:'tool/call',data:{name:'tool_activate',callId:String(i),arguments:{namespace}}}))
  assert.deepEqual(replayActivations(JSON.parse(JSON.stringify(events))), {active:['b','c','d'],evicted:['a']})
  const tools = [{name:'read'}, {name:'mcp__a__inspect'}, {name:'mcp__d__inspect'}]
  const view = partitionWireTools(tools, ['mcp__*'], ['d'])
  assert.deepEqual(view.resident.map(tool=>tool.name), ['read','mcp__d__inspect'])
  assert.deepEqual(view.inactive.get('a').map(tool=>tool.name), ['mcp__a__inspect'])
  const facts = [
    {type:'tool/call',data:{name:'fact_register',arguments:{fact:'Preserve historical sessions',tag:'history'}}},
    {type:'tool/call',data:{name:'fact_register',arguments:{fact:'Temporary fact',tag:'temp'}}},
    {type:'tool/call',data:{name:'fact_register',arguments:{revoke:'temp'}}},
  ]
  assert.deepEqual(foldFactLedger(JSON.parse(JSON.stringify(facts))), [{text:'Preserve historical sessions',tag:'history'}])
})

test('minimal prompt retains persona/plan policy and workspace while removing standard guidance', async t => {
  const ctx = await host(t)
  const plugin = await import('./patched/presets/liangshen/minimal-prompt.mjs')
  await ctx.plugin(plugin, {instructionSource:'host',keepPlanPolicy:true})
  for (const [name,text] of [['plan:policy','PLAN POLICY'], ['tools:extra','STANDARD GUIDANCE']]) ctx.systemPrompt.section({name,text,order:1})
  const assembly = await ctx.systemPrompt.assemble({agent:{session:{header:{cwd:'/offline/project'}}}})
  assert.deepEqual(assembly.sections.map(x=>x.name).sort(), ['deployment:persona-prefix','plan:policy'])
  assert.match(assembly.sections.find(x=>x.name==='deployment:persona-prefix').text, /Your working directory is \/offline\/project\./)
})
