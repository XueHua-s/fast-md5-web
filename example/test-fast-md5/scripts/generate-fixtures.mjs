import { createHash } from 'node:crypto'
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const FIXTURE_VERSION = 'deterministic-fixtures-v2-300mb'
const LARGE_FILE_SIZE = 300 * 1024 * 1024 + 123
const LARGE_FILE_FILL = 17

function createPatternedBuffer(length, seed) {
  const output = Buffer.alloc(length)
  let value = seed >>> 0

  for (let i = 0; i < length; i++) {
    value = (value * 1664525 + 1013904223) >>> 0
    output[i] = value & 0xff
  }

  return output
}

function md5Hex(data) {
  return createHash('md5').update(data).digest('hex')
}

async function writeLargeFilledFile(filePath, size, fillByte) {
  return new Promise((resolve, reject) => {
    const stream = createWriteStream(filePath)
    const hash = createHash('md5')
    const fullChunk = Buffer.alloc(2 * 1024 * 1024, fillByte & 0xff)
    let remaining = size

    stream.on('error', reject)
    stream.on('finish', () => resolve(hash.digest('hex')))

    const writeNext = () => {
      while (remaining > 0) {
        const chunk =
          remaining >= fullChunk.length
            ? fullChunk
            : fullChunk.subarray(0, remaining)

        hash.update(chunk)
        remaining -= chunk.length

        if (!stream.write(chunk)) {
          stream.once('drain', writeNext)
          return
        }
      }

      stream.end()
    }

    writeNext()
  })
}

function isFixtureFresh(manifestPath, fixtureSpecs, fixtureDir) {
  if (!existsSync(manifestPath)) {
    return false
  }

  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    if (manifest.generatedAt !== FIXTURE_VERSION) {
      return false
    }

    for (const fixture of fixtureSpecs) {
      const filePath = resolve(fixtureDir, fixture.name)
      if (!existsSync(filePath)) {
        return false
      }

      if (statSync(filePath).size !== fixture.size) {
        return false
      }

      if (!manifest.files?.[fixture.name]) {
        return false
      }
    }
  } catch {
    return false
  }

  return true
}

const currentFile = fileURLToPath(import.meta.url)
const projectDir = resolve(dirname(currentFile), '..')
const fixtureDir = resolve(projectDir, 'public/test-files')
const manifestPath = resolve(fixtureDir, 'manifest.json')

mkdirSync(fixtureDir, { recursive: true })

const textFixture = Array.from({ length: 1024 }, (_, index) =>
  `fast-md5-web fixture line ${index.toString().padStart(4, '0')}`
).join('\n')

const smallFixtures = [
  {
    name: 'empty.bin',
    description: 'Empty file fixture for edge-case hashing',
    data: Buffer.alloc(0),
  },
  {
    name: 'small-text.txt',
    description: 'Deterministic UTF-8 text fixture',
    data: Buffer.from(textFixture, 'utf8'),
  },
  {
    name: 'small-pattern.bin',
    description: 'Deterministic binary fixture (256KB)',
    data: createPatternedBuffer(256 * 1024, 7),
  },
]

const fixtureSpecs = [
  ...smallFixtures.map(item => ({
    name: item.name,
    size: item.data.length,
  })),
  {
    name: 'large-pattern.bin',
    size: LARGE_FILE_SIZE,
  },
]

if (isFixtureFresh(manifestPath, fixtureSpecs, fixtureDir)) {
  console.log(`Fixtures already up to date in ${fixtureDir}`)
  process.exit(0)
}

const manifest = {
  generatedBy: 'scripts/generate-fixtures.mjs',
  generatedAt: FIXTURE_VERSION,
  files: {},
}

for (const fixture of smallFixtures) {
  const filePath = resolve(fixtureDir, fixture.name)
  writeFileSync(filePath, fixture.data)

  const hash32 = md5Hex(fixture.data)
  manifest.files[fixture.name] = {
    description: fixture.description,
    size: fixture.data.length,
    md5_32: hash32,
    md5_16: hash32.slice(0, 16),
  }
}

const largeFilePath = resolve(fixtureDir, 'large-pattern.bin')
const largeHash = await writeLargeFilledFile(
  largeFilePath,
  LARGE_FILE_SIZE,
  LARGE_FILE_FILL
)

manifest.files['large-pattern.bin'] = {
  description:
    'Deterministic binary fixture (>=300MB stream threshold, fixed-byte pattern)',
  size: LARGE_FILE_SIZE,
  md5_32: largeHash,
  md5_16: largeHash.slice(0, 16),
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Generated ${fixtureSpecs.length} fixture files in ${fixtureDir}`)
