/**
 * dsh-session-hard-delete — host half.
 *
 * Registers one loopback-only POST route, `/api/session/hard-delete`, that
 * permanently deletes a session's persisted log directory. Unlike the shipped
 * "archive" verb (a hide flag in workspace.json), this removes the on-disk
 * `session.jsonl.zstd` so storage is actually reclaimed.
 *
 * Guards:
 * - loopback-only (same-origin browser request from 127.0.0.1);
 * - a running agent (ctx.agents) refuses deletion;
 * - the session is archived first so the UI list drops it, then the directory
 *   is removed.
 */
import { rm } from 'node:fs/promises'
import { dirname } from 'node:path'

const name = 'dsh-session-hard-delete'
const inject = ['webServer']

function isIPv4Loopback(v4) {
  const parts = v4.split('.')
  return parts.length === 4 && parts[0] === '127' && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)
}

function isLoopbackAddress(address) {
  if (address === undefined) return false
  const normalized = address.toLowerCase()
  if (normalized === '::1') return true
  if (normalized.startsWith('::ffff:')) return isIPv4Loopback(normalized.slice(7))
  return isIPv4Loopback(normalized)
}

function isLoopbackHostname(hostname) {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  return isIPv4Loopback(hostname)
}

function isLoopbackRequest(request) {
  if (!isLoopbackAddress(request.socket.remoteAddress)) return false
  const host = request.headers.host
  if (typeof host !== 'string') return false
  let hostUrl
  try {
    hostUrl = new URL('http://' + host)
  } catch {
    return false
  }
  if (!isLoopbackHostname(hostUrl.hostname)) return false
  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = request.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 64 * 1024) {
        reject(new Error('body-too-large'))
        queueMicrotask(() => req.destroy())
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('invalid-json'))
      }
    })
    req.on('error', reject)
  })
}

export function apply(ctx) {
  async function hardDelete(sessionId) {
    if (typeof sessionId !== 'string' || sessionId === '') throw new Error('无效的会话 id')

    // Refuse when the session's agent is currently running.
    const agents = ctx.get('agents')
    const agent = agents !== undefined && typeof agents.get === 'function' ? agents.get(sessionId) : undefined
    if (agent !== undefined && agent.status === 'running') {
      throw new Error('会话正在运行，无法删除')
    }

    // Locate the persisted log directory through the persistence service.
    const persistence = ctx.get('sessionPersistence')
    if (persistence === undefined || typeof persistence.list !== 'function' || typeof persistence.locate !== 'function') {
      throw new Error('sessionPersistence 不可用')
    }
    const headers = await persistence.list()
    const meta = headers.find((h) => h.id === sessionId)
    if (meta === undefined) throw new Error('找不到该会话')
    const location = persistence.locate(meta)
    if (location === undefined || typeof location.path !== 'string') throw new Error('无法定位会话文件')
    const sessionDir = dirname(location.path)

    // Hide it from the list first (best-effort; the file removal is the point).
    const workspaceRegistry = ctx.get('workspaceRegistry')
    if (workspaceRegistry !== undefined && typeof workspaceRegistry.archiveSession === 'function') {
      try {
        await workspaceRegistry.archiveSession(sessionId)
      } catch {
        // The session may be unindexed; deletion still proceeds.
      }
    }

    // Remove the whole session directory (session.jsonl.zstd + any siblings).
    await rm(sessionDir, { recursive: true, force: true })

    return { ok: true, sessionId }
  }

  ctx.effect(() => {
    const dispose = ctx.webServer.register({
      kind: 'exact',
      path: '/api/session/hard-delete',
      handler: (req, res) => {
        if (!isLoopbackRequest(req)) {
          json(res, 403, { ok: false, error: 'forbidden: loopback-only' })
          return
        }
        if (req.method !== 'POST') {
          json(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        readJsonBody(req).then(
          (body) => {
            const sessionId = body !== null && typeof body === 'object' ? body.sessionId : undefined
            hardDelete(sessionId).then(
              (value) => json(res, 200, value),
              (error) => json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) }),
            )
          },
          (error) => json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) }),
        )
      },
    })
    return () => dispose()
  }, 'dsh-session-hard-delete: route')
}

export { inject, name }
