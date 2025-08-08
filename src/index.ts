import WasmInit, { Md5Calculator } from '../wasm/pkg'
import { v4 as uuidv4 } from 'uuid'

// 包装Md5Calculator的简单方法
export async function calculateMd5(data: Uint8Array, md5Length: number = 32): Promise<string> {
  await WasmInit()
  const calculator = new Md5Calculator()
  return await calculator.calculate_md5_async(data, md5Length)
}

// WebWorker消息接口
interface WorkerMessage {
  id: string
  type: 'calculate' | 'result' | 'error'
  data?: {
    fileData?: number[]
    md5Length?: number
    result?: string
    error?: string
  }
}

// WebWorker线程池管理类
export class Md5CalculatorPool {
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

  constructor(poolSize: number = 4) {
    this.poolSize = poolSize
    this.initializeWorkers()
  }

  private initializeWorkers(): void {
    for (let i = 0; i < this.poolSize; i++) {
      const worker = this.createWorker()
      this.workers.push(worker)
      this.availableWorkers.push(worker)
    }
  }

  private createWorker(): Worker {
    // 创建Worker，引用独立的Worker文件
    const worker = new Worker(new URL('./md5-worker.ts', import.meta.url), { type: 'module' })
    
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
      // 重新创建worker
      const index = this.workers.indexOf(worker)
      if (index !== -1) {
        this.workers[index] = this.createWorker()
        this.availableWorkers.push(this.workers[index])
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
      
      worker.postMessage({
        id: task.id,
        type: 'calculate',
        data: {
          fileData: Array.from(task.data),
          md5Length: task.md5Length
        }
      } as WorkerMessage)
    }
  }

  public async calculateMd5(data: Uint8Array, md5Length: number = 32): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const taskId = uuidv4()
      
      const task = {
        id: taskId,
        data,
        md5Length,
        resolve,
        reject
      }
      
      if (this.availableWorkers.length > 0) {
        const worker = this.availableWorkers.shift()!
        
        this.taskCallbacks.set(taskId, { resolve, reject })
        
        worker.postMessage({
          id: taskId,
          type: 'calculate',
          data: {
            fileData: Array.from(data),
            md5Length
          }
        } as WorkerMessage)
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

  public getPoolStatus(): {
    totalWorkers: number
    availableWorkers: number
    pendingTasks: number
  } {
    return {
      totalWorkers: this.workers.length,
      availableWorkers: this.availableWorkers.length,
      pendingTasks: this.pendingTasks.length
    }
  }
}

// 导出默认实例
export const defaultMd5Pool = new Md5CalculatorPool()

// 导出类型
export type { Md5Calculator }