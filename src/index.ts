import WasmInit, { Md5Calculator } from '../wasm/pkg'
import { v4 as uuidv4 } from 'uuid'
import { SharedMemoryAllocator } from './shared-memory-allocator'
import type { WorkerMessage } from './types'

const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024 // 8MB
const DEFAULT_SHARED_MEMORY_SIZE = 512 * 1024 * 1024 // 512MB
const MAX_CHUNK_RETRIES = 5

interface Task {
  id: string
  data: Uint8Array | File
  md5Length: number
  resolve: (value: string) => void
  reject: (reason: Error | string) => void
  priority: number
  isLargeFile: boolean
  onProgress?: (progress: number) => void
}

/**
 * Pool of Web Workers that compute MD5 hashes via WebAssembly.
 *
 * Accepts Uint8Array or File inputs. Large files (> chunkSize) are
 * streamed chunk-by-chunk through SharedArrayBuffer when available,
 * falling back to ArrayBuffer transfer otherwise. The pool manages
 * worker lifecycle, task scheduling, and resource cleanup internally.
 */
class Md5CalculatorPool {
  private workers: Worker[] = []
  private availableWorkers: Worker[] = []
  private pendingTasks: Task[] = []
  private activeTasks = new Map<string, Task>()
  private taskCallbacks = new Map<
    string,
    {
      resolve: (value: string) => void
      reject: (reason: Error | string) => void
      onProgress?: (progress: number) => void
    }
  >()
  // Track which worker owns which task for targeted error handling
  private workerTaskMap = new Map<Worker, Set<string>>()

  private poolSize: number
  private allocator: SharedMemoryAllocator | null = null
  private sharedMemoryEnabled: boolean
  private chunkSize: number
  private maxConcurrentTasks: number
  private maxConcurrentFileReads: number
  private activeFileReads = new Set<string>()
  private fileReadWaitQueue: Array<{
    taskId: string
    resolve: () => void
  }> = []

  constructor(
    poolSize: number = 4,
    sharedMemoryConfig?: {
      enabled: boolean
      memorySize: number
      chunkSize: number
    },
    maxConcurrentTasks?: number
  ) {
    this.poolSize = poolSize
    this.maxConcurrentTasks = maxConcurrentTasks || poolSize
    this.maxConcurrentFileReads = Math.min(8, navigator.hardwareConcurrency)
    this.chunkSize = sharedMemoryConfig?.chunkSize || DEFAULT_CHUNK_SIZE
    this.sharedMemoryEnabled = false

    if (
      sharedMemoryConfig?.enabled &&
      typeof SharedArrayBuffer !== 'undefined'
    ) {
      const memSize =
        sharedMemoryConfig.memorySize || DEFAULT_SHARED_MEMORY_SIZE
      this.allocator = new SharedMemoryAllocator(memSize)
      if (this.allocator.initialize()) {
        this.sharedMemoryEnabled = true
      } else {
        this.allocator = null
      }
    }

    this.initializeWorkers()
  }

  private initializeWorkers(): void {
    for (let i = 0; i < this.poolSize; i++) {
      const worker = this.createWorker()
      this.workers.push(worker)
      this.availableWorkers.push(worker)

      if (this.sharedMemoryEnabled && this.allocator) {
        worker.postMessage({
          id: `init-${i}`,
          type: 'init_shared_memory',
          data: {
            sharedMemory: this.allocator.getBuffer(),
          },
        } as WorkerMessage)
      }
    }
  }

  private createWorker(): Worker {
    const worker = new Worker(new URL('./md5-worker.js', import.meta.url), {
      type: 'module',
    })
    this.workerTaskMap.set(worker, new Set())

    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const { id, type, data } = e.data

      if (type === 'result' || type === 'error') {
        const callbacks = this.taskCallbacks.get(id)
        const task = this.activeTasks.get(id)

        if (callbacks) {
          this.taskCallbacks.delete(id)
          this.activeTasks.delete(id)
          this.workerTaskMap.get(worker)?.delete(id)

          if (task?.isLargeFile) {
            this.allocator?.release(id)
          }
          this.releaseFileReadSlot(id)

          if (type === 'result') {
            callbacks.resolve(data!.result!)
          } else {
            callbacks.reject(new Error(data!.error!))
          }
        }

        this.availableWorkers.push(worker)
        this.processNextTask()
      } else if (type === 'progress' && data?.progress !== undefined) {
        const callbacks = this.taskCallbacks.get(id)
        if (callbacks?.onProgress) {
          callbacks.onProgress(data.progress)
        }
      }
    }

    worker.onerror = error => {
      console.error('Worker error:', error)

      // Only reject tasks assigned to the failed worker
      const failedTaskIds = this.workerTaskMap.get(worker)
      if (failedTaskIds) {
        for (const taskId of failedTaskIds) {
          const callbacks = this.taskCallbacks.get(taskId)
          if (callbacks) {
            callbacks.reject(
              new Error(
                `Worker error: ${error.message || 'Unknown worker error'}`
              )
            )
            this.taskCallbacks.delete(taskId)
            this.activeTasks.delete(taskId)
            this.allocator?.release(taskId)
            this.releaseFileReadSlot(taskId)
          }
        }
      }

      // Replace the failed worker
      const index = this.workers.indexOf(worker)
      if (index !== -1) {
        const newWorker = this.createWorker()
        this.workers[index] = newWorker

        const availableIndex = this.availableWorkers.indexOf(worker)
        if (availableIndex !== -1) {
          this.availableWorkers[availableIndex] = newWorker
        } else {
          this.availableWorkers.push(newWorker)
        }
      }

      this.workerTaskMap.delete(worker)
      this.processNextTask()
    }

    return worker
  }

  private processNextTask(): void {
    if (this.activeTasks.size >= this.maxConcurrentTasks) return
    if (this.pendingTasks.length === 0 || this.availableWorkers.length === 0)
      return

    // Sort: small files first (lower latency), then by priority descending
    this.pendingTasks.sort((a, b) => {
      if (a.isLargeFile !== b.isLargeFile) return a.isLargeFile ? 1 : -1
      return b.priority - a.priority
    })

    const task = this.pendingTasks.shift()!
    const worker = this.availableWorkers.shift()!

    this.activeTasks.set(task.id, task)
    this.taskCallbacks.set(task.id, {
      resolve: task.resolve,
      reject: task.reject,
      onProgress: task.onProgress,
    })
    this.workerTaskMap.get(worker)?.add(task.id)

    if (task.isLargeFile && task.data instanceof File) {
      this.processLargeFile(task, worker)
    } else {
      this.processSmallFile(task, worker).catch(task.reject)
    }
  }

  private async processLargeFile(task: Task, worker: Worker): Promise<void> {
    const file = task.data as File
    const chunkSize = this.chunkSize
    const totalChunks = Math.ceil(file.size / chunkSize)

    await this.waitForFileReadSlot(task.id)

    try {
      const memoryOffset = this.allocator
        ? this.allocator.allocate(chunkSize, task.id)
        : -1

      if (memoryOffset === -1) {
        // Shared memory unavailable — fall back to reading entire file
        const uint8Array = new Uint8Array(await file.arrayBuffer())
        await this.processSmallFile({ ...task, data: uint8Array }, worker)
        return
      }

      worker.postMessage({
        id: task.id,
        type: 'calculate',
        data: {
          dataOffset: memoryOffset,
          dataLength: file.size,
          md5Length: task.md5Length,
          isStreamMode: true,
          totalChunks,
        },
      } as WorkerMessage)

      const sharedView = this.allocator!.getView()!

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize
        const end = Math.min(start + chunkSize, file.size)

        let chunkData: Uint8Array | null = null
        let retries = 0

        while (chunkData === null) {
          try {
            const chunk = file.slice(start, end)
            chunkData = new Uint8Array(await chunk.arrayBuffer())
          } catch (error) {
            if (
              error instanceof Error &&
              error.name === 'NotReadableError' &&
              retries < MAX_CHUNK_RETRIES
            ) {
              retries++
              continue
            }
            throw error
          }
        }

        sharedView.set(chunkData, memoryOffset)

        worker.postMessage({
          id: task.id,
          type: 'calculate_chunk',
          data: {
            chunkIndex: i,
            dataLength: chunkData.length,
            dataOffset: memoryOffset,
          },
        } as WorkerMessage)

        // Yield to avoid blocking the UI thread
        await new Promise(resolve => Promise.resolve().then(resolve))
      }
    } finally {
      this.releaseFileReadSlot(task.id)
    }
  }

  private async processSmallFile(task: Task, worker: Worker): Promise<void> {
    let data: Uint8Array

    if (task.data instanceof File) {
      await this.waitForFileReadSlot(task.id)
      try {
        let retries = 0
        while (true) {
          try {
            const arrayBuffer = await task.data.arrayBuffer()
            data = new Uint8Array(arrayBuffer)
            break
          } catch (error) {
            if (
              error instanceof Error &&
              error.name === 'NotReadableError' &&
              retries < MAX_CHUNK_RETRIES
            ) {
              retries++
              continue
            }
            throw error
          }
        }
      } finally {
        this.releaseFileReadSlot(task.id)
      }
    } else {
      data = task.data as Uint8Array
    }

    const sharedView = this.allocator?.getView()
    if (
      this.sharedMemoryEnabled &&
      sharedView &&
      data.length <= (this.allocator?.getUsage().available ?? 0)
    ) {
      const dataOffset = this.allocator!.allocate(data.length, task.id)
      if (dataOffset !== -1) {
        sharedView.set(data, dataOffset)

        worker.postMessage({
          id: task.id,
          type: 'calculate',
          data: {
            dataOffset,
            dataLength: data.length,
            md5Length: task.md5Length,
            isStreamMode: false,
          },
        } as WorkerMessage)
        return
      }
    }

    // Fall back to transferable ArrayBuffer
    let buffer: ArrayBuffer

    if (data.byteLength === 0) {
      buffer = new ArrayBuffer(0)
    } else if (
      data.byteOffset === 0 &&
      data.byteLength === data.buffer.byteLength
    ) {
      if (data.buffer instanceof ArrayBuffer) {
        buffer = data.buffer
      } else {
        buffer = new ArrayBuffer(data.byteLength)
        new Uint8Array(buffer).set(data)
      }
    } else {
      buffer = new ArrayBuffer(data.byteLength)
      new Uint8Array(buffer).set(data)
    }

    worker.postMessage(
      {
        id: task.id,
        type: 'calculate',
        data: {
          fileData: buffer,
          md5Length: task.md5Length,
          isStreamMode: false,
        },
      } as WorkerMessage,
      [buffer]
    )
  }

  public async calculateMd5(
    data: Uint8Array | File,
    md5Length: number = 32,
    timeout: number = 60000,
    onProgress?: (progress: number) => void,
    priority: number = 0
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const taskId = uuidv4()

      const isLargeFile =
        data instanceof File
          ? data.size > this.chunkSize
          : data.length > this.chunkSize

      let timeoutId: ReturnType<typeof setTimeout> | undefined
      if (timeout !== 0) {
        timeoutId = setTimeout(() => {
          const callbacks = this.taskCallbacks.get(taskId)
          if (callbacks) {
            this.taskCallbacks.delete(taskId)
            this.activeTasks.delete(taskId)
            this.allocator?.release(taskId)
            this.releaseFileReadSlot(taskId)
            reject(new Error(`MD5 calculation timeout after ${timeout}ms`))
          }
        }, timeout)
      }

      const wrappedResolve = (result: string) => {
        if (timeoutId !== undefined) clearTimeout(timeoutId)
        resolve(result)
      }

      const wrappedReject = (error: Error | string) => {
        if (timeoutId !== undefined) clearTimeout(timeoutId)
        reject(error)
      }

      const task: Task = {
        id: taskId,
        data,
        md5Length,
        resolve: wrappedResolve,
        reject: wrappedReject,
        priority,
        isLargeFile,
        onProgress,
      }

      if (this.activeTasks.size >= this.maxConcurrentTasks) {
        this.pendingTasks.push(task)
      } else if (this.availableWorkers.length > 0) {
        const worker = this.availableWorkers.shift()!
        this.activeTasks.set(taskId, task)
        this.taskCallbacks.set(taskId, {
          resolve: wrappedResolve,
          reject: wrappedReject,
          onProgress,
        })
        this.workerTaskMap.get(worker)?.add(taskId)

        if (task.isLargeFile && task.data instanceof File) {
          this.processLargeFile(task, worker)
        } else {
          this.processSmallFile(task, worker).catch(wrappedReject)
        }
      } else {
        this.pendingTasks.push(task)
      }
    })
  }

  public destroy(): void {
    this.workers.forEach(worker => worker.terminate())
    this.workers = []
    this.availableWorkers = []
    this.pendingTasks = []
    this.taskCallbacks.clear()
    this.activeFileReads.clear()
    this.workerTaskMap.clear()

    this.fileReadWaitQueue.forEach(({ resolve }) => resolve())
    this.fileReadWaitQueue = []

    this.allocator?.destroy()
  }

  public getPoolStatus(): {
    totalWorkers: number
    availableWorkers: number
    pendingTasks: number
    activeTasks: number
    maxConcurrentTasks: number
    sharedMemoryEnabled: boolean
    sharedMemoryUsage?: {
      total: number
      used: number
      available: number
      fragmentation: number
    }
  } {
    const status: ReturnType<Md5CalculatorPool['getPoolStatus']> = {
      totalWorkers: this.workers.length,
      availableWorkers: this.availableWorkers.length,
      pendingTasks: this.pendingTasks.length,
      activeTasks: this.activeTasks.size,
      maxConcurrentTasks: this.maxConcurrentTasks,
      sharedMemoryEnabled: this.sharedMemoryEnabled,
    }

    if (this.sharedMemoryEnabled && this.allocator) {
      status.sharedMemoryUsage = this.allocator.getUsage()
    }

    return status
  }

  public async calculateMd5Batch(
    files: (Uint8Array | File)[],
    md5Length: number = 32,
    timeout: number = 60000,
    onProgress?: (completed: number, total: number) => void
  ): Promise<string[]> {
    const results: string[] = []
    let completed = 0

    const promises = files.map((file, index) =>
      this.calculateMd5(
        file,
        md5Length,
        timeout,
        undefined,
        files.length - index
      ).then(result => {
        results[index] = result
        completed++
        if (onProgress) onProgress(completed, files.length)
        return result
      })
    )

    await Promise.all(promises)
    return results
  }

  public cancelTask(taskId: string): boolean {
    const task = this.activeTasks.get(taskId)
    if (task) {
      this.activeTasks.delete(taskId)
      this.taskCallbacks.delete(taskId)
      this.allocator?.release(taskId)
      this.releaseFileReadSlot(taskId)
      task.reject(new Error('Task cancelled'))
      return true
    }

    const pendingIndex = this.pendingTasks.findIndex(t => t.id === taskId)
    if (pendingIndex !== -1) {
      const removed = this.pendingTasks.splice(pendingIndex, 1)[0]
      removed.reject(new Error('Task cancelled'))
      return true
    }

    return false
  }

  private async waitForFileReadSlot(taskId: string): Promise<void> {
    if (this.activeFileReads.size >= this.maxConcurrentFileReads) {
      await new Promise<void>(resolve => {
        this.fileReadWaitQueue.push({ taskId, resolve })
      })
    }
    this.activeFileReads.add(taskId)
  }

  private releaseFileReadSlot(taskId: string): void {
    this.activeFileReads.delete(taskId)

    if (this.fileReadWaitQueue.length > 0) {
      const next = this.fileReadWaitQueue.shift()!
      next.resolve()
    }
  }
}

export { Md5CalculatorPool, WasmInit, Md5Calculator }
