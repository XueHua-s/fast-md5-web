import WasmInit, { Md5Calculator } from '../wasm/pkg'
import { v4 as uuidv4 } from 'uuid'

// 配置常量
const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024 // 8MB 分块大小
const DEFAULT_SHARED_MEMORY_SIZE = 512 * 1024 * 1024 // 512MB 共享内存
const MEMORY_CLEANUP_THRESHOLD = 0.8 // 内存使用率超过80%时清理

// WebWorker消息接口
interface WorkerMessage {
  id: string
  type:
    | 'calculate'
    | 'calculate_chunk'
    | 'result'
    | 'error'
    | 'init_shared_memory'
    | 'progress'
  data?: {
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
}

// 共享内存配置
interface SharedMemoryConfig {
  enabled: boolean
  memorySize: number
  chunkSize: number
}

// 任务类型定义
interface Task {
  id: string
  data: Uint8Array | File
  md5Length: number
  resolve: (value: string) => void
  reject: (reason: any) => void
  priority: number
  isLargeFile: boolean
  onProgress?: (progress: number) => void
}

// 内存块管理
interface MemoryBlock {
  offset: number
  size: number
  inUse: boolean
  taskId?: string
}

// WebWorker线程池管理类
class Md5CalculatorPool {
  private workers: Worker[] = []
  private availableWorkers: Worker[] = []
  private pendingTasks: Task[] = []
  private activeTasks = new Map<string, Task>()
  private taskCallbacks = new Map<
    string,
    {
      resolve: (value: string) => void
      reject: (reason: any) => void
      onProgress?: (progress: number) => void
    }
  >()
  private poolSize: number
  private sharedMemoryConfig: SharedMemoryConfig
  private sharedMemory: SharedArrayBuffer | null = null
  private sharedMemoryView: Uint8Array | null = null
  private memoryBlocks: MemoryBlock[] = []
  private maxConcurrentTasks: number

  constructor(
    poolSize: number = 4,
    sharedMemoryConfig?: SharedMemoryConfig,
    maxConcurrentTasks?: number
  ) {
    this.poolSize = poolSize
    this.maxConcurrentTasks = maxConcurrentTasks || poolSize
    this.sharedMemoryConfig = sharedMemoryConfig || {
      enabled: false,
      memorySize: DEFAULT_SHARED_MEMORY_SIZE,
      chunkSize: DEFAULT_CHUNK_SIZE,
    }

    if (
      this.sharedMemoryConfig.enabled &&
      this.isSharedArrayBufferSupported()
    ) {
      this.initializeSharedMemory()
    }

    this.initializeWorkers()
  }

  private isSharedArrayBufferSupported(): boolean {
    return typeof SharedArrayBuffer !== 'undefined'
  }

  private initializeSharedMemory(): void {
    try {
      this.sharedMemory = new SharedArrayBuffer(
        this.sharedMemoryConfig.memorySize
      )
      this.sharedMemoryView = new Uint8Array(this.sharedMemory)

      // 初始化内存块管理
      this.memoryBlocks = [
        {
          offset: 0,
          size: this.sharedMemoryConfig.memorySize,
          inUse: false,
        },
      ]

      console.log(
        `Shared memory initialized: ${this.sharedMemoryConfig.memorySize} bytes`
      )
    } catch (error) {
      console.warn(
        'Failed to initialize shared memory, falling back to message passing:',
        error
      )
      this.sharedMemoryConfig.enabled = false
    }
  }

  private initializeWorkers(): void {
    for (let i = 0; i < this.poolSize; i++) {
      const worker = this.createWorker()
      this.workers.push(worker)
      this.availableWorkers.push(worker)

      // 如果启用了共享内存，向Worker发送共享内存
      if (this.sharedMemoryConfig.enabled && this.sharedMemory) {
        worker.postMessage({
          id: `init-${i}`,
          type: 'init_shared_memory',
          data: {
            sharedMemory: this.sharedMemory,
          },
        } as WorkerMessage)
      }
    }
  }

  private createWorker(): Worker {
    // 创建Worker，引用独立的Worker文件
    const worker = new Worker(new URL('./md5-worker.js', import.meta.url), {
      type: 'module',
    })

    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const { id, type, data } = e.data

      if (type === 'result' || type === 'error') {
        const callbacks = this.taskCallbacks.get(id)
        const task = this.activeTasks.get(id)

        if (callbacks) {
          this.taskCallbacks.delete(id)
          this.activeTasks.delete(id)

          // 释放共享内存
          if (task?.isLargeFile) {
            this.releaseSharedMemory(id)
          }

          if (type === 'result') {
            callbacks.resolve(data!.result!)
          } else {
            callbacks.reject(new Error(data!.error!))
          }
        }

        // 将worker标记为可用
        this.availableWorkers.push(worker)

        // 处理待处理的任务
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
      // 查找并拒绝所有与此worker相关的待处理任务
      for (const [taskId, callbacks] of this.taskCallbacks.entries()) {
        callbacks.reject(
          new Error(`Worker error: ${error.message || 'Unknown worker error'}`)
        )
        this.taskCallbacks.delete(taskId)
      }

      // 重新创建worker
      const index = this.workers.indexOf(worker)
      if (index !== -1) {
        this.workers[index] = this.createWorker()
        // 只有在worker不在可用列表中时才添加
        const availableIndex = this.availableWorkers.indexOf(worker)
        if (availableIndex !== -1) {
          this.availableWorkers[availableIndex] = this.workers[index]
        } else {
          this.availableWorkers.push(this.workers[index])
        }
      }
    }

    return worker
  }

  private processNextTask(): void {
    // 检查并发限制
    if (this.activeTasks.size >= this.maxConcurrentTasks) {
      return
    }

    if (this.pendingTasks.length > 0 && this.availableWorkers.length > 0) {
      // 按优先级排序任务（优先级高的先执行）
      this.pendingTasks.sort((a, b) => b.priority - a.priority)

      const task = this.pendingTasks.shift()!
      const worker = this.availableWorkers.shift()!

      this.activeTasks.set(task.id, task)
      this.taskCallbacks.set(task.id, {
        resolve: task.resolve,
        reject: task.reject,
        onProgress: task.onProgress,
      })

      if (task.isLargeFile && task.data instanceof File) {
        // 大文件使用流式处理
        this.processLargeFile(task, worker)
      } else {
        // 小文件直接处理
        this.processSmallFile(task, worker)
      }
    }
  }

  private async processLargeFile(task: Task, worker: Worker): Promise<void> {
    const file = task.data as File
    const chunkSize = this.sharedMemoryConfig.chunkSize
    const totalChunks = Math.ceil(file.size / chunkSize)

    // 为大文件分配共享内存
    const memoryOffset = this.allocateSharedMemory(chunkSize, task.id)
    if (memoryOffset === -1) {
      // 共享内存不足，回退到普通处理
      const uint8Array = new Uint8Array(await file.arrayBuffer())
      this.processSmallFile({ ...task, data: uint8Array }, worker)
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

    // 分块读取文件并写入共享内存
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      const chunk = file.slice(start, end)
      const chunkData = new Uint8Array(await chunk.arrayBuffer())

      if (this.sharedMemoryView) {
        this.sharedMemoryView.set(chunkData, memoryOffset)

        worker.postMessage({
          id: task.id,
          type: 'calculate_chunk',
          data: {
            chunkIndex: i,
            dataLength: chunkData.length,
            dataOffset: memoryOffset,
          },
        } as WorkerMessage)
      }

      // 让出控制权，避免阻塞UI
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }

  private processSmallFile(task: Task, worker: Worker): void {
    const data = task.data as Uint8Array

    if (
      this.sharedMemoryConfig.enabled &&
      this.sharedMemoryView &&
      data.length <= this.sharedMemoryConfig.memorySize
    ) {
      // 使用共享内存
      const dataOffset = this.allocateSharedMemory(data.length, task.id)
      if (dataOffset !== -1) {
        this.sharedMemoryView.set(data, dataOffset)

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

    // 回退到零拷贝传输
    const buffer = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength
    )
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

      // 判断是否为大文件
      const isLargeFile =
        data instanceof File
          ? data.size > DEFAULT_CHUNK_SIZE
          : data.length > DEFAULT_CHUNK_SIZE

      // 设置超时处理
      const timeoutId = setTimeout(() => {
        const callbacks = this.taskCallbacks.get(taskId)
        if (callbacks) {
          this.taskCallbacks.delete(taskId)
          this.activeTasks.delete(taskId)
          this.releaseSharedMemory(taskId)
          reject(new Error(`MD5 calculation timeout after ${timeout}ms`))
        }
      }, timeout)

      const wrappedResolve = (result: string) => {
        clearTimeout(timeoutId)
        resolve(result)
      }

      const wrappedReject = (error: any) => {
        clearTimeout(timeoutId)
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

      // 检查并发限制
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

        if (task.isLargeFile && task.data instanceof File) {
          this.processLargeFile(task, worker)
        } else {
          this.processSmallFile(task, worker)
        }
      } else {
        this.pendingTasks.push(task)
      }
    })
  }

  public destroy(): void {
    this.workers.forEach(worker => {
      worker.terminate()
    })
    this.workers = []
    this.availableWorkers = []
    this.pendingTasks = []
    this.taskCallbacks.clear()
  }

  private allocateSharedMemory(size: number, taskId?: string): number {
    if (!this.sharedMemoryView) {
      return -1
    }

    // 查找可用的内存块
    for (let i = 0; i < this.memoryBlocks.length; i++) {
      const block = this.memoryBlocks[i]
      if (!block.inUse && block.size >= size) {
        // 找到合适的块
        block.inUse = true
        block.taskId = taskId

        // 如果块太大，分割它
        if (block.size > size) {
          this.memoryBlocks.splice(i + 1, 0, {
            offset: block.offset + size,
            size: block.size - size,
            inUse: false,
          })
          block.size = size
        }

        return block.offset
      }
    }

    // 尝试内存整理
    this.defragmentMemory()

    // 再次尝试分配
    for (let i = 0; i < this.memoryBlocks.length; i++) {
      const block = this.memoryBlocks[i]
      if (!block.inUse && block.size >= size) {
        block.inUse = true
        block.taskId = taskId

        if (block.size > size) {
          this.memoryBlocks.splice(i + 1, 0, {
            offset: block.offset + size,
            size: block.size - size,
            inUse: false,
          })
          block.size = size
        }

        return block.offset
      }
    }

    return -1 // 内存不足
  }

  private releaseSharedMemory(taskId: string): void {
    for (const block of this.memoryBlocks) {
      if (block.taskId === taskId) {
        block.inUse = false
        block.taskId = undefined
      }
    }

    // 合并相邻的空闲块
    this.mergeAdjacentBlocks()
  }

  private defragmentMemory(): void {
    // 合并相邻的空闲块
    this.mergeAdjacentBlocks()

    // 检查内存使用率
    const totalUsed = this.memoryBlocks
      .filter(block => block.inUse)
      .reduce((sum, block) => sum + block.size, 0)

    const usageRatio = totalUsed / this.sharedMemoryConfig.memorySize

    if (usageRatio > MEMORY_CLEANUP_THRESHOLD) {
      console.warn(`Memory usage high: ${(usageRatio * 100).toFixed(1)}%`)
    }
  }

  private mergeAdjacentBlocks(): void {
    this.memoryBlocks.sort((a, b) => a.offset - b.offset)

    for (let i = 0; i < this.memoryBlocks.length - 1; i++) {
      const current = this.memoryBlocks[i]
      const next = this.memoryBlocks[i + 1]

      if (
        !current.inUse &&
        !next.inUse &&
        current.offset + current.size === next.offset
      ) {
        // 合并相邻的空闲块
        current.size += next.size
        this.memoryBlocks.splice(i + 1, 1)
        i-- // 重新检查当前位置
      }
    }
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
    const status: any = {
      totalWorkers: this.workers.length,
      availableWorkers: this.availableWorkers.length,
      pendingTasks: this.pendingTasks.length,
      activeTasks: this.activeTasks.size,
      maxConcurrentTasks: this.maxConcurrentTasks,
      sharedMemoryEnabled: this.sharedMemoryConfig.enabled,
    }

    if (this.sharedMemoryConfig.enabled && this.sharedMemory) {
      const totalUsed = this.memoryBlocks
        .filter(block => block.inUse)
        .reduce((sum, block) => sum + block.size, 0)

      const freeBlocks = this.memoryBlocks.filter(block => !block.inUse).length

      status.sharedMemoryUsage = {
        total: this.sharedMemoryConfig.memorySize,
        used: totalUsed,
        available: this.sharedMemoryConfig.memorySize - totalUsed,
        fragmentation: freeBlocks,
      }
    }

    return status
  }

  public enableSharedMemory(
    memorySize: number = DEFAULT_SHARED_MEMORY_SIZE,
    chunkSize: number = DEFAULT_CHUNK_SIZE
  ): boolean {
    if (!this.isSharedArrayBufferSupported()) {
      console.warn('SharedArrayBuffer is not supported in this environment')
      return false
    }

    this.sharedMemoryConfig = {
      enabled: true,
      memorySize,
      chunkSize,
    }

    this.initializeSharedMemory()

    // 重新初始化所有Worker以支持共享内存
    this.destroy()
    this.initializeWorkers()

    return this.sharedMemoryConfig.enabled
  }

  public disableSharedMemory(): void {
    this.sharedMemoryConfig.enabled = false
    this.sharedMemory = null
    this.sharedMemoryView = null
    this.memoryBlocks = []
  }

  // 添加批量处理方法
  public async calculateMd5Batch(
    files: (Uint8Array | File)[],
    md5Length: number = 32,
    onProgress?: (completed: number, total: number) => void
  ): Promise<string[]> {
    const results: string[] = []
    let completed = 0

    const promises = files.map((file, index) =>
      this.calculateMd5(file, md5Length, 60000, undefined, files.length - index) // 后面的文件优先级更高
        .then(result => {
          results[index] = result
          completed++
          if (onProgress) {
            onProgress(completed, files.length)
          }
          return result
        })
    )

    await Promise.all(promises)
    return results
  }

  // 添加取消任务的方法
  public cancelTask(taskId: string): boolean {
    const task = this.activeTasks.get(taskId)
    if (task) {
      this.activeTasks.delete(taskId)
      this.taskCallbacks.delete(taskId)
      this.releaseSharedMemory(taskId)
      task.reject(new Error('Task cancelled'))
      return true
    }

    const pendingIndex = this.pendingTasks.findIndex(t => t.id === taskId)
    if (pendingIndex !== -1) {
      const task = this.pendingTasks.splice(pendingIndex, 1)[0]
      task.reject(new Error('Task cancelled'))
      return true
    }

    return false
  }
}
export { Md5CalculatorPool, WasmInit, Md5Calculator }
