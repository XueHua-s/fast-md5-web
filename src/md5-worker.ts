import WasmInit, { Md5Calculator } from '../wasm/pkg'

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
        // 使用零拷贝ArrayBuffer传输
        fileData = new Uint8Array(data.fileData)
        console.log(`Worker: Using zero-copy ArrayBuffer transfer, data length: ${fileData.length}`)
      } else {
        throw new Error('No valid data source provided')
      }
      
      // 根据文件大小选择计算方法：小文件使用同步方法，大文件使用异步方法
      const result = await calculator.calculate_md5_async(fileData, data!.md5Length!)  // 大于512KB使用异步
      
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