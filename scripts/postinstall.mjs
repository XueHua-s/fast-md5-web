import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const exampleDir = resolve(rootDir, 'example/test-fast-md5')

if (process.env.FAST_MD5_WEB_SKIP_EXAMPLE_INSTALL === '1') {
  console.log(
    '[postinstall] Skipping example dependency install (FAST_MD5_WEB_SKIP_EXAMPLE_INSTALL=1)'
  )
  process.exit(0)
}

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const install = spawnSync(pnpmCommand, ['install'], {
  cwd: exampleDir,
  stdio: 'inherit',
  env: process.env,
})

if (install.status !== 0) {
  process.exit(install.status ?? 1)
}
