import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

// Only MCP handshake/catalog. No tools/call, authentication, model, or Codex process.
test('upstream stdlib Codex bridge advertises its initial and continuation tools offline', () => {
  const bridge = fileURLToPath(new URL('../mcp-servers/codex-exec/server.py', import.meta.url))
  const input = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'aris-offline-test', version: '1' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
  ].map(value => JSON.stringify(value)).join('\n') + '\n'
  const root = fileURLToPath(new URL('../../test-work/', import.meta.url))
  const result = spawnSync('python3', ['-B', bridge], {
    input, encoding: 'utf8', timeout: 10000,
    env: { PATH: process.env.PATH, HOME: root, CODEX_HOME: `${root}/codex-home`, CODEX_EXEC_STATE_DIR: `${root}/codex-state`, CODEX_BIN: '/nonexistent/do-not-call-codex' },
  })
  assert.equal(result.status, 0, result.stderr)
  const messages = result.stdout.trim().split('\n').map(line => JSON.parse(line))
  assert.equal(messages.find(message => message.id === 1).result.serverInfo.name, 'codex-exec')
  const tools = messages.find(message => message.id === 2).result.tools
  assert.deepEqual(tools.map(tool => tool.name), ['codex', 'codex-reply'])
  const initial = tools[0].inputSchema.properties
  assert.ok(initial.prompt)
  assert.ok(initial.model)
  assert.ok(initial.config)
  assert.equal(initial['approval-policy'], undefined)
  assert.ok(tools[1].inputSchema.properties.threadId)
})
