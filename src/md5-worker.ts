import WasmInit, { Md5Calculator } from '../wasm/pkg'
import type { WorkerMessage, WorkerMessageData } from './types'

let calculator: Md5Calculator | null = null
let sharedMemoryView: Uint8Array | null = null

interface StreamState {
  hasher: Md5Calculator
  processedChunks: number
  totalChunks: number
  totalSize: number
  processedSize: number
}

const streamStates = new Map<string, StreamState>()

// Serial message queue: ensures messages are processed in order, one at a time.
// Without this, calculate_chunk messages can arrive and execute while the
// initial calculate message is still awaiting WasmInit(), causing
// "stream state not found" errors.
let processing = false
const messageQueue: WorkerMessage[] = []

self.onmessage = function (e: MessageEvent<WorkerMessage>) {
  messageQueue.push(e.data)
  drainQueue()
}

async function drainQueue(): Promise<void> {
  if (processing) return
  processing = true
  try {
    while (messageQueue.length > 0) {
      const msg = messageQueue.shift()!
      await handleMessage(msg)
    }
  } finally {
    processing = false
  }
}

async function handleMessage(msg: WorkerMessage): Promise<void> {
  const { id, type, data } = msg

  if (type === 'init_shared_memory') {
    if (data?.sharedMemory) {
      sharedMemoryView = new Uint8Array(data.sharedMemory)
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
        initializeStreamProcessing(id, data)
      } else {
        await processNormalFile(id, data)
      }
    } catch (error) {
      streamStates.delete(id)
      self.postMessage({
        id,
        type: 'error',
        data: { error: (error as Error).message },
      } as WorkerMessage)
    }
    return
  }

  if (type === 'calculate_chunk') {
    try {
      processChunk(id, data)
    } catch (error) {
      streamStates.delete(id)
      self.postMessage({
        id,
        type: 'error',
        data: { error: (error as Error).message },
      } as WorkerMessage)
    }
    return
  }
}

function initializeStreamProcessing(
  id: string,
  data: WorkerMessageData | undefined
): void {
  if (!data) {
    throw new Error('No data provided for stream processing initialization')
  }

  if (!calculator) {
    throw new Error('Calculator not initialized')
  }

  calculator.start_incremental_md5(id)

  streamStates.set(id, {
    hasher: calculator,
    processedChunks: 0,
    totalChunks: data.totalChunks || 1,
    totalSize: data.dataLength || 0,
    processedSize: 0,
  })
}

function readChunkData(data: WorkerMessageData | undefined): Uint8Array {
  if (
    data?.dataOffset !== undefined &&
    data?.dataLength !== undefined &&
    sharedMemoryView
  ) {
    return sharedMemoryView.slice(
      data.dataOffset,
      data.dataOffset + data.dataLength
    )
  }
  if (data?.chunkData) {
    return new Uint8Array(data.chunkData)
  }
  throw new Error('No valid chunk data provided')
}

function processChunk(id: string, data: WorkerMessageData | undefined): void {
  if (!data) {
    throw new Error('No data provided for chunk processing')
  }

  const state = streamStates.get(id)
  if (!state) {
    throw new Error('Stream state not found')
  }

  const chunkData = readChunkData(data)

  const updateSuccess = state.hasher.update_incremental_md5(id, chunkData)
  if (!updateSuccess) {
    throw new Error('Failed to update incremental MD5')
  }

  state.processedChunks++
  state.processedSize += chunkData.length

  const progress = (state.processedChunks / state.totalChunks) * 100
  self.postMessage({
    id,
    type: 'progress',
    data: { progress },
  } as WorkerMessage)

  if (state.processedChunks >= state.totalChunks) {
    const result = state.hasher.finalize_incremental_md5(
      id,
      data.md5Length || 32
    )

    streamStates.delete(id)

    self.postMessage({
      id,
      type: 'result',
      data: { result },
    } as WorkerMessage)
  }
}

async function processNormalFile(
  id: string,
  data: WorkerMessageData | undefined
): Promise<void> {
  if (!data) {
    throw new Error('No data provided for file processing')
  }

  if (!calculator) {
    await WasmInit()
    calculator = new Md5Calculator()
  }

  let fileData: Uint8Array

  if (
    data?.dataOffset !== undefined &&
    data?.dataLength !== undefined &&
    sharedMemoryView
  ) {
    fileData = sharedMemoryView.slice(
      data.dataOffset,
      data.dataOffset + data.dataLength
    )
  } else if (data?.fileData) {
    fileData = new Uint8Array(data.fileData)
  } else {
    throw new Error('No valid data source provided')
  }

  const result = await calculator.calculate_md5_async(
    fileData,
    data.md5Length || 32
  )

  self.postMessage({
    id,
    type: 'result',
    data: { result },
  } as WorkerMessage)
}
