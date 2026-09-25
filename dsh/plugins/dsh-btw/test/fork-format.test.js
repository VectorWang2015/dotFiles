import assert from 'node:assert/strict'
import test from 'node:test'
import { forkCut, inflightTextOf, latestModelSelection, pinReadOnly } from '../lib/core.js'

for (const admission of [
  { type: 'user/message', surfaceOp: 'append' },
  { type: 'agent/inbox/spliced' },
]) {
  test(`fork stops before ${admission.type} admitted ahead of turn/start`, () => {
    const events = [
      { seq: 0, type: 'turn/end' },
      { seq: 1, type: 'sandbox/mode' },
      { seq: 2, ...admission },
      { seq: 3, type: 'turn/start' },
    ]
    assert.deepEqual(forkCut(events), { lastTurnEndIndex: 0, cut: 2 })
  })
}

test('cut and busy task use array positions, not persisted physical-row seq arithmetic', () => {
  const events = [
    { seq: 40, type: 'turn/end' },
    { seq: 45, type: 'turn/start' },
    { seq: 50, type: 'user/message', data: { content: [{ type: 'text', text: 'busy' }] } },
  ]
  assert.deepEqual(forkCut(events), { lastTurnEndIndex: 0, cut: 1 })
  assert.equal(inflightTextOf(events, 0), 'busy')
})

test('pending model selection survives an unrelated request and retires when consumed', () => {
  const selected = { provider: 'p', model: 'next', reasoningEffort: 'high' }
  const intent = { type: 'model/selection', data: selected }
  const unrelated = { type: 'request/header', data: { header: { config: { provider: 'p', model: 'previous' } } } }
  assert.deepEqual(latestModelSelection([intent, unrelated]), selected)
  const consumed = { type: 'request/header', data: { header: { config: selected } } }
  assert.deepEqual(latestModelSelection([intent, consumed, unrelated]), { provider: 'p', model: 'previous' })
})

test('adapter-defaulted effort does not become a user model selection', () => {
  assert.deepEqual(latestModelSelection([{ type: 'request/header', data: { header: {
    config: { provider: 'p', model: 'm', reasoningEffort: 'high' },
    adapterDefaults: { reasoningEffort: true },
  } } }]), { provider: 'p', model: 'm' })
  assert.deepEqual(latestModelSelection([], { provider: 'fallback', model: 'm' }), { provider: 'fallback', model: 'm' })
})

for (const spec of [
  { sandbox: 'read-only', approval: 'ask' },
  { sandbox: 'danger-full-access', approval: 'never' },
]) {
  test(`read-only refuses a misleading preset ${JSON.stringify(spec)} before command execution`, async () => {
    let called = false
    const ctx = {
      get: () => ({ resolve: () => spec }),
      commands: { execute() { called = true } },
    }
    await assert.rejects(pinReadOnly(ctx, { session: {} }, new AbortController().signal), /must enforce/)
    assert.equal(called, false)
  })
}

test('read-only refuses an approval override that still allows escalation', async () => {
  const services = {
    permissionPresets: {
      resolve: () => ({ sandbox: 'read-only', approval: 'never' }),
      current: () => 'read-only',
    },
    sandboxPolicy: { resolve: () => ({ mode: 'read-only' }) },
    approval: { overrideOf: () => 'ask', config: { policy: 'never' } },
  }
  const ctx = {
    get: name => services[name],
    commands: { execute: async () => ({ result: { kind: 'success' } }) },
  }
  await assert.rejects(pinReadOnly(ctx, { session: {} }, new AbortController().signal), /approval policy reports ask/)
})
