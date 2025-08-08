import WasmInit, { Md5Calculator } from '../wasm/pkg'

// WebWorker消息接口
interface WorkerMessage {
  id: string
  type: 'calculate' | 'calculate_chunk' | 'result' | 'error' | 'init_shared_memory' | 'progress'
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
  transferList?: Transferable[]
}

let calculator: Md5Calculator | null = null
let sharedMemoryView: Uint8Array | null = null

// 流式处理状态
interface StreamState {
  hasher: any // MD5 hasher instance
  processedChunks: number
  totalChunks: number
  totalSize: number
  processedSize: number
}

const streamStates = new Map<string, StreamState>()

self.onmessage = async function(e: MessageEvent<WorkerMessage>) {
  const { id, type, data } = e.data
  
  if (type === 'init_shared_memory') {
    // 初始化共享内存
    if (data?.sharedMemory) {
      sharedMemoryView = new Uint8Array(data.sharedMemory)
      console.log('Worker: Shared memory initialized')
    }
    return
  }
  
  if (type === 'calculate') {
    try {
      if (!calculator) {
        await WasmInit()
        calculator = new Md5Calculator()
      }
      
      if (data?.isStreamMode) {
        // 流式处理模式 - 初始化
        await initializeStreamProcessing(id, data)
      } else {
        // 普通模式 - 直接计算
        await processNormalFile(id, data)
      }
    } catch (error) {
      streamStates.delete(id)
      self.postMessage({
        id,
        type: 'error',
        data: { error: (error as Error).message }
      } as WorkerMessage)
    }
  }
  
  if (type === 'calculate_chunk') {
    try {
      await processChunk(id, data)
    } catch (error) {
      streamStates.delete(id)
      self.postMessage({
        id,
        type: 'error',
        data: { error: (error as Error).message }
      } as WorkerMessage)
    }
  }
}

async function initializeStreamProcessing(id: string, data: any): Promise<void> {
  if (!calculator) {
    await WasmInit()
    calculator = new Md5Calculator()
  }
  
  // 创建新的MD5计算器实例用于流式处理
  const hasher = new Md5Calculator()
  
  // 启动增量MD5计算会话
  hasher.start_incremental_md5(id)
  
  streamStates.set(id, {
    hasher,
    processedChunks: 0,
    totalChunks: data.totalChunks || 1,
    totalSize: data.dataLength || 0,
    processedSize: 0
  })
  
  console.log(`Worker: Stream processing initialized for ${id}, total chunks: ${data.totalChunks}`)
}

async function processChunk(id: string, data: any): Promise<void> {
  const state = streamStates.get(id)
  if (!state) {
    throw new Error('Stream state not found')
  }
  
  let chunkData: Uint8Array
  
  if (data?.dataOffset !== undefined && data?.dataLength !== undefined && sharedMemoryView) {
    // 从共享内存读取分块数据
    chunkData = sharedMemoryView.slice(data.dataOffset, data.dataOffset + data.dataLength)
  } else if (data?.chunkData) {
    chunkData = new Uint8Array(data.chunkData)
  } else {
    throw new Error('No valid chunk data provided')
  }
  
  // 使用增量MD5计算
  const updateSuccess = state.hasher.update_incremental_md5(id, chunkData)
  if (!updateSuccess) {
    throw new Error('Failed to update incremental MD5')
  }
  
  state.processedChunks++
  state.processedSize += chunkData.length
  
  // 发送进度更新
  const progress = (state.processedChunks / state.totalChunks) * 100
  self.postMessage({
    id,
    type: 'progress',
    data: { progress }
  } as WorkerMessage)
  
  // 如果是最后一个分块，完成计算
  if (state.processedChunks >= state.totalChunks) {
    // 完成增量MD5计算并获取结果
    const result = state.hasher.finalize_incremental_md5(id, data.md5Length || 32)
    
    streamStates.delete(id)
    
    self.postMessage({
      id,
      type: 'result',
      data: { result }
    } as WorkerMessage)
  }
}

async function processNormalFile(id: string, data: any): Promise<void> {
  if (!calculator) {
    await WasmInit()
    calculator = new Md5Calculator()
  }
  
  let fileData: Uint8Array
  
  if (data?.dataOffset !== undefined && data?.dataLength !== undefined && sharedMemoryView) {
    // 使用共享内存
    fileData = sharedMemoryView.slice(data.dataOffset, data.dataOffset + data.dataLength)
    console.log(`Worker: Using shared memory, offset: ${data.dataOffset}, length: ${data.dataLength}`)
  } else if (data?.fileData) {
    // 使用零拷贝ArrayBuffer传输
    fileData = new Uint8Array(data.fileData)
    console.log(`Worker: Using zero-copy ArrayBuffer transfer, data length: ${fileData.length}`)
  } else {
    throw new Error('No valid data source provided')
  }
  
  // 使用异步方法计算MD5
  const result = await calculator.calculate_md5_async(fileData, data!.md5Length!)
  
  self.postMessage({
    id,
    type: 'result',
    data: { result }
  } as WorkerMessage)
}