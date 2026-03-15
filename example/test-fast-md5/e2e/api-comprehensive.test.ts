/**
 * Comprehensive E2E tests for fast-md5-web using Vitest + Playwright.
 *
 * Each describe block gets a fresh browser page to avoid memory/context
 * issues from large-file operations contaminating later tests.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright'

// ── Fixtures ────────────────────────────────────────────────────────────────

interface FixtureMeta {
  description: string
  size: number
  md5_32: string
  md5_16: string
}

interface FixtureManifest {
  generatedBy: string
  generatedAt: string
  files: Record<string, FixtureMeta>
}

const currentDir = dirname(fileURLToPath(import.meta.url))
const manifestPath = resolve(currentDir, '../public/test-files/manifest.json')
const manifest = JSON.parse(
  readFileSync(manifestPath, 'utf8')
) as FixtureManifest

const BASE_URL = 'http://127.0.0.1:4173'

// ── Browser lifecycle ───────────────────────────────────────────────────────

let browser: Browser
let context: BrowserContext

beforeAll(async () => {
  browser = await chromium.launch({ headless: true })
  context = await browser.newContext()
})

afterAll(async () => {
  await context?.close()
  await browser?.close()
})

/** Create a fresh page and wait for the SDK to load. */
async function freshPage(): Promise<Page> {
  const p = await context.newPage()
  await p.goto(BASE_URL)
  await p.waitForFunction(() => !!window.__FAST_MD5_WEB__)
  return p
}

// ── Tests: Md5Calculator (direct WASM API) ──────────────────────────────────

describe('Md5Calculator direct API', () => {
  let page: Page

  beforeEach(async () => {
    page = await freshPage()
  })
  afterEach(async () => {
    await page?.close()
  })

  it('hashes fixture files with correct 32-char and 16-char results', async () => {
    const fixtureNames = ['empty.bin', 'small-text.txt', 'small-pattern.bin']

    const results = await page.evaluate(async (names) => {
      const sdk = window.__FAST_MD5_WEB__!
      await sdk.WasmInit()
      const calc = new sdk.Md5Calculator()
      const out: Record<string, { md5_32: string; md5_16: string }> = {}

      for (const name of names) {
        const res = await fetch(`/test-files/${name}`)
        const bytes = new Uint8Array(await res.arrayBuffer())
        out[name] = {
          md5_32: await calc.calculate_md5_async(bytes, 32),
          md5_16: await calc.calculate_md5_async(bytes, 16),
        }
      }
      return out
    }, fixtureNames)

    for (const name of fixtureNames) {
      expect(results[name].md5_32).toBe(manifest.files[name].md5_32)
      expect(results[name].md5_16).toBe(manifest.files[name].md5_16)
    }
  })

  it('hashes empty input (0 bytes) correctly', async () => {
    const hash = await page.evaluate(async () => {
      const sdk = window.__FAST_MD5_WEB__!
      await sdk.WasmInit()
      const calc = new sdk.Md5Calculator()
      return calc.calculate_md5_async(new Uint8Array(0), 32)
    })

    expect(hash).toBe(manifest.files['empty.bin'].md5_32)
  })

  it('produces consistent results across multiple calls', async () => {
    const hashes = await page.evaluate(async () => {
      const sdk = window.__FAST_MD5_WEB__!
      await sdk.WasmInit()
      const calc = new sdk.Md5Calculator()
      const bytes = new TextEncoder().encode('consistency-check')
      const results: string[] = []
      for (let i = 0; i < 5; i++) {
        results.push(await calc.calculate_md5_async(bytes, 32))
      }
      return results
    })

    expect(new Set(hashes).size).toBe(1)
  })

  it('handles various md5Length values (8, 16, 32, 64)', async () => {
    const results = await page.evaluate(async () => {
      const sdk = window.__FAST_MD5_WEB__!
      await sdk.WasmInit()
      const calc = new sdk.Md5Calculator()
      const bytes = new TextEncoder().encode('length-test')
      return {
        len8: await calc.calculate_md5_async(bytes, 8),
        len16: await calc.calculate_md5_async(bytes, 16),
        len32: await calc.calculate_md5_async(bytes, 32),
        len64: await calc.calculate_md5_async(bytes, 64),
      }
    })

    expect(results.len8).toHaveLength(8)
    expect(results.len16).toHaveLength(16)
    expect(results.len32).toHaveLength(32)
    // 64 clamped to 32 (max MD5 hex length)
    expect(results.len64).toHaveLength(32)
    // Shorter lengths are prefixes
    expect(results.len32.startsWith(results.len16)).toBe(true)
    expect(results.len16.startsWith(results.len8)).toBe(true)
  })
})

// ── Tests: Pool with small files ────────────────────────────────────────────

describe('Md5CalculatorPool small file operations', () => {
  let page: Page

  beforeEach(async () => {
    page = await freshPage()
  })
  afterEach(async () => {
    await page?.close()
  })

  it('hashes small Uint8Array via pool', async () => {
    const result = await page.evaluate(async () => {
      const sdk = window.__FAST_MD5_WEB__!
      await sdk.WasmInit()
      const pool = new sdk.Md5CalculatorPool(1, undefined, 1)
      try {
        const res = await fetch('/test-files/small-pattern.bin')
        const bytes = new Uint8Array(await res.arrayBuffer())
        return await pool.calculateMd5(bytes, 32, 30000)
      } finally {
        pool.destroy()
      }
    })

    expect(result).toBe(manifest.files['small-pattern.bin'].md5_32)
  })

  it('hashes small Uint8Array with 16-char length', async () => {
    const result = await page.evaluate(async () => {
      const sdk = window.__FAST_MD5_WEB__!
      await sdk.WasmInit()
      const pool = new sdk.Md5CalculatorPool(1, undefined, 1)
      try {
        const res = await fetch('/test-files/small-pattern.bin')
        const bytes = new Uint8Array(await res.arrayBuffer())
        return await pool.calculateMd5(bytes, 16, 30000)
      } finally {
        pool.destroy()
      }
    })

    expect(result).toBe(manifest.files['small-pattern.bin'].md5_16)
  })

  it('hashes empty data via pool', async () => {
    const result = await page.evaluate(async () => {
      const sdk = window.__FAST_MD5_WEB__!
      await sdk.WasmInit()
      const pool = new sdk.Md5CalculatorPool(1, undefined, 1)
      try {
        return await pool.calculateMd5(new Uint8Array(0), 32, 30000)
      } finally {
        pool.destroy()
      }
    })

    expect(result).toBe(manifest.files['empty.bin'].md5_32)
  })

  it('hashes File object (small)', async () => {
    const result = await page.evaluate(async () => {
      const sdk = window.__FAST_MD5_WEB__!
      await sdk.WasmInit()
      const pool = new sdk.Md5CalculatorPool(1, undefined, 1)
      try {
        const res = await fetch('/test-files/small-text.txt')
        const blob = await res.blob()
        const file = new File([blob], 'small-text.txt')
        return await pool.calculateMd5(file, 32, 30000)
      } finally {
        pool.destroy()
      }
    })

    expect(result).toBe(manifest.files['small-text.txt'].md5_32)
  })

  it('batch hashing returns correctly ordered results', async () => {
    const result = await page.evaluate(async () => {
      const sdk = window.__FAST_MD5_WEB__!
      await sdk.WasmInit()
      const pool = new sdk.Md5CalculatorPool(2, undefined, 2)
      try {
        const fetchBytes = async (name: string) => {
          const res = await fetch(`/test-files/${name}`)
          return new Uint8Array(await res.arrayBuffer())
        }

        const small = await fetchBytes('small-pattern.bin')
        const text = await fetchBytes('small-text.txt')
        const empty = await fetchBytes('empty.bin')
        const batchProgress: Array<{ completed: number; total: number }> = []

        const hashes = await pool.calculateMd5Batch(
          [small, text, empty],
          32,
          60000,
          (completed, total) => batchProgress.push({ completed, total })
        )

        return { hashes, batchProgress }
      } finally {
        pool.destroy()
      }
    })

    expect(result.hashes).toEqual([
      manifest.files['small-pattern.bin'].md5_32,
      manifest.files['small-text.txt'].md5_32,
      manifest.files['empty.bin'].md5_32,
    ])
    expect(result.batchProgress.at(-1)).toEqual({ completed: 3, total: 3 })
  })

  it('concurrent hashing with separate copies produces correct results', async () => {
    const result = await page.evaluate(async () => {
      const sdk = window.__FAST_MD5_WEB__!
      await sdk.WasmInit()
      // 2 workers, 2 max concurrent — tasks 3-4 queue and get dispatched after 1-2 finish
      const pool = new sdk.Md5CalculatorPool(2, undefined, 2)
      try {
        const fetchBytes = async (name: string) => {
          const res = await fetch(`/test-files/${name}`)
          return new Uint8Array(await res.arrayBuffer())
        }

        // Each calculateMd5 call transfers the ArrayBuffer, so each needs its own copy
        const [s1, s2] = await Promise.all([
          fetchBytes('small-pattern.bin'),
          fetchBytes('small-pattern.bin'),
        ])
        const [t1, t2] = await Promise.all([
          fetchBytes('small-text.txt'),
          fetchBytes('small-text.txt'),
        ])

        const promises = [
          pool.calculateMd5(s1, 32, 60000),
          pool.calculateMd5(t1, 32, 60000),
          pool.calculateMd5(s2, 16, 60000),
          pool.calculateMd5(t2, 16, 60000),
        ]

        // Must await here — returning the promise directly would let
        // finally { pool.destroy() } run before promises resolve.
        const results = await Promise.all(promises)
        return results
      } finally {
        pool.destroy()
      }
    })

    expect(result[0]).toBe(manifest.files['small-pattern.bin'].md5_32)
    expect(result[1]).toBe(manifest.files['small-text.txt'].md5_32)
    expect(result[2]).toBe(manifest.files['small-pattern.bin'].md5_16)
    expect(result[3]).toBe(manifest.files['small-text.txt'].md5_16)
  })
})

// ── Tests: Pool with large files ────────────────────────────────────────────

describe('Md5CalculatorPool large file operations', () => {
  let page: Page

  beforeEach(async () => {
    page = await freshPage()
  })
  afterEach(async () => {
    await page?.close()
  })

  it('hashes large file with shared memory and emits monotonic progress', async () => {
    const result = await page.evaluate(async () => {
      const sdk = window.__FAST_MD5_WEB__!
      await sdk.WasmInit()
      const pool = new sdk.Md5CalculatorPool(
        1,
        { enabled: true, memorySize: 128 * 1024 * 1024, chunkSize: 2 * 1024 * 1024 },
        1
      )
      try {
        const res = await fetch('/test-files/large-pattern.bin')
        const blob = await res.blob()
        const file = new File([blob], 'large-pattern.bin', { type: 'application/octet-stream' })
        const progress: number[] = []

        const hash = await pool.calculateMd5(file, 32, 300000, (p) => {
          progress.push(p)
        })

        return { hash, progress }
      } finally {
        pool.destroy()
      }
    })

    expect(result.hash).toBe(manifest.files['large-pattern.bin'].md5_32)
    expect(result.progress.length).toBeGreaterThan(0)
    expect(result.progress.at(-1)).toBe(100)
    for (let i = 1; i < result.progress.length; i++) {
      expect(result.progress[i]).toBeGreaterThanOrEqual(result.progress[i - 1])
    }
  })

  it('batch hashing with large files', async () => {
    const result = await page.evaluate(async () => {
      const sdk = window.__FAST_MD5_WEB__!
      await sdk.WasmInit()
      const pool = new sdk.Md5CalculatorPool(
        1,
        { enabled: true, memorySize: 128 * 1024 * 1024, chunkSize: 2 * 1024 * 1024 },
        1
      )
      try {
        const res = await fetch('/test-files/large-pattern.bin')
        const blob = await res.blob()
        const file1 = new File([blob], 'large-1.bin', { type: 'application/octet-stream' })
        const file2 = new File([blob], 'large-2.bin', { type: 'application/octet-stream' })
        const batchProgress: Array<{ completed: number; total: number }> = []

        const hashes = await pool.calculateMd5Batch(
          [file1, file2],
          32,
          600000,
          (completed, total) => batchProgress.push({ completed, total })
        )

        return { hashes, batchProgress }
      } finally {
        pool.destroy()
      }
    })

    const expectedHash = manifest.files['large-pattern.bin'].md5_32
    expect(result.hashes).toEqual([expectedHash, expectedHash])
    expect(result.batchProgress.at(-1)).toEqual({ completed: 2, total: 2 })
  })
})

// ── Tests: Pool status & lifecycle ──────────────────────────────────────────

describe('Pool status and lifecycle', () => {
  let page: Page

  beforeEach(async () => {
    page = await freshPage()
  })
  afterEach(async () => {
    await page?.close()
  })

  it('getPoolStatus reports correct initial state', async () => {
    const status = await page.evaluate(async () => {
      const sdk = window.__FAST_MD5_WEB__!
      await sdk.WasmInit()
      const pool = new sdk.Md5CalculatorPool(3, undefined, 3)
      try {
        return pool.getPoolStatus()
      } finally {
        pool.destroy()
      }
    })

    expect(status.totalWorkers).toBe(3)
    expect(status.availableWorkers).toBe(3)
    expect(status.pendingTasks).toBe(0)
    expect(status.activeTasks).toBe(0)
    expect(status.maxConcurrentTasks).toBe(3)
    expect(status.sharedMemoryEnabled).toBe(false)
  })

  it('getPoolStatus includes shared memory usage when enabled', async () => {
    const status = await page.evaluate(async () => {
      const sdk = window.__FAST_MD5_WEB__!
      await sdk.WasmInit()
      const pool = new sdk.Md5CalculatorPool(
        2,
        { enabled: true, memorySize: 64 * 1024 * 1024, chunkSize: 2 * 1024 * 1024 },
        2
      )
      try {
        return pool.getPoolStatus()
      } finally {
        pool.destroy()
      }
    })

    expect(status.sharedMemoryEnabled).toBe(true)
    expect(status.sharedMemoryUsage).toBeDefined()
    expect(status.sharedMemoryUsage!.total).toBe(64 * 1024 * 1024)
    expect(status.sharedMemoryUsage!.used).toBe(0)
  })

  it('pool status shows zero active tasks after all work completes', async () => {
    const status = await page.evaluate(async () => {
      const sdk = window.__FAST_MD5_WEB__!
      await sdk.WasmInit()
      const pool = new sdk.Md5CalculatorPool(2, undefined, 2)
      try {
        const bytes1 = new TextEncoder().encode('status-check')
        const bytes2 = new TextEncoder().encode('status-check')
        await pool.calculateMd5(bytes1, 32, 10000)
        await pool.calculateMd5(bytes2, 32, 10000)
        return pool.getPoolStatus()
      } finally {
        pool.destroy()
      }
    })

    expect(status.activeTasks).toBe(0)
    expect(status.pendingTasks).toBe(0)
  })

  it('destroy cleans up pool resources', async () => {
    const status = await page.evaluate(async () => {
      const sdk = window.__FAST_MD5_WEB__!
      await sdk.WasmInit()
      const pool = new sdk.Md5CalculatorPool(2, undefined, 2)
      pool.destroy()
      return pool.getPoolStatus()
    })

    expect(status.totalWorkers).toBe(0)
    expect(status.availableWorkers).toBe(0)
  })

  it('multiple pool instances work independently', async () => {
    const result = await page.evaluate(async () => {
      const sdk = window.__FAST_MD5_WEB__!
      await sdk.WasmInit()
      const pool1 = new sdk.Md5CalculatorPool(1, undefined, 1)
      const pool2 = new sdk.Md5CalculatorPool(1, undefined, 1)
      try {
        const bytes1 = new TextEncoder().encode('multi-pool')
        const bytes2 = new TextEncoder().encode('multi-pool')
        const [h1, h2] = await Promise.all([
          pool1.calculateMd5(bytes1, 32, 10000),
          pool2.calculateMd5(bytes2, 32, 10000),
        ])
        return { h1, h2 }
      } finally {
        pool1.destroy()
        pool2.destroy()
      }
    })

    expect(result.h1).toBe(result.h2)
    expect(result.h1).toHaveLength(32)
  })
})

// ── Tests: SharedArrayBuffer detection ──────────────────────────────────────

describe('SharedArrayBuffer support', () => {
  let page: Page

  beforeEach(async () => {
    page = await freshPage()
  })
  afterEach(async () => {
    await page?.close()
  })

  it('detects SharedArrayBuffer availability correctly', async () => {
    const result = await page.evaluate(() => {
      return typeof SharedArrayBuffer !== 'undefined'
    })
    expect(result).toBe(true)
  })

  it('pool works without shared memory (disabled)', async () => {
    const hash = await page.evaluate(async () => {
      const sdk = window.__FAST_MD5_WEB__!
      await sdk.WasmInit()
      const pool = new sdk.Md5CalculatorPool(
        1,
        { enabled: false, memorySize: 0, chunkSize: 8 * 1024 * 1024 },
        1
      )
      try {
        const res = await fetch('/test-files/small-pattern.bin')
        const bytes = new Uint8Array(await res.arrayBuffer())
        return await pool.calculateMd5(bytes, 32, 30000)
      } finally {
        pool.destroy()
      }
    })

    expect(hash).toBe(manifest.files['small-pattern.bin'].md5_32)
  })
})

// ── Tests: Error handling & edge cases ───────────────────────────────────────

describe('Error handling and edge cases', () => {
  let page: Page

  beforeEach(async () => {
    page = await freshPage()
  })
  afterEach(async () => {
    await page?.close()
  })

  it('handles timeout correctly', async () => {
    const result = await page.evaluate(async () => {
      const sdk = window.__FAST_MD5_WEB__!
      await sdk.WasmInit()
      const pool = new sdk.Md5CalculatorPool(
        1,
        { enabled: true, memorySize: 128 * 1024 * 1024, chunkSize: 2 * 1024 * 1024 },
        1
      )
      try {
        const res = await fetch('/test-files/large-pattern.bin')
        const blob = await res.blob()
        const file = new File([blob], 'large-pattern.bin', { type: 'application/octet-stream' })

        try {
          await pool.calculateMd5(file, 32, 1)
          return { timedOut: false, error: '' }
        } catch (e) {
          return { timedOut: true, error: (e as Error).message }
        }
      } finally {
        pool.destroy()
      }
    })

    expect(result.timedOut).toBe(true)
    expect(result.error).toContain('timeout')
  })

  it('handles sub-view Uint8Array data', async () => {
    const hash = await page.evaluate(async () => {
      const sdk = window.__FAST_MD5_WEB__!
      await sdk.WasmInit()
      const pool = new sdk.Md5CalculatorPool(1, undefined, 1)
      try {
        const large = new Uint8Array(1024)
        large.fill(0xab)
        const sub = large.subarray(100, 200)
        // Must copy because subarray shares the underlying buffer
        const copy = new Uint8Array(sub)
        return await pool.calculateMd5(copy, 32, 10000)
      } finally {
        pool.destroy()
      }
    })

    expect(hash).toMatch(/^[0-9a-f]{32}$/)
  })

  it('handles single-byte data', async () => {
    const hash = await page.evaluate(async () => {
      const sdk = window.__FAST_MD5_WEB__!
      await sdk.WasmInit()
      const pool = new sdk.Md5CalculatorPool(1, undefined, 1)
      try {
        return await pool.calculateMd5(new Uint8Array([0x42]), 32, 10000)
      } finally {
        pool.destroy()
      }
    })

    expect(hash).toMatch(/^[0-9a-f]{32}$/)
    expect(hash).toHaveLength(32)
  })

  it('pool constructor with default parameters works', async () => {
    const hash = await page.evaluate(async () => {
      const sdk = window.__FAST_MD5_WEB__!
      await sdk.WasmInit()
      const pool = new sdk.Md5CalculatorPool()
      try {
        const bytes = new TextEncoder().encode('defaults')
        return await pool.calculateMd5(bytes, 32, 10000)
      } finally {
        pool.destroy()
      }
    })

    expect(hash).toMatch(/^[0-9a-f]{32}$/)
  })

  it('works in a fresh page context (isolated)', async () => {
    const freshP = await context.newPage()
    try {
      await freshP.goto(BASE_URL)
      await freshP.waitForFunction(() => !!window.__FAST_MD5_WEB__)

      const hash = await freshP.evaluate(async () => {
        const sdk = window.__FAST_MD5_WEB__!
        await sdk.WasmInit()
        const pool = new sdk.Md5CalculatorPool(1, undefined, 1)
        try {
          const bytes = new TextEncoder().encode('fresh-page-test')
          return await pool.calculateMd5(bytes, 32, 10000)
        } finally {
          pool.destroy()
        }
      })

      expect(hash).toMatch(/^[0-9a-f]{32}$/)
    } finally {
      await freshP.close()
    }
  })
})
