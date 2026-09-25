import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, cp, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
const root = fileURLToPath(new URL('./', import.meta.url))
const integrity = 'odAf6gJXYLo4TQAboMeo7SsH8SkCTM5at5rN2JLBQmtfxu+r1uQrCqRQyBSWEIXqrH0CCqX3wDcK5z5Fo7Sg6w=='
const archive = `${root}upstream-0.4.2.tgz`
let bytes
try { bytes = await readFile(archive) } catch (error) {
  if (error.code !== 'ENOENT') throw error
  const response = await fetch('https://registry.npmjs.org/@linxin666/dsh-liangshen/-/dsh-liangshen-0.4.2.tgz')
  if (!response.ok) throw new Error(`npm archive HTTP ${response.status}`)
  bytes = Buffer.from(await response.arrayBuffer())
  if (createHash('sha512').update(bytes).digest('base64') !== integrity) throw new Error('npm archive integrity mismatch')
  await writeFile(archive, bytes, { flag: 'wx' })
}
if (createHash('sha512').update(bytes).digest('base64') !== integrity) throw new Error('npm archive integrity mismatch')
for (const dir of ['upstream', 'patched']) {
  try { await access(`${root}${dir}/package.json`); throw new Error(`${dir} already exists; use a fresh maintenance directory`) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  await mkdir(`${root}${dir}`, { recursive: true })
}
execFileSync('tar', ['-xzf', archive, '--strip-components=1', '-C', `${root}upstream`])
await cp(`${root}upstream`, `${root}patched`, { recursive: true })
execFileSync('git', ['apply', '--check', `${root}linxin666__dsh-liangshen@0.4.2.patch`], { cwd: `${root}patched` })
execFileSync('git', ['apply', `${root}linxin666__dsh-liangshen@0.4.2.patch`], { cwd: `${root}patched` })
console.log('Prepared integrity-checked npm 0.4.2 original and patched copies; no profile writes.')
