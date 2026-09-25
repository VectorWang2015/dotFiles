import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'
import { Context } from '@deepseek-ai/cordis'

const checkout = process.env.DSH_CHECKOUT
const require = createRequire(`${checkout}/package.json`)
const requireRenderer = createRequire(`${checkout}/packages/client/ui-renderer/package.json`)
const React = requireRenderer('react')
const { createRoot } = requireRenderer('react-dom/client')
const { act } = React
const { JSDOM } = require('jsdom')
const { SlotRegistry } = await import(pathToFileURL(`${checkout}/packages/client/ui-renderer/src/client/registry.ts`))
const { createWebConnectionRpc } = await import(pathToFileURL(`${checkout}/packages/client/connection/src/client/rpc.ts`))
const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

async function bench(t, respond) {
  const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: 'http://127.0.0.1:3080/' })
  const previous = { window: globalThis.window, document: globalThis.document, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT }
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
  const ctx = new Context()
  const root = createRoot(document.getElementById('app'))
  t.after(async () => {
    await act(() => root.unmount())
    await ctx.fiber.dispose()
    dom.window.close()
    Object.assign(globalThis, previous)
  })
  await ctx.plugin(SlotRegistry)
  const requests = []
  ctx.provide('connection', { rpc: createWebConnectionRpc(async (url, init) => {
    const message = JSON.parse(init.body)
    requests.push({ url, init, message })
    return respond(message)
  }) })
  ctx.provide('remote', { session: { openWorkspacePath() { throw new Error('must not enter preview interception') } } })
  let row
  vm.runInNewContext(source, { window: { __ModuleLoader__: { load(value) { row = value } } }, Error })
  assert.equal(row.id, 'dsh-workspace-open')
  const plugin = row.factory(name => { assert.equal(name, 'react'); return React })
  const fiber = await ctx.plugin(plugin)
  // Plugin arrives before the host declaration; slots.inject must wait.
  const declare = () => ctx.slots.register({
    name: 'root',
    children: { 'conversation.session.header.actions': { kind: 'list', scope: 'session' } },
  }, () => null)
  let remove = declare()
  const entries = () => ctx.slots.entries('conversation.session.header.actions')
  assert.equal(entries().length, 1)
  remove()
  remove = declare()
  assert.equal(entries().length, 1, 'declaration collapse/remount does not duplicate the button')
  const entry = entries()[0]
  const render = async (sessionId, byId) => {
    await act(() => root.render(React.createElement(entry.component, {
      sessionId, useSessions: selector => selector({ byId }), ...entry.inject(),
    })))
  }
  await render('selected', { selected: { cwd: '/workspace/selected' }, other: { cwd: '/wrong' } })
  const click = async () => {
    await act(async () => { document.querySelector('button').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  }
  return { ctx, fiber, requests, click, render, entries }
}

function envelope(message, result) {
  return Response.json({ type: 'server-response', rpcId: message.rpcId, result })
}

test('real rc.2 SlotRegistry, React and Connection RPC preserve native selected-cwd opening', async t => {
  const h = await bench(t, message => envelope(message, { ok: true, value: { opened: true } }))
  assert.equal(document.querySelector('button').title, '/workspace/selected')
  await h.click()
  assert.equal(h.requests.length, 1)
  const { url, init, message } = h.requests[0]
  assert.equal(url, 'api/session/openWorkspacePath')
  assert.equal(init.method, 'POST')
  assert.equal(init.credentials, undefined, 'same-origin browser credential defaults are retained')
  assert.equal(message.type, 'client-request')
  assert.equal(typeof message.rpcId, 'string')
  assert.deepEqual(message.payload, { args: { request: { path: '/workspace/selected' } } })
  await h.render('missing', {})
  assert.equal(document.querySelector('button'), null)
  await h.fiber.dispose()
  assert.equal(h.entries().length, 0)
})

for (const failure of ['business', 'unauthorized', 'correlation']) {
  test(`real Connection ${failure} failures remain visible without preview fallback`, async t => {
    const h = await bench(t, message => {
      if (failure === 'unauthorized') return new Response('unauthorized', { status: 401 })
      if (failure === 'correlation') return envelope({ rpcId: 'wrong' }, { ok: true, value: {} })
      return envelope(message, { ok: false, error: { code: 'gateway/internal', message: 'desktop unavailable', details: {} } })
    })
    await h.click()
    assert.match(document.querySelector('button').textContent, /打开失败:/)
    assert.match(document.querySelector('button').textContent,
      failure === 'business' ? /desktop unavailable/ : failure === 'unauthorized' ? /HTTP 401/ : /rpcId mismatch/)
    assert.equal(h.requests.length, 1)
    assert.equal(document.querySelector('button').disabled, false)
  })
}
