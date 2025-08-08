import WasmInit, { Md5Calculator } from '../wasm/pkg'

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

let calculator: Md5Calculator | null = null

self.onmessage = async function(e: MessageEvent<WorkerMessage>) {
  const { id, type, data } = e.data
  
  if (type === 'calculate') {
    try {
      if (!calculator) {
        await WasmInit()
        calculator = new Md5Calculator()
      }
      
      const result = await calculator.calculate_md5_async(new Uint8Array(data!.fileData!), data!.md5Length!)
      
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