import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let uuidCounter = 0

vi.mock('uuid', () => ({
  v4: () => `task-${++uuidCounter}`,
}))

vi.mock('../wasm/pkg', () => ({
  default: vi.fn(async () => undefined),
  Md5Calculator: class MockMd5Calculator {},
}))

import { Md5CalculatorPool } from '../src/index'

type WorkerMessageType =
  | 'calculate'
  | 'calculate_chunk'
  | 'result'
  | 'error'
  | 'init_shared_memory'
  | 'progress'

interface WorkerMessageData {
  fileData?: ArrayBuffer
  chunkData?: ArrayBuffer
  chunkIndex?: number
  totalChunks?: number
  md5Length?: number
  result?: string
  error?: string
  sharedMemory?: SharedArrayBuffer
  dataOffset?: number
  dataLength?: number
  progress?: number
  isStreamMode?: boolean
}

interface WorkerMessage {
  id: string
  type: WorkerMessageType
  data?: WorkerMessageData
}

interface StreamState {
  hasher: ReturnType<typeof createHash>
  processedChunks: number
  totalChunks: number
  md5Length: number
}

function md5Hex(input: Uint8Array, md5Length: number = 32): string {
  const full = createHash('md5').update(input).digest('hex')
  return full.slice(0, Math.min(md5Length, full.length))
}

function createPatternedBytes(length: number, seed: number): Uint8Array {
  const buffer = new Uint8Array(length)
  let value = seed >>> 0

  for (let i = 0; i < length; i++) {
    value = (value * 1664525 + 1013904223) >>> 0
    buffer[i] = value & 0xff
  }

  return buffer
}

class MockWorker {
  static responseDelayMs = 0

  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null

  private isTerminated = false
  private sharedMemoryView: Uint8Array | null = null
  private streamStates = new Map<string, StreamState>()

  constructor(_url: URL, _options?: WorkerOptions) {}

  postMessage(message: WorkerMessage): void {
    const run = () => {
      if (this.isTerminated) {
        return
      }

      try {
        this.handleMessage(message)
      } catch (error) {
        this.emitError(error as Error)
      }
    }

    if (MockWorker.responseDelayMs > 0) {
      setTimeout(run, MockWorker.responseDelayMs)
      return
    }

    queueMicrotask(run)
  }

  terminate(): void {
    this.isTerminated = true
    this.streamStates.clear()
    this.sharedMemoryView = null
  }

  private handleMessage(message: WorkerMessage): void {
    const { id, type, data } = message

    if (type === 'init_shared_memory') {
      if (data?.sharedMemory) {
        this.sharedMemoryView = new Uint8Array(data.sharedMemory)
      }
      return
    }

    if (type === 'calculate') {
      if (data?.isStreamMode) {
        this.streamStates.set(id, {
          hasher: createHash('md5'),
          processedChunks: 0,
          totalChunks: data.totalChunks ?? 1,
          md5Length: data.md5Length ?? 32,
        })
        return
      }

      const payload = this.readPayload(data)
      const result = md5Hex(payload, data?.md5Length ?? 32)
      this.emitMessage({
        id,
        type: 'result',
        data: { result },
      })
      return
    }

    if (type === 'calculate_chunk') {
      const state = this.streamStates.get(id)
      if (!state) {
        throw new Error(`Stream state not found: ${id}`)
      }

      const payload = this.readPayload(data)
      state.hasher.update(payload)
      state.processedChunks += 1

      const progress = (state.processedChunks / state.totalChunks) * 100
      this.emitMessage({
        id,
        type: 'progress',
        data: { progress },
      })

      if (state.processedChunks >= state.totalChunks) {
        const result = state.hasher.digest('hex').slice(0, state.md5Length)
        this.streamStates.delete(id)
        this.emitMessage({
          id,
          type: 'result',
          data: { result },
        })
      }
    }
  }

  private readPayload(data?: WorkerMessageData): Uint8Array {
    if (
      data?.dataOffset !== undefined &&
      data.dataLength !== undefined &&
      this.sharedMemoryView
    ) {
      return this.sharedMemoryView.slice(
        data.dataOffset,
        data.dataOffset + data.dataLength
      )
    }

    if (data?.fileData) {
      return new Uint8Array(data.fileData)
    }

    if (data?.chunkData) {
      return new Uint8Array(data.chunkData)
    }

    throw new Error('No payload data provided')
  }

  private emitMessage(message: WorkerMessage): void {
    if (!this.onmessage) {
      return
    }

    this.onmessage({ data: message } as MessageEvent<WorkerMessage>)
  }

  private emitError(error: Error): void {
    if (!this.onerror) {
      return
    }

    this.onerror({ message: error.message } as ErrorEvent)
  }
}

const originalWorkerDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'Worker'
)
const originalHardwareConcurrencyDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  'hardwareConcurrency'
)

const activePools: Md5CalculatorPool[] = []

function createPool(
  poolSize: number = 4,
  sharedMemoryConfig?: {
    enabled: boolean
    memorySize: number
    chunkSize: number
  },
  maxConcurrentTasks?: number
): Md5CalculatorPool {
  const pool = new Md5CalculatorPool(poolSize, sharedMemoryConfig, maxConcurrentTasks)
  activePools.push(pool)
  return pool
}

beforeEach(() => {
  uuidCounter = 0
  MockWorker.responseDelayMs = 0

  Object.defineProperty(navigator, 'hardwareConcurrency', {
    configurable: true,
    value: 8,
  })
  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    writable: true,
    value: MockWorker as unknown as typeof Worker,
  })
})

afterEach(() => {
  while (activePools.length > 0) {
    activePools.pop()!.destroy()
  }

  if (originalWorkerDescriptor) {
    Object.defineProperty(globalThis, 'Worker', originalWorkerDescriptor)
  } else {
    Reflect.deleteProperty(globalThis, 'Worker')
  }

  if (originalHardwareConcurrencyDescriptor) {
    Object.defineProperty(
      navigator,
      'hardwareConcurrency',
      originalHardwareConcurrencyDescriptor
    )
  }
})

describe('Md5CalculatorPool unit tests', () => {
  it('calculates MD5 for Uint8Array payloads including empty data', async () => {
    const pool = createPool(2)
    const payload = new TextEncoder().encode('fast-md5-web-unit-test')

    const hash32 = await pool.calculateMd5(payload, 32, 5000)
    const hash16 = await pool.calculateMd5(payload, 16, 5000)
    const emptyHash = await pool.calculateMd5(new Uint8Array(0), 32, 5000)

    expect(hash32).toBe(md5Hex(payload, 32))
    expect(hash16).toBe(md5Hex(payload, 16))
    expect(emptyHash).toBe(md5Hex(new Uint8Array(0), 32))
  })

  it('calculates MD5 for File payloads', async () => {
    const pool = createPool(2)
    const bytes = createPatternedBytes(256 * 1024, 7)
    const file = new File([bytes], 'small-pattern.bin', {
      type: 'application/octet-stream',
    })

    const hash = await pool.calculateMd5(file, 32, 5000)

    expect(hash).toBe(md5Hex(bytes))
  })

  it('uses shared-memory stream mode for large files and emits progress', async () => {
    const pool = createPool(
      2,
      {
        enabled: true,
        memorySize: 64 * 1024 * 1024,
        chunkSize: 2 * 1024 * 1024,
      },
      2
    )
    const bytes = createPatternedBytes(9 * 1024 * 1024 + 257, 17)
    const file = new File([bytes], 'large-pattern.bin', {
      type: 'application/octet-stream',
    })
    const progressHistory: number[] = []

    const hash = await pool.calculateMd5(file, 32, 30000, progress =>
      progressHistory.push(progress)
    )

    expect(hash).toBe(md5Hex(bytes))
    expect(progressHistory.length).toBeGreaterThan(1)
    expect(progressHistory.at(-1)).toBe(100)
    expect(
      progressHistory.every(
        (value, index) => index === 0 || value >= progressHistory[index - 1]
      )
    ).toBe(true)

    const status = pool.getPoolStatus()
    expect(status.sharedMemoryEnabled).toBe(true)
    expect(status.activeTasks).toBe(0)
    expect(status.pendingTasks).toBe(0)
  })

  it('returns ordered results for calculateMd5Batch and reports completion progress', async () => {
    const pool = createPool(3)
    const first = new TextEncoder().encode('batch-first')
    const second = createPatternedBytes(64 * 1024, 21)
    const thirdBytes = createPatternedBytes(32 * 1024, 33)
    const third = new File([thirdBytes], 'batch-third.bin', {
      type: 'application/octet-stream',
    })
    const progressHistory: Array<{ completed: number; total: number }> = []

    const result = await pool.calculateMd5Batch(
      [first, second, third],
      32,
      10000,
      (completed, total) => {
        progressHistory.push({ completed, total })
      }
    )

    expect(result).toEqual([md5Hex(first), md5Hex(second), md5Hex(thirdBytes)])
    expect(progressHistory).toHaveLength(3)
    expect(progressHistory.at(-1)).toEqual({
      completed: 3,
      total: 3,
    })
  })

  it('rejects when calculation exceeds timeout', async () => {
    MockWorker.responseDelayMs = 80
    const pool = createPool(1)
    const payload = createPatternedBytes(4 * 1024, 99)

    await expect(pool.calculateMd5(payload, 32, 10)).rejects.toThrow(
      'MD5 calculation timeout after 10ms'
    )
  })

  it('can cancel pending tasks deterministically', async () => {
    MockWorker.responseDelayMs = 80
    const pool = createPool(1)
    const first = createPatternedBytes(8 * 1024, 41)
    const second = createPatternedBytes(8 * 1024, 42)

    const firstPromise = pool.calculateMd5(first, 32, 0)
    const secondPromise = pool.calculateMd5(second, 32, 0)

    await vi.waitFor(() => {
      const status = pool.getPoolStatus()
      expect(status.pendingTasks).toBe(1)
    })

    expect(pool.cancelTask('task-2')).toBe(true)
    await expect(secondPromise).rejects.toThrow('Task cancelled')

    const firstHash = await firstPromise
    expect(firstHash).toBe(md5Hex(first))
  })
})
