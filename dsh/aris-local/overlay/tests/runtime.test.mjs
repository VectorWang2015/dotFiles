import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PACKAGE_ROOT } from './checkout.mjs'
import * as runtime from '../dsh/runtime.mjs'
import * as defaultEntry from '../dsh/index.mjs'

// Dynamic imports run after checkout.mjs has installed the test-only resolver.
const { Context } = await import('@deepseek-ai/cordis')
const { default: SkillRegistry } = await import('@deepseek-ai/dsh-skill')

const ORIGINAL_CONTENT = Object.freeze([
  Object.freeze({ type: 'text', text: 'Reviewer response — 原文\n\nScore: 8/10\n' }),
  Object.freeze({ type: 'text', text: '```text\nDo not rewrite this block.\n```\n' }),
])

function resultWith(overrides = {}) {
  return Object.freeze({
    content: ORIGINAL_CONTENT,
    isError: false,
    value: Object.freeze({ structuredContent: Object.freeze({ threadId: 'thread-123' }) }),
    ...overrides,
  })
}

/** Only the unused tools injection and optional RPC endpoints are in-memory stand-ins. */
async function mountRuntime(t, repoValue, services = {}) {
  const inherited = process.env.ARIS_REPO
  const ctx = new Context()
  t.after(async () => {
    try {
      await ctx.fiber.dispose()
    } finally {
      if (inherited === undefined) delete process.env.ARIS_REPO
      else process.env.ARIS_REPO = inherited
    }
  })
  if (repoValue === undefined) delete process.env.ARIS_REPO
  else process.env.ARIS_REPO = repoValue
  ctx.provide('tools', Object.freeze({}))
  for (const [name, value] of Object.entries(services)) ctx.provide(name, value)
  const fiber = ctx.plugin(runtime)
  await fiber
  return { ctx, fiber }
}

function postExecute(ctx, name, result, next) {
  return ctx.waterfall(ctx, 'tools/post-execute', Object.freeze({ name }), result, next)
}

test('default entry is runtime-only and activates without any skills service', { timeout: 5000 }, async (t) => {
  assert.equal(defaultEntry.apply, runtime.apply)
  assert.equal(defaultEntry.name, runtime.name)
  assert.deepEqual(defaultEntry.inject, ['tools'])
  assert.equal(Object.hasOwn(defaultEntry, 'default'), false)
  const { ctx } = await mountRuntime(t)
  assert.equal(process.env.ARIS_REPO, PACKAGE_ROOT, 'apply must activate without skills')
  assert.equal(ctx.get('skills'), undefined)
  await ctx.plugin(SkillRegistry)
  assert.deepEqual(await ctx.skills.list(), [], 'runtime must not add a provider when skills becomes available')
})

test('runtime publishes the package root only while it owns an initially unset ARIS_REPO', { timeout: 5000 }, async (t) => {
  const { ctx, fiber } = await mountRuntime(t)
  assert.equal(process.env.ARIS_REPO, PACKAGE_ROOT)
  await fiber.dispose()
  assert.equal(Object.hasOwn(process.env, 'ARIS_REPO'), false)
  const reloaded = ctx.plugin(runtime)
  await reloaded
  assert.equal(process.env.ARIS_REPO, PACKAGE_ROOT)
  await reloaded.dispose()
  assert.equal(Object.hasOwn(process.env, 'ARIS_REPO'), false)
})

for (const value of ['/operator/aris-root', '']) {
  test(`runtime preserves an operator ARIS_REPO of ${JSON.stringify(value)}`, { timeout: 5000 }, async (t) => {
    const { fiber } = await mountRuntime(t, value)
    assert.equal(process.env.ARIS_REPO, value)
    await fiber.dispose()
    assert.equal(process.env.ARIS_REPO, value)
    assert.equal(Object.hasOwn(process.env, 'ARIS_REPO'), true)
  })
}

test('runtime disposal does not erase a later operator replacement', { timeout: 5000 }, async (t) => {
  const { fiber } = await mountRuntime(t)
  process.env.ARIS_REPO = '/operator/replaced-during-runtime'
  await fiber.dispose()
  assert.equal(process.env.ARIS_REPO, '/operator/replaced-during-runtime')
})

test('runtime retains the optional read-only run-status registration and disposes it', { timeout: 5000 }, async (t) => {
  const disposeRpc = t.mock.fn()
  const handle = t.mock.fn(() => disposeRpc)
  const { fiber } = await mountRuntime(t, undefined, {
    connection: { rpc: { handle } },
    sessions: { get: () => undefined },
  })
  assert.equal(handle.mock.callCount(), 1)
  const [channel, callback, options] = handle.mock.calls[0].arguments
  assert.equal(channel, '/aris')
  assert.deepEqual(options, { authority: 'loopback' })
  assert.deepEqual(await callback('state', { sessionId: 'not-present' }), {
    ok: true, value: { workspace: undefined, artifacts: [] },
  })
  await fiber.dispose()
  assert.equal(disposeRpc.mock.callCount(), 1)
})

for (const name of ['mcp__codex__codex', 'mcp__codex__codex-reply']) {
  test(`${name} prepends continuation metadata without rewriting the reviewer response`, { timeout: 5000 }, async (t) => {
    const { ctx } = await mountRuntime(t)
    const result = resultWith()
    const decision = Object.freeze({ kind: 'accept' })
    const next = t.mock.fn(async () => decision)
    const projected = await postExecute(ctx, name, result, next)
    assert.equal(next.mock.callCount(), 1)
    assert.notEqual(projected, decision)
    assert.equal(projected.kind, 'accept')
    assert.equal(Object.hasOwn(projected, 'value'), false)
    assert.deepEqual(projected.content[0], {
      type: 'text',
      text: 'Codex continuation metadata (not part of the reviewer response): threadId=thread-123\n\n',
    })
    assert.deepEqual(projected.content.slice(1), ORIGINAL_CONTENT)
    for (const [index, chunk] of ORIGINAL_CONTENT.entries()) assert.equal(projected.content[index + 1], chunk)
    assert.equal(result.content, ORIGINAL_CONTENT)
    assert.equal(result.value.structuredContent.threadId, 'thread-123')
    assert.deepEqual(decision, { kind: 'accept' })
  })
}

for (const content of [Object.freeze([{ type: 'text', text: 'Downstream-rendered response\n' }]), Object.freeze([])]) {
  test(`Codex projection honors downstream content (${content.length} chunks), including an empty replacement`, { timeout: 5000 }, async (t) => {
    const { ctx } = await mountRuntime(t)
    const decision = Object.freeze({ kind: 'accept', content })
    const next = t.mock.fn(async () => decision)
    const projected = await postExecute(ctx, 'mcp__codex__codex', resultWith(), next)
    assert.equal(next.mock.callCount(), 1)
    assert.deepEqual(projected.content.slice(1), content)
    assert.equal(projected.content.length, content.length + 1)
    assert.equal(decision.content, content)
  })
}

const unchangedCases = [
  { label: 'non-Codex tool', name: 'bash' },
  { label: 'similar but non-Codex name', name: 'mcp__codex__other' },
  { label: 'failed result', overrides: { isError: true } },
  { label: 'downstream block/rejection', decision: { kind: 'block', feedback: [{ type: 'text', text: 'Blocked by policy.' }] } },
  { label: 'downstream replacement value', decision: { kind: 'accept', value: 'replacement' } },
  { label: 'own replacement value explicitly undefined', decision: { kind: 'accept', value: undefined } },
  { label: 'missing result value', overrides: { value: undefined } },
  { label: 'missing structured content', overrides: { value: {} } },
  { label: 'missing threadId', overrides: { value: { structuredContent: {} } } },
  { label: 'numeric threadId', overrides: { value: { structuredContent: { threadId: 123 } } } },
  { label: 'null threadId', overrides: { value: { structuredContent: { threadId: null } } } },
]

for (const { label, name = 'mcp__codex__codex', decision: fields = { kind: 'accept' }, overrides } of unchangedCases) {
  test(`post-execute delegates and preserves the original decision for ${label}`, { timeout: 5000 }, async (t) => {
    const { ctx } = await mountRuntime(t)
    const decision = Object.freeze(fields)
    const result = resultWith(overrides)
    const next = t.mock.fn(async () => decision)
    assert.equal(await postExecute(ctx, name, result, next), decision)
    assert.equal(next.mock.callCount(), 1)
    assert.equal(result.content, ORIGINAL_CONTENT)
  })
}

test('the existing string-only rule also projects an empty string threadId', { timeout: 5000 }, async (t) => {
  const { ctx } = await mountRuntime(t)
  const next = t.mock.fn(async () => ({ kind: 'accept' }))
  const projected = await postExecute(ctx, 'mcp__codex__codex', resultWith({
    value: { structuredContent: { threadId: '' } },
  }), next)
  assert.equal(next.mock.callCount(), 1)
  assert.equal(projected.content[0].text, 'Codex continuation metadata (not part of the reviewer response): threadId=\n\n')
  assert.deepEqual(projected.content.slice(1), ORIGINAL_CONTENT)
})

test('a rejected next promise is propagated without projecting a response', { timeout: 5000 }, async (t) => {
  const { ctx } = await mountRuntime(t)
  const failure = new Error('downstream rejected')
  const next = t.mock.fn(async () => { throw failure })
  await assert.rejects(postExecute(ctx, 'mcp__codex__codex', resultWith(), next), error => error === failure)
  assert.equal(next.mock.callCount(), 1)
})

test('disposing runtime removes its real Cordis post-execute listener', { timeout: 5000 }, async (t) => {
  const { ctx, fiber } = await mountRuntime(t)
  const decision = Object.freeze({ kind: 'accept' })
  const next = t.mock.fn(async () => decision)
  await fiber.dispose()
  assert.equal(await postExecute(ctx, 'mcp__codex__codex', resultWith(), next), decision)
  assert.equal(next.mock.callCount(), 1)
})
