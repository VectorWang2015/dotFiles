import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, mkdtemp, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { Context, FiberState } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { SessionQueryEngine } from '@deepseek-ai/dsh-session-query'
import { LlmAdapter, createUserMessage } from '@deepseek-ai/dsh-llm'
import { SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session'

const require = createRequire(`${process.env.DSH_CHECKOUT}/package.json`)
const { load } = require('js-yaml')
const config = load(await readFile(new URL('./cordis.yml', import.meta.url), 'utf8'))

class ScriptedAdapter extends LlmAdapter {
  requests = []
  started = Promise.withResolvers()
  resolveModel(provider, model) { return Promise.resolve({ provider, id: model, name: model }) }
  async *stream(options) {
    this.requests.push(options)
    const busy = this.requests.length === 2
    const text = busy ? 'UNCOMMITTED_PARTIAL' : 'fixture reply'
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text }
    if (busy) {
      this.started.resolve()
      await new Promise((_, reject) => {
        if (options.signal.aborted) { reject(options.signal.reason); return }
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
      })
      return
    }
    yield { type: 'block-end', index: 0, block: { type: 'text', text } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

function idle(ctx, agent) {
  return new Promise(resolve => {
    const stop = ctx.on('agent/status', ({ agent: subject, status }) => {
      if (subject === agent && status === 'idle') { stop(); resolve() }
    })
  })
}

async function boot(t, mutate = () => {}) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-btw-integration-'))
  const ctx = new Context()
  t.after(async () => { await ctx.fiber.dispose(); await rm(root, { recursive: true, force: true }) })
  ctx.baseUrl = new URL('./', import.meta.url).href
  await ctx.plugin(Loader)
  // External shell execution is not used; the real filesystem sandbox below
  // verifies denial independently of this shell capability advertisement.
  ctx.provide('shell', { sandboxMode: 'danger-full-access' })
  const rows = structuredClone(config)
  mutate(rows)
  for (const row of rows) await ctx.loader.create(row)
  await ctx.loader.await()
  for (const entry of ctx.loader.entries()) {
    assert.equal(entry.fiber?.state, FiberState.ACTIVE, `failed Loader entry ${entry.options.name}`)
  }
  // Read-only live observation implementation; no search backend or persistence.
  await ctx.plugin(SessionQueryEngine)
  const unregister = await ctx.agentPresets.register({ id: 'research', plugins: [] })
  t.after(unregister)
  const adapter = new ScriptedAdapter()
  ctx.llm.registerAdapter(['fixture'], adapter)
  const handle = await ctx.agents.create({
    sessionId: 'source', meta: { cwd: root, agentPreset: 'research' },
    agentOptions: { provider: 'fixture', model: 'fixture-model' },
    setup: async scope => { await ctx.agentPresets.mount(scope, 'research') },
  })
  const agent = handle.agent
  const attachments = new Set(['source'])
  const workspace = {
    sessionIds: ['source'],
    async attachSession(id) { attachments.add(id) },
    async detachSession(id) { attachments.delete(id) },
  }
  ctx.provide('workspaceRegistry', { list: () => [workspace] })
  const done = idle(ctx, agent)
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'completed task' }], source: { kind: 'user' } }))
  await done
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'BUSY_TASK' }], source: { kind: 'user' } }))
  await adapter.started.promise
  return { ctx, agent, adapter, root, attachments }
}

test('Loader composition forks a busy format-4 Agent, preserving preset/model and enforcing read-only', { timeout: 15000 }, async t => {
  assert.equal(SESSION_FORMAT_VERSION, 4)
  const { ctx, agent, adapter, root, attachments } = await boot(t)
  const result = await ctx.commands.execute(agent, '/btw explain?', [], new AbortController().signal)
  assert.equal(result.result.kind, 'success', result.result.text)
  const child = ctx.agents.list().find(item => item.id !== agent.id)
  assert.ok(child)
  if (child.status !== 'idle') await idle(ctx, child)
  assert.equal(ctx.permissionPresets.current(child.session), 'read-only')
  assert.equal(ctx.sandboxPolicy.resolve({ session: child.session }).mode, 'read-only')
  assert.equal(ctx.approval.overrideOf(child.session), 'never')
  assert.equal(child.session.header.parentSession, agent.id)
  assert.equal(child.session.header.cwd, root)
  assert.equal(ctx.sessionProjections.stateOf(child.session, 'agentPreset'), 'research')
  assert.equal(attachments.has(child.id), true)
  const observation = await ctx.sessionQuery.observeSession(child.id)
  t.after(() => observation[Symbol.dispose]())
  const inherited = observation.events.slice(0, observation.inheritedEventCount)
  assert.equal(inherited.filter(event => event.type === 'turn/end').length, 1)
  assert.doesNotMatch(JSON.stringify(inherited), /BUSY_TASK|UNCOMMITTED_PARTIAL/)
  assert.equal(observation.events[observation.inheritedEventCount].type, 'session/end-seed')
  assert.equal(observation.events[observation.inheritedEventCount].data.inherited, true)
  const childRequest = adapter.requests[2]
  assert.ok(childRequest)
  assert.equal(childRequest.model, 'fixture-model')
  assert.match(JSON.stringify(childRequest.messages), /主会话正在进行中的任务：BUSY_TASK/)
  assert.doesNotMatch(JSON.stringify(childRequest.messages), /UNCOMMITTED_PARTIAL/)
  const target = await ctx.fs.resolve(join(root, 'must-not-exist'))
  await assert.rejects(ctx.fs.writeText(target, 'forbidden', undefined, undefined,
    ctx.sandboxPolicy.resolve({ session: child.session })), error => error.code === 'FS_SANDBOX_DENIED')
  await assert.rejects(access(join(root, 'must-not-exist')))
  await ctx.loader.resolve('btw').fiber.dispose()
  assert.equal(await ctx.commands.execute(agent, '/btw gone?', [], new AbortController().signal), undefined)
  assert.deepEqual(ctx.agents.list().map(item => item.id), ['source'], 'plugin unload releases its child scopes without stopping the source')
})

test('missing read-only preset disposes the unpublished-question child and detaches workspace', { timeout: 15000 }, async t => {
  const { ctx, agent, adapter, attachments } = await boot(t, rows => {
    delete rows.find(row => row.id === 'permissions').config.presets['read-only']
  })
  const result = await ctx.commands.execute(agent, '/btw do not deliver', [], new AbortController().signal)
  assert.equal(result.result.kind, 'error')
  assert.match(result.result.text, /unknown preset/)
  assert.deepEqual(ctx.agents.list().map(item => item.id), ['source'])
  assert.deepEqual([...attachments], ['source'])
  assert.equal(adapter.requests.length, 2, 'no child model request before permission verification')
})
