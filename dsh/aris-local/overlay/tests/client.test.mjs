import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

// Evaluate the shipped build-free browser entry without a browser or network.
test('ARIS conversation tab binds the rc.2 session scope through injection', async () => {
  let module
  const source = await readFile(new URL('../dsh/client.js', import.meta.url), 'utf8')
  runInNewContext(source, { window: { __ModuleLoader__: { load: value => { module = value } } } })
  assert.equal(module.id, 'dsh-aris')
  const plugin = module.factory(name => {
    assert.equal(name, 'react')
    return { createElement: () => {} }
  })
  let options
  let component
  const calls = []
  plugin.apply({
    effect() {},
    connection: { rpc: { call: (...args) => { calls.push(args); return Promise.resolve({ ok: true }) } } },
    slots: {
      inject(name, register) { assert.equal(name, 'conversation.view'); register() },
      register(value, render) { options = value; component = render; return () => {} },
    },
  })
  assert.equal(options.id, 'aris')
  assert.equal(typeof component, 'function')
  const first = options.inject('session-a')
  const second = options.inject('session-b')
  assert.equal(first.sessionId, 'session-a')
  assert.equal(Object.hasOwn(first, 'connection'), false)
  const signal = new AbortController().signal
  await first.readState(signal)
  await second.readState(signal)
  assert.equal(calls[0][0], '/aris')
  assert.equal(calls[0][1], 'state')
  assert.equal(calls[0][2].sessionId, 'session-a')
  assert.equal(calls[1][2].sessionId, 'session-b')
  assert.equal(calls[0][3], signal)
})
