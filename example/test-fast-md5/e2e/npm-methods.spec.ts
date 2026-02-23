import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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

const currentFile = fileURLToPath(import.meta.url)
const currentDir = dirname(currentFile)
const manifestPath = resolve(currentDir, '../public/test-files/manifest.json')
const fixtureManifest = JSON.parse(
  readFileSync(manifestPath, 'utf8')
) as FixtureManifest

test.describe('fast-md5-web npm package e2e', () => {
  test('Md5Calculator hashes fixture files with expected 32/16 lengths', async ({
    page,
  }) => {
    await page.goto('/')

    const fixtureNames = ['empty.bin', 'small-text.txt', 'small-pattern.bin']
    const browserHashes = await page.evaluate(async names => {
      const sdk = window.__FAST_MD5_WEB__
      if (!sdk) {
        throw new Error('window.__FAST_MD5_WEB__ is not available')
      }

      const { WasmInit, Md5Calculator } = sdk
      await WasmInit()

      const calculator = new Md5Calculator()
      const results: Record<string, { md5_32: string; md5_16: string }> = {}

      for (const name of names) {
        const response = await fetch(`/test-files/${name}`)
        if (!response.ok) {
          throw new Error(`Failed to fetch fixture: ${name}`)
        }

        const bytes = new Uint8Array(await response.arrayBuffer())
        results[name] = {
          md5_32: await calculator.calculate_md5_async(bytes, 32),
          md5_16: await calculator.calculate_md5_async(bytes, 16),
        }
      }

      return results
    }, fixtureNames)

    for (const fileName of fixtureNames) {
      const expected = fixtureManifest.files[fileName]
      expect(browserHashes[fileName].md5_32).toBe(expected.md5_32)
      expect(browserHashes[fileName].md5_16).toBe(expected.md5_16)
    }
  })

  test('Md5CalculatorPool supports small/large files and batch hashing', async ({
    page,
  }) => {
    await page.goto('/')

    const poolResult = await page.evaluate(async () => {
      const sdk = window.__FAST_MD5_WEB__
      if (!sdk) {
        throw new Error('window.__FAST_MD5_WEB__ is not available')
      }

      const { WasmInit, Md5CalculatorPool } = sdk
      await WasmInit()

      const sharedArrayBufferSupported =
        typeof SharedArrayBuffer !== 'undefined'
      const pool = new Md5CalculatorPool(
        1,
        {
          enabled: true,
          memorySize: 128 * 1024 * 1024,
          chunkSize: 2 * 1024 * 1024,
        },
        1
      )

      const fetchFixture = async (name: string): Promise<Uint8Array> => {
        const response = await fetch(`/test-files/${name}`)
        if (!response.ok) {
          throw new Error(`Failed to fetch fixture: ${name}`)
        }
        return new Uint8Array(await response.arrayBuffer())
      }

      const smallBytes = await fetchFixture('small-pattern.bin')
      const largeBytes = await fetchFixture('large-pattern.bin')
      const largeFile = new File([largeBytes], 'large-pattern.bin', {
        type: 'application/octet-stream',
      })

      const progressHistory: number[] = []
      const batchProgress: Array<{ completed: number; total: number }> = []

      const smallSingle = await pool.calculateMd5(smallBytes, 32, 120000)
      const largeSingle = await pool.calculateMd5(
        largeFile,
        32,
        120000,
        progress => {
          progressHistory.push(progress)
        },
        1
      )
      const largeBatch = await pool.calculateMd5Batch(
        [largeFile, largeFile],
        32,
        120000,
        (completed, total) => {
          batchProgress.push({ completed, total })
        }
      )
      const status = pool.getPoolStatus()
      pool.destroy()

      return {
        sharedArrayBufferSupported,
        smallSingle,
        largeSingle,
        largeBatch,
        progressHistory,
        batchProgress,
        status,
      }
    })

    expect(poolResult.smallSingle).toBe(fixtureManifest.files['small-pattern.bin'].md5_32)
    expect(poolResult.largeSingle).toBe(fixtureManifest.files['large-pattern.bin'].md5_32)
    expect(poolResult.largeBatch).toEqual([
      fixtureManifest.files['large-pattern.bin'].md5_32,
      fixtureManifest.files['large-pattern.bin'].md5_32,
    ])

    if (poolResult.sharedArrayBufferSupported) {
      expect(poolResult.progressHistory.length).toBeGreaterThan(1)
      expect(poolResult.progressHistory.at(-1)).toBe(100)
      expect(
        poolResult.progressHistory.every(
          (value: number, index: number, arr: number[]) =>
            index === 0 || value >= arr[index - 1]
        )
      ).toBe(true)
    } else {
      expect(poolResult.progressHistory.length).toBeGreaterThanOrEqual(0)
    }

    expect(poolResult.batchProgress.at(-1)).toEqual({ completed: 2, total: 2 })
    expect(poolResult.status.activeTasks).toBe(0)
    expect(poolResult.status.pendingTasks).toBe(0)
  })
})
