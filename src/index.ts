import WasmInit, { Md5Calculator } from '../wasm/pkg'
import { v4 as uuidv4 } from 'uuid'


// WebWorker消息接口
interface WorkerMessage {
  id: string
  type: 'calculate' | 'result' | 'error' | 'init_shared_memory'
  data?: {
    fileData?: ArrayBuffer  // 使用ArrayBuffer替代number[]，避免序列化开销
    md5Length?: number
    result?: string
    error?: string
    sharedMemory?: SharedArrayBuffer
    dataOffset?: number
    dataLength?: number
  }
  // 使用Transferable Objects优化大数据传输
  transferList?: Transferable[]
}

// 共享内存配置
interface SharedMemoryConfig {
  enabled: boolean
  memorySize: number // 共享内存大小（字节）
}

// WebWorker线程池管理类
class Md5CalculatorPool {
  private workers: Worker[] = []
  private availableWorkers: Worker[] = []
  private pendingTasks: Array<{
    id: string
    data: Uint8Array
    md5Length: number
    resolve: (value: string) => void
    reject: (reason: any) => void
  }> = []
  private taskCallbacks = new Map<string, {
    resolve: (value: string) => void
    reject: (reason: any) => void
  }>()
  private poolSize: number
  private sharedMemoryConfig: SharedMemoryConfig
  private sharedMemory: SharedArrayBuffer | null = null
  private sharedMemoryView: Uint8Array | null = null
  private memoryOffset: number = 0

  constructor(poolSize: number = 4, sharedMemoryConfig?: SharedMemoryConfig) {
    this.poolSize = poolSize
    this.sharedMemoryConfig = sharedMemoryConfig || {
      enabled: false,
      memorySize: 64 * 1024 * 1024 // 默认64MB
    }
    
    if (this.sharedMemoryConfig.enabled && this.isSharedArrayBufferSupported()) {
      this.initializeSharedMemory()
    }
    
    this.initializeWorkers()
  }

  private isSharedArrayBufferSupported(): boolean {
    return typeof SharedArrayBuffer !== 'undefined'
  }

  private initializeSharedMemory(): void {
    try {
      this.sharedMemory = new SharedArrayBuffer(this.sharedMemoryConfig.memorySize)
      this.sharedMemoryView = new Uint8Array(this.sharedMemory)
      console.log(`Shared memory initialized: ${this.sharedMemoryConfig.memorySize} bytes`)
    } catch (error) {
      console.warn('Failed to initialize shared memory, falling back to message passing:', error)
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
            sharedMemory: this.sharedMemory
          }
        } as WorkerMessage)
      }
    }
  }

  private createWorker(): Worker {
    // 创建Worker，引用独立的Worker文件
    const worker = new Worker(new URL('./md5-worker.js', import.meta.url), { type: 'module' })
    
    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const { id, type, data } = e.data
      
      if (type === 'result' || type === 'error') {
        const callbacks = this.taskCallbacks.get(id)
        if (callbacks) {
          this.taskCallbacks.delete(id)
          
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
      }
    }
    
    worker.onerror = (error) => {
      console.error('Worker error:', error)
      // 查找并拒绝所有与此worker相关的待处理任务
      for (const [taskId, callbacks] of this.taskCallbacks.entries()) {
        callbacks.reject(new Error(`Worker error: ${error.message || 'Unknown worker error'}`))
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
    if (this.pendingTasks.length > 0 && this.availableWorkers.length > 0) {
      const task = this.pendingTasks.shift()!
      const worker = this.availableWorkers.shift()!
      
      this.taskCallbacks.set(task.id, {
        resolve: task.resolve,
        reject: task.reject
      })
      
      if (this.sharedMemoryConfig.enabled && this.sharedMemoryView && task.data.length <= this.sharedMemoryConfig.memorySize) {
        // 使用共享内存
        const dataOffset = this.allocateSharedMemory(task.data.length)
        if (dataOffset !== -1) {
          this.sharedMemoryView.set(task.data, dataOffset)
          
          worker.postMessage({
            id: task.id,
            type: 'calculate',
            data: {
              dataOffset,
              dataLength: task.data.length,
              md5Length: task.md5Length
            }
          } as WorkerMessage)
        } else {
          // 共享内存不足，回退到零拷贝传输
          const buffer = task.data.buffer.slice(task.data.byteOffset, task.data.byteOffset + task.data.byteLength)
          worker.postMessage({
            id: task.id,
            type: 'calculate',
            data: {
              fileData: buffer,
              md5Length: task.md5Length
            },
            transferList: [buffer]
          } as WorkerMessage, [buffer])
        }
      } else {
        // 使用零拷贝传输替代Array.from
        const buffer = task.data.buffer.slice(task.data.byteOffset, task.data.byteOffset + task.data.byteLength)
        worker.postMessage({
          id: task.id,
          type: 'calculate',
          data: {
            fileData: buffer,
            md5Length: task.md5Length
          },
          transferList: [buffer]
        } as WorkerMessage, [buffer])
      }
    }
  }

  public async calculateMd5(data: Uint8Array, md5Length: number = 32, timeout: number = 30000): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const taskId = uuidv4()
      
      // 设置超时处理
      const timeoutId = setTimeout(() => {
        const callbacks = this.taskCallbacks.get(taskId)
        if (callbacks) {
          this.taskCallbacks.delete(taskId)
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
      
      const task = {
        id: taskId,
        data,
        md5Length,
        resolve: wrappedResolve,
        reject: wrappedReject
      }
      
      if (this.availableWorkers.length > 0) {
        const worker = this.availableWorkers.shift()!
        
        this.taskCallbacks.set(taskId, { resolve: wrappedResolve, reject: wrappedReject })
        
        if (this.sharedMemoryConfig.enabled && this.sharedMemoryView && data.length <= this.sharedMemoryConfig.memorySize) {
          // 使用共享内存
          const dataOffset = this.allocateSharedMemory(data.length)
          if (dataOffset !== -1) {
            this.sharedMemoryView.set(data, dataOffset)
            
            worker.postMessage({
              id: taskId,
              type: 'calculate',
              data: {
                dataOffset,
                dataLength: data.length,
                md5Length
              }
            } as WorkerMessage)
          } else {
            // 共享内存不足，回退到零拷贝传输
            const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
            worker.postMessage({
              id: taskId,
              type: 'calculate',
              data: {
                fileData: buffer,
                md5Length
              },
              transferList: [buffer]
            } as WorkerMessage, [buffer])
          }
        } else {
          // 使用零拷贝传输替代Array.from
          const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
          worker.postMessage({
            id: taskId,
            type: 'calculate',
            data: {
              fileData: buffer,
              md5Length
            },
            transferList: [buffer]
          } as WorkerMessage, [buffer])
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

  private allocateSharedMemory(size: number): number {
    if (!this.sharedMemoryView || this.memoryOffset + size > this.sharedMemoryConfig.memorySize) {
      // 尝试重置内存偏移量，简单的内存回收策略
      this.memoryOffset = 0
      if (size > this.sharedMemoryConfig.memorySize) {
        return -1 // 单个数据块太大
      }
    }
    
    const offset = this.memoryOffset
    this.memoryOffset += size
    return offset
  }



  public getPoolStatus(): {
    totalWorkers: number
    availableWorkers: number
    pendingTasks: number
    sharedMemoryEnabled: boolean
    sharedMemoryUsage?: {
      total: number
      used: number
      available: number
    }
  } {
    const status: any = {
      totalWorkers: this.workers.length,
      availableWorkers: this.availableWorkers.length,
      pendingTasks: this.pendingTasks.length,
      sharedMemoryEnabled: this.sharedMemoryConfig.enabled
    }
    
    if (this.sharedMemoryConfig.enabled && this.sharedMemory) {
      status.sharedMemoryUsage = {
        total: this.sharedMemoryConfig.memorySize,
        used: this.memoryOffset,
        available: this.sharedMemoryConfig.memorySize - this.memoryOffset
      }
    }
    
    return status
  }

  public enableSharedMemory(memorySize: number = 64 * 1024 * 1024): boolean {
    if (!this.isSharedArrayBufferSupported()) {
      console.warn('SharedArrayBuffer is not supported in this environment')
      return false
    }
    
    this.sharedMemoryConfig = {
      enabled: true,
      memorySize
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
    this.memoryOffset = 0
  }
}
export {
  Md5CalculatorPool,
  WasmInit,
  Md5Calculator
}