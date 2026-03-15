import { type ChildProcess, spawn } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = 4173
const BASE_URL = `http://127.0.0.1:${PORT}`

let server: ChildProcess | undefined

async function isServerRunning(): Promise<boolean> {
  try {
    const res = await fetch(BASE_URL)
    return res.ok
  } catch {
    return false
  }
}

export async function setup() {
  if (await isServerRunning()) return

  const projectRoot = dirname(fileURLToPath(import.meta.url)) + '/..'

  server = spawn('pnpm', ['dev', '--host', '127.0.0.1', '--port', String(PORT)], {
    cwd: projectRoot,
    stdio: 'pipe',
  })

  const timeout = 120_000
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await isServerRunning()) return
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error(`Dev server did not start within ${timeout}ms`)
}

export async function teardown() {
  server?.kill()
}
