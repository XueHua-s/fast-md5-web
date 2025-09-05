<script setup lang="ts">
import { ref, onMounted } from 'vue'
import SparkMD5 from 'spark-md5'
import { WasmInit, Md5CalculatorPool } from 'fast-md5-web'
const selectedFiles = ref<FileList | null>(null)
const testResults = ref<Array<{
  fileName: string
  fileSize: number
  sparkMd5Hash: string
  fastMd5Hash: string
  match: boolean
}>>([])

const performanceStats = ref<{
  sparkMd5TotalTime: number
  fastMd5TotalTime: number
  performanceImprovement: number
} | null>(null)
const isLoading = ref(false)
let md5CalculatorPool: Md5CalculatorPool | null = null
let wasmInitialized = false

onMounted(async () => {
  try {
    // 首先初始化WASM模块
    await WasmInit()
    // 然后创建MD5计算器池，使用CPU核心数和共享内存配置
    md5CalculatorPool = new Md5CalculatorPool(
      navigator.hardwareConcurrency, // Worker count based on CPU cores
      {
        enabled: true,
        memorySize: 6400 * 1024 * 1024, // 64MB memory
        chunkSize: 2 * 1024 * 1024    // 2MB chunks
      },
      navigator.hardwareConcurrency
    )

    wasmInitialized = true
    console.log('Fast-MD5-Web pool initialized successfully with', navigator.hardwareConcurrency, 'workers')
  } catch (error) {
    console.error('Failed to initialize Fast-MD5-Web:', error)
  }
})

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  selectedFiles.value = target.files
}

const testMD5Performance = async () => {
  if (!selectedFiles.value || selectedFiles.value.length === 0) {
    alert('请选择至少一个文件')
    return
  }

  isLoading.value = true
  testResults.value = []

  const files = Array.from(selectedFiles.value)

  try {
    // 并行处理所有文件的SparkMD5计算
    const sparkStartTime = performance.now()
    const sparkResults = await Promise.all(
      files.map(async (file) => {
        const hash = await calculateSparkMD5(file)
        return {
          file,
          hash
        }
      })
    )
    const sparkTotalTime = performance.now() - sparkStartTime

    // 并行处理所有文件的fast-md5-web计算
    const fastStartTime = performance.now()
    const fastResults = await Promise.all(
      files.map(async (file) => {
        const hash = await calculateFastMD5(file)
        return {
          file,
          hash
        }
      })
    )
    const fastTotalTime = performance.now() - fastStartTime
    // 合并结果
    testResults.value = files.map((file, index) => ({
      fileName: file.name,
      fileSize: file.size,
      sparkMd5Hash: sparkResults[index].hash,
      fastMd5Hash: fastResults[index].hash,
      match: sparkResults[index].hash === fastResults[index].hash
    }))

    // 保存性能统计数据到页面显示
    performanceStats.value = {
      sparkMd5TotalTime: sparkTotalTime,
      fastMd5TotalTime: fastTotalTime,
      performanceImprovement: (sparkTotalTime / fastTotalTime - 1) * 100
    }
  } catch (error) {
    console.error('测试过程中发生错误:', error)
    alert('测试过程中发生错误，请查看控制台')
  }

  isLoading.value = false
}

const calculateSparkMD5 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const spark = new SparkMD5.ArrayBuffer()
    const fileReader = new FileReader()
    const chunkSize = 2097152 // 2MB chunks
    let currentChunk = 0
    const chunks = Math.ceil(file.size / chunkSize)

    fileReader.onload = (e) => {
      spark.append(e.target?.result as ArrayBuffer)
      currentChunk++

      if (currentChunk < chunks) {
        loadNext()
      } else {
        resolve(spark.end())
      }
    }

    fileReader.onerror = () => {
      reject(new Error('文件读取错误'))
    }

    const loadNext = () => {
      const start = currentChunk * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      fileReader.readAsArrayBuffer(file.slice(start, end))
    }

    loadNext()
  })
}

const calculateFastMD5 = async (file: File): Promise<string> => {
  if (!wasmInitialized || !md5CalculatorPool) {
    throw new Error('Fast-MD5-Web 工作池未初始化')
  }

  // 使用工作池计算MD5，支持大文件和进度跟踪
  const hash = await md5CalculatorPool.calculateMd5(
    file,
    32, // MD5 length
    0, // timeout (不设置超时)
    (progress) => {
      // 可选：显示进度（这里暂时注释掉避免过多日志）
      // console.log(`${file.name} progress: ${progress.toFixed(1)}%`)
    },
    1 // priority (1 = high priority)
  )

  return hash
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatTime = (ms: number): string => {
  return ms.toFixed(2) + ' ms'
}
</script>

<template>
  <div class="container">
    <h1>MD5 性能测试：spark-md5 vs fast-md5-web</h1>

    <div class="file-selector">
      <label for="file-input">选择文件进行测试：</label>
      <input
        id="file-input"
        type="file"
        multiple
        @change="handleFileSelect"
        :disabled="isLoading"
      />
    </div>

    <button
      @click="testMD5Performance"
      :disabled="isLoading || !selectedFiles"
      class="test-button"
    >
      {{ isLoading ? '测试中...' : '开始测试' }}
    </button>

    <div v-if="testResults.length > 0" class="results">
      <h2>测试结果</h2>
      <div class="results-table">
        <div class="table-header">
          <div>文件名</div>
          <div>文件大小</div>
          <div>SparkMD5 哈希</div>
          <div>Fast-MD5-Web 哈希</div>
          <div>哈希匹配</div>
        </div>
        <div
          v-for="result in testResults"
          :key="result.fileName"
          class="table-row"
        >
          <div class="file-name">{{ result.fileName }}</div>
          <div>{{ formatFileSize(result.fileSize) }}</div>
          <div class="hash">{{ result.sparkMd5Hash }}</div>
          <div class="hash">{{ result.fastMd5Hash }}</div>
          <div :class="{ 'match': result.match, 'no-match': !result.match }">
            {{ result.match ? '✓' : '✗' }}
          </div>
        </div>
      </div>

      <div class="summary">
        <h3>性能总结</h3>
        <div class="summary-stats">
          <div>总文件数: {{ testResults.length }}</div>
          <div>哈希匹配率: {{ ((testResults.filter((r: any) => r.match).length / testResults.length) * 100).toFixed(1) }}%</div>
        </div>
      </div>

      <div v-if="performanceStats" class="performance-comparison">
        <h3>总体性能对比</h3>
        <div class="performance-stats">
          <div class="stat-card spark">
            <div class="stat-label">SparkMD5 总时间</div>
            <div class="stat-value">{{ formatTime(performanceStats.sparkMd5TotalTime) }}</div>
          </div>
          <div class="stat-card fast">
            <div class="stat-label">Fast-MD5-Web 总时间</div>
            <div class="stat-value">{{ formatTime(performanceStats.fastMd5TotalTime) }}</div>
          </div>
          <div class="stat-card improvement">
            <div class="stat-label">性能提升</div>
            <div class="stat-value improvement-value">{{ performanceStats.performanceImprovement.toFixed(1) }}%</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

h1 {
  text-align: center;
  color: #2c3e50;
  margin-bottom: 30px;
  font-size: 2.5em;
}

.file-selector {
  margin-bottom: 20px;
  padding: 20px;
  border: 2px dashed #3498db;
  border-radius: 10px;
  background-color: #f8f9fa;
}

.file-selector label {
  display: block;
  margin-bottom: 10px;
  font-weight: bold;
  color: #2c3e50;
}

.file-selector input[type="file"] {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
  background-color: white;
}

.test-button {
  display: block;
  margin: 20px auto;
  padding: 15px 30px;
  font-size: 18px;
  font-weight: bold;
  color: white;
  background: linear-gradient(45deg, #3498db, #2980b9);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 150px;
}

.test-button:hover:not(:disabled) {
  background: linear-gradient(45deg, #2980b9, #1f5f8b);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}

.test-button:disabled {
  background: #95a5a6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.results {
  margin-top: 30px;
}

.results h2 {
  color: #2c3e50;
  border-bottom: 2px solid #3498db;
  padding-bottom: 10px;
}

.results-table {
  background: white;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.table-header {
  display: grid;
  grid-template-columns: 2fr 1fr 1.2fr 2fr 1.2fr 2fr 0.8fr;
  gap: 10px;
  padding: 15px;
  background: linear-gradient(45deg, #3498db, #2980b9);
  color: white;
  font-weight: bold;
  font-size: 14px;
}

.table-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1.2fr 2fr 1.2fr 2fr 0.8fr;
  gap: 10px;
  padding: 15px;
  border-bottom: 1px solid #ecf0f1;
  align-items: center;
  font-size: 13px;
}

.table-row:nth-child(even) {
  background-color: #f8f9fa;
}

.table-row:hover {
  background-color: #e3f2fd;
}

.file-name {
  font-weight: 500;
  color: #2c3e50;
  word-break: break-all;
}

.hash {
  font-family: 'Courier New', monospace;
  font-size: 11px;
  word-break: break-all;
  color: #7f8c8d;
}

.match {
  color: #27ae60;
  font-weight: bold;
  font-size: 16px;
  text-align: center;
}

.no-match {
  color: #e74c3c;
  font-weight: bold;
  font-size: 16px;
  text-align: center;
}

.summary {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 20px;
  border-radius: 10px;
  margin-top: 20px;
}

.summary h3 {
  color: #2c3e50;
  margin-bottom: 15px;
  text-align: center;
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
}

.summary-stats > div {
  background: white;
  padding: 15px;
  border-radius: 8px;
  text-align: center;
  font-weight: 500;
  color: #2c3e50;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.performance-comparison {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 25px;
  border-radius: 15px;
  margin-top: 25px;
  color: white;
}

.performance-comparison h3 {
  color: white;
  margin-bottom: 20px;
  text-align: center;
  font-size: 1.5em;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.performance-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.stat-card {
  background: rgba(255, 255, 255, 0.95);
  padding: 20px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.15);
}

.stat-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 10px;
  font-weight: 500;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #2c3e50;
}

.improvement-value {
  color: #27ae60;
  font-size: 28px;
  text-shadow: 0 2px 4px rgba(39, 174, 96, 0.3);
}

.stat-card.improvement {
  background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
  border: 2px solid #27ae60;
}

.stat-card.spark {
  border-left: 4px solid #e74c3c;
}

.stat-card.fast {
  border-left: 4px solid #3498db;
}

@media (max-width: 768px) {
  .table-header,
  .table-row {
    grid-template-columns: 1fr;
    gap: 5px;
  }

  .table-header > div,
  .table-row > div {
    padding: 5px 0;
  }

  .hash {
    font-size: 10px;
  }
}
</style>
