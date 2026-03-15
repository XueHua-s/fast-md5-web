/** Communication protocol between main thread and MD5 worker threads. */
export interface WorkerMessage {
  id: string
  type:
    | 'calculate'
    | 'calculate_chunk'
    | 'result'
    | 'error'
    | 'init_shared_memory'
    | 'progress'
  data?: WorkerMessageData
}

export interface WorkerMessageData {
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
