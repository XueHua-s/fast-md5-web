import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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

const currentFile = fileURLToPath(import.meta.url)
const projectDir = resolve(dirname(currentFile), '..')
const fixtureDir = resolve(projectDir, 'public/test-files')

mkdirSync(fixtureDir, { recursive: true })

const textFixture = Array.from({ length: 1024 }, (_, index) =>
  `fast-md5-web fixture line ${index.toString().padStart(4, '0')}`
).join('\n')

const fixturePayloads = [
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
  {
    name: 'large-pattern.bin',
    description: 'Deterministic binary fixture (>8MB stream threshold)',
    data: createPatternedBuffer(12 * 1024 * 1024 + 123, 17),
  },
]

const manifest = {
  generatedBy: 'scripts/generate-fixtures.mjs',
  generatedAt: 'deterministic-fixtures-v1',
  files: {},
}

for (const fixture of fixturePayloads) {
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

writeFileSync(
  resolve(fixtureDir, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`
)

console.log(`Generated ${fixturePayloads.length} fixture files in ${fixtureDir}`)
