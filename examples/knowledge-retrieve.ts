/**
 * knowledge_retrieve 使用示例
 *
 * Usage:
 *   npx tsx examples/knowledge-retrieve.ts        # 运行所有
 *   npx tsx examples/knowledge-retrieve.ts 1      # 运行指定
 *   npx tsx examples/knowledge-retrieve.ts --list # 列出可用
 */

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Hezor2SDK, loadEnv, type MetaInfoData } from '../src/index.js'
import { runExamples } from './_runner.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const config = loadEnv(join(__dirname, '.env'))

function createSdk(): Hezor2SDK {
  const metaInfo: MetaInfoData = {
    caller_id: 'example/knowledge_retrieve',
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

async function basicRetrieve() {
  const query = '什么是万店盈利'
  console.log(`  query: ${query}\n`)

  try {
    const sdk = createSdk()
    const result = await sdk.knowledgeRetrieve(query)

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

async function customParams() {
  const query = '稻纵卷叶螟发生分析'
  const topK = 5
  const scoreThreshold = 0.5

  console.log(`  query:          ${query}`)
  console.log(`  topK:           ${topK}`)
  console.log(`  scoreThreshold: ${scoreThreshold}\n`)

  try {
    const sdk = createSdk()
    const result = await sdk.knowledgeRetrieve(query, { topK, scoreThreshold })

    console.log(`  ✓ chunks:      ${result.chunks.items.length}`)
    console.log(`  ✓ entities:    ${result.entities.items.length}`)
    console.log(`  ✓ communities: ${result.communities.items.length}`)
    console.log(`  ✓ pictures:    ${result.pictures.items.length}`)
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

async function resultDetails() {
//   const query = '棉花病虫害有哪些？'
  const query = '麦当劳的竞争对手有哪些？'
  console.log(`  query: ${query}\n`)

  try {
    const sdk = createSdk()
    const result = await sdk.knowledgeRetrieve(query, { topK: 3 })

    // Chunks
    console.log(`  [Chunks] collection=${result.chunks.collection}`)
    for (const item of result.chunks.items) {
      console.log(`    #${item.rank} score=${item.score.toFixed(4)}  doc=${item.chunk.docName}  page=${item.chunk.page}`)
      console.log(`      ${item.chunk.text.slice(0, 80).trim()}…`)
    }

    // Entities
    console.log(`\n  [Entities] collection=${result.entities.collection}`)
    for (const item of result.entities.items) {
      console.log(`    #${item.rank} score=${item.score.toFixed(4)}  [${item.entity.entityType}] ${item.entity.name}`)
      if (item.entity.description) console.log(`      ${item.entity.description.slice(0, 80)}…`)
    }

    // Communities
    console.log(`\n  [Communities] collection=${result.communities.collection}`)
    for (const item of result.communities.items) {
      console.log(`    #${item.rank} score=${item.score.toFixed(4)}  ${item.community.title}`)
      console.log(`      ${item.community.summary.slice(0, 80)}…`)
      if (item.community.findings.length > 0) console.log(`      findings: ${item.community.findings.length}`)
    }

    // Pictures
    console.log(`\n  [Pictures] collection=${result.pictures.collection}`)
    if (result.pictures.items.length === 0) {
      console.log('    (none)')
    }
    for (const item of result.pictures.items) {
      console.log(`    #${item.rank} score=${item.score.toFixed(4)}  ${item.picture.filename}`)
      if (item.picture.description) console.log(`      ${item.picture.description.slice(0, 80)}…`)
    }
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

runExamples('knowledge-retrieve', [
  { name: '基础知识检索', run: basicRetrieve },
  { name: '自定义 topK / scoreThreshold', run: customParams },
  { name: '结果详情 (chunks / entities / communities / pictures)', run: resultDetails },
])
