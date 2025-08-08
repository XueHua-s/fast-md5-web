import WasmInit, { Md5Calculator } from '../wasm/pkg'

// WebWorker消息接口
interface WorkerMessage {
  id: string
  type: 'calculate' | 'result' | 'error' | 'init_shared_memory'
  data?: {
    fileData?: number[]
    md5Length?: number
    result?: string
    error?: string
    sharedMemory?: SharedArrayBuffer
    dataOffset?: number
    dataLength?: number
  }
}

let calculator: Md5Calculator | null = null
let sharedMemoryView: Uint8Array | null = null

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
      
      let fileData: Uint8Array
      
      if (data?.dataOffset !== undefined && data?.dataLength !== undefined && sharedMemoryView) {
        // 使用共享内存
        fileData = sharedMemoryView.slice(data.dataOffset, data.dataOffset + data.dataLength)
        console.log(`Worker: Using shared memory, offset: ${data.dataOffset}, length: ${data.dataLength}`)
      } else if (data?.fileData) {
        // 使用传统的消息传递
        fileData = new Uint8Array(data.fileData)
        console.log(`Worker: Using message passing, data length: ${data.fileData.length}`)
      } else {
        throw new Error('No valid data source provided')
      }
      
      const result = await calculator.calculate_md5_async(fileData, data!.md5Length!)
      
      self.postMessage({
        id,
        type: 'result',
        data: { result }
      } as WorkerMessage)
    } catch (error) {
      self.postMessage({
        id,
        type: 'error',
        data: { error: (error as Error).message }
      } as WorkerMessage)
    }
  }
}