/**
 * data_retrieve 使用示例
 *
 * Usage:
 *   npx tsx examples/data-retrieve.ts        # 运行所有
 *   npx tsx examples/data-retrieve.ts 1      # 运行指定
 *   npx tsx examples/data-retrieve.ts --list # 列出可用
 */

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Hezor2SDK, loadEnv, type MetaInfoData } from '../src/index.js'
import { runExamples } from './_runner.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const config = loadEnv(join(__dirname, '.env'))

function createSdk(): Hezor2SDK {
  const metaInfo: MetaInfoData = {
    caller_id: 'example/data_retrieve',
    subject: 'example',
    subject_code: 'yidashan',
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
  const query = '火星店的销售的数据'
  console.log(`  query: ${query}`)
  console.log('  topK:  1 (default)\n')

  try {
    const sdk = createSdk()
    const result = await sdk.dataRetrieve(query)

    console.log(`  ✓ query:  ${result.query}`)
    console.log(`  ✓ tools:  ${Object.keys(result.results).length}\n`)

    for (const [tool, resp] of Object.entries(result.results)) {
      const flag = resp.success ? '✓' : '✗'
      console.log(`  ${flag} ${tool}  count=${resp.count}`)
      if (resp.desc) console.log(`    desc: ${resp.desc}`)
      if (!resp.success && resp.error) console.log(`    error: ${resp.error}`)
    }
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

async function multiToolMatch() {
  const query = '统计本月鮨大山门店实收情况'
  const topK = 3

  console.log(`  query: ${query}`)
  console.log(`  topK:  ${topK}\n`)

  try {
    const sdk = createSdk()
    const result = await sdk.dataRetrieve(query, { topK })

    console.log(`  ✓ matched ${Object.keys(result.results).length} tool(s)\n`)

    for (const [tool, resp] of Object.entries(result.results)) {
      const flag = resp.success ? '✓' : '✗'
      console.log(`  ${flag} ${tool}  count=${resp.count}`)
    }
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

async function resultDetails() {
  const query = '查询鮨大山各门店去年收入情况数据'

  console.log(`  query: ${query}\n`)

  try {
    const sdk = createSdk()
    const result = await sdk.dataRetrieve(query, { topK: 2 })

    console.log(`  ✓ query: ${result.query}`)
    console.log(`  ✓ tools: ${Object.keys(result.results).length}\n`)

    for (const [tool, resp] of Object.entries(result.results)) {
      console.log(`  ── ${tool} ──`)
      console.log(`  success: ${resp.success}  count: ${resp.count}`)
      if (resp.desc) console.log(`  desc:    ${resp.desc}`)

      if (resp.success) {
        const { data } = resp
        if (Array.isArray(data)) {
          console.log(`  data:    Array[${data.length}]`)
          data.slice(0, 3).forEach((item, i) => console.log(`    [${i}] ${JSON.stringify(item).slice(0, 120)}`))
          if (data.length > 3) console.log(`    … ${data.length} total`)
        } else if (data && typeof data === 'object') {
          const entries = Object.entries(data as Record<string, unknown>)
          console.log(`  data:    Object { ${entries.length} keys }`)
          for (const [k, v] of entries) {
            const str = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)
            console.log(`    ${k}: ${str.slice(0, 120)}${str.length > 120 ? '…' : ''}`)
          }
        }
      } else {
        console.log(`  error:   ${resp.error}`)
      }
      console.log()
    }
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

runExamples('data-retrieve', [
  { name: '基础数据检索 (topK=1)', run: basicRetrieve },
  { name: '匹配多个工具 (topK=3)', run: multiToolMatch },
  { name: '结果详情展示', run: resultDetails },
])
