/**
 * Simple first-fit memory block allocator for SharedArrayBuffer regions.
 *
 * Why first-fit: the allocation pattern is short-lived, same-sized chunks
 * (one per worker task), so first-fit performs well without the overhead
 * of more sophisticated algorithms.
 */

const MEMORY_CLEANUP_THRESHOLD = 0.8

interface MemoryBlock {
  offset: number
  size: number
  inUse: boolean
  taskId?: string
}

export class SharedMemoryAllocator {
  private blocks: MemoryBlock[] = []
  private totalSize: number
  private view: Uint8Array | null = null
  private buffer: SharedArrayBuffer | null = null

  constructor(totalSize: number) {
    this.totalSize = totalSize
  }

  /**
   * Initialize the underlying SharedArrayBuffer.
   * Returns false if SharedArrayBuffer is not supported or allocation fails.
   */
  initialize(): boolean {
    try {
      this.buffer = new SharedArrayBuffer(this.totalSize)
      this.view = new Uint8Array(this.buffer)
      this.blocks = [{ offset: 0, size: this.totalSize, inUse: false }]
      return true
    } catch {
      this.buffer = null
      this.view = null
      this.blocks = []
      return false
    }
  }

  getBuffer(): SharedArrayBuffer | null {
    return this.buffer
  }

  getView(): Uint8Array | null {
    return this.view
  }

  isInitialized(): boolean {
    return this.buffer !== null
  }

  /**
   * Allocate a contiguous region of `size` bytes.
   * Returns the byte offset, or -1 if no suitable block is available.
   */
  allocate(size: number, taskId?: string): number {
    if (!this.view) return -1

    let offset = this.tryAllocate(size, taskId)
    if (offset !== -1) return offset

    // Defragment and retry once
    this.mergeAdjacentFreeBlocks()
    this.logHighUsageWarning()

    offset = this.tryAllocate(size, taskId)
    return offset
  }

  /** Release all blocks owned by `taskId`. */
  release(taskId: string): void {
    for (const block of this.blocks) {
      if (block.taskId === taskId) {
        block.inUse = false
        block.taskId = undefined
      }
    }
    this.mergeAdjacentFreeBlocks()
  }

  /** Return usage statistics for diagnostics. */
  getUsage(): {
    total: number
    used: number
    available: number
    fragmentation: number
  } {
    const used = this.blocks
      .filter(b => b.inUse)
      .reduce((sum, b) => sum + b.size, 0)
    const freeBlockCount = this.blocks.filter(b => !b.inUse).length

    return {
      total: this.totalSize,
      used,
      available: this.totalSize - used,
      fragmentation: freeBlockCount,
    }
  }

  /** Tear down all state. */
  destroy(): void {
    this.buffer = null
    this.view = null
    this.blocks = []
  }

  private tryAllocate(size: number, taskId?: string): number {
    for (let i = 0; i < this.blocks.length; i++) {
      const block = this.blocks[i]
      if (!block.inUse && block.size >= size) {
        block.inUse = true
        block.taskId = taskId

        if (block.size > size) {
          this.blocks.splice(i + 1, 0, {
            offset: block.offset + size,
            size: block.size - size,
            inUse: false,
          })
          block.size = size
        }

        return block.offset
      }
    }
    return -1
  }

  private mergeAdjacentFreeBlocks(): void {
    this.blocks.sort((a, b) => a.offset - b.offset)

    for (let i = 0; i < this.blocks.length - 1; i++) {
      const current = this.blocks[i]
      const next = this.blocks[i + 1]

      if (
        !current.inUse &&
        !next.inUse &&
        current.offset + current.size === next.offset
      ) {
        current.size += next.size
        this.blocks.splice(i + 1, 1)
        i--
      }
    }
  }

  private logHighUsageWarning(): void {
    const used = this.blocks
      .filter(b => b.inUse)
      .reduce((sum, b) => sum + b.size, 0)
    const ratio = used / this.totalSize

    if (ratio > MEMORY_CLEANUP_THRESHOLD) {
      console.warn(`Shared memory usage high: ${(ratio * 100).toFixed(1)}%`)
    }
  }
}
