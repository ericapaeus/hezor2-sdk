/**
 * knowledge_search 使用示例
 *
 * 单集合精确语义检索，支持过滤和混合检索模式。
 *
 * Usage:
 *   npx tsx examples/knowledge-search.ts        # 运行所有
 *   npx tsx examples/knowledge-search.ts 1      # 运行指定
 *   npx tsx examples/knowledge-search.ts --list # 列出可用
 */

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Hezor2SDK, loadEnv, type MetaInfoData } from '../src/index.js'
import { runExamples } from './_runner.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const config = loadEnv(join(__dirname, '.env'))

function createSdk(): Hezor2SDK {
  const metaInfo: MetaInfoData = {
    caller_id: 'example/knowledge_search',
    subject: 'example',
    subject_code: 'example_001',
    creation_name: '示例创建',
    creation_slug: 'example_creation',
    data_coverage: '20240101-20241231',
  }

  return new Hezor2SDK({
    baseUrl: config.hezor2ApiBaseUrl,
    apiKey: config.hezor2ApiKey,
    appName: config.hezor2AppName,
    metaInfo,
    privateKeyPath: config.hezor2HeaderPkFilepath,
    password: config.hezor2HeaderPkPassword,
  })
}

async function basicSearch() {
  const query = '什么是万店盈利'
  const collection = 'chunks'

  console.log(`  query:      ${query}`)
  console.log(`  collection: ${collection}\n`)

  try {
    const sdk = createSdk()
    const result = await sdk.knowledgeSearch(query, collection)

    console.log(`  ✓ chunks:      ${result.chunks.items.length}`)
    console.log(`  ✓ entities:    ${result.entities.items.length}`)
    console.log(`  ✓ communities: ${result.communities.items.length}`)
    console.log(`  ✓ pictures:    ${result.pictures.items.length}`)

    const top = result.chunks.items[0]
    if (top) {
      console.log(`\n  Top chunk (rank=${top.rank}, score=${top.score.toFixed(4)}):`)
      console.log(`    doc:  ${top.chunk.docName}`)
      console.log(`    text: ${top.chunk.text.slice(0, 100)}…`)
    }
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

async function entityTypeFilter() {
  const query = '万店盈利'
  const collection = 'entities'
  const entityType = 'Organization-组织'

  console.log(`  query:      ${query}`)
  console.log(`  collection: ${collection}`)
  console.log(`  entityType: ${entityType}\n`)

  try {
    const sdk = createSdk()
    const result = await sdk.knowledgeSearch(query, collection, {
      entityType,
      topK: 10,
    })

    console.log(`  ✓ entities: ${result.entities.items.length}`)
    for (const item of result.entities.items) {
      console.log(`    #${item.rank} score=${item.score.toFixed(4)}  ${JSON.stringify(item.entity)}`)
    }
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

async function hybridSearch() {
  const query = '万店盈利有哪些相关的知识？'
  const collection = 'chunks'

  console.log(`  query:        ${query}`)
  console.log(`  collection:   ${collection}`)
  console.log(`  searchMode:   hybrid`)
  console.log(`  vectorWeight: 0.6`)
  console.log(`  textWeight:   0.4\n`)

  try {
    const sdk = createSdk()
    const result = await sdk.knowledgeSearch(query, collection, {
      searchMode: 'hybrid',
      vectorWeight: 0.6,
      textWeight: 0.4,
      topK: 5,
    })

    console.log(`  ✓ chunks: ${result.chunks.items.length}`)
    for (const item of result.chunks.items) {
      console.log(`    #${item.rank} score=${item.score.toFixed(4)}  doc=${item.chunk.docName}`)
      console.log(`      ${item.chunk.text.slice(0, 80).trim()}…`)
    }
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

async function dateRangeFilter() {
  const query = '万店盈利的定义和要素有哪些？'
  const collection = 'chunks'
  const dateRange: [string, string] = ['2024-01-01', '2024-12-31']

  console.log(`  query:      ${query}`)
  console.log(`  collection: ${collection}`)
  console.log(`  dateRange:  ${dateRange[0]} ~ ${dateRange[1]}\n`)

  try {
    const sdk = createSdk()
    const result = await sdk.knowledgeSearch(query, collection, {
      dateRange,
      topK: 5,
      scoreThreshold: 0.5,
    })

    console.log(`  ✓ chunks: ${result.chunks.items.length}`)
    for (const item of result.chunks.items) {
      console.log(`    #${item.rank} score=${item.score.toFixed(4)}  doc=${item.chunk.docName}`)
    }
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

runExamples('knowledge-search', [
  { name: 'Basic single-collection search', run: basicSearch },
  { name: 'Entity type filter', run: entityTypeFilter },
  { name: 'Hybrid search mode', run: hybridSearch },
  { name: 'Date range filter', run: dateRangeFilter },
])
