/**
 * get_public_reports 使用示例
 *
 * 该 webhook 支持匿名访问（无需 API Key），只需提供 MetaInfo。
 *
 * Usage:
 *   npx tsx examples/public-reports.ts        # 运行所有
 *   npx tsx examples/public-reports.ts 1      # 运行指定
 *   npx tsx examples/public-reports.ts --list # 列出可用
 */

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Hezor2SDK, loadEnv, type MetaInfoData } from '../src/index.js'
import { runExamples } from './_runner.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const config = loadEnv(join(__dirname, '.env'))

function createSdk(): Hezor2SDK {
  const metaInfo: MetaInfoData = {
    caller_id: 'example/public_reports',
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

async function listPublicReports() {
  console.log('  获取所有公开报告（默认 top_n=5）\n')

  try {
    const sdk = createSdk()
    const result = await sdk.getPublicReports()

    console.log(`  ✓ total: ${result.total}`)
    console.log(`  ✓ items: ${result.items.length}\n`)

    for (const item of result.items) {
      console.log(`    [${item.reportId}]`)
      console.log(`      title:    ${item.reportTitle}`)
      console.log(`      date:     ${item.generatedAt}`)
      console.log(`      summary:  ${item.summary.slice(0, 80)}${item.summary.length > 80 ? '…' : ''}`)
      console.log(`      url:      ${item.reportUrl}`)
      console.log()
    }
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

async function listWithTopN() {
  const topN = 10
  console.log(`  获取公开报告（top_n=${topN}）\n`)

  try {
    const sdk = createSdk()
    const result = await sdk.getPublicReports({ topN })

    console.log(`  ✓ total: ${result.total}`)
    console.log(`  ✓ items: ${result.items.length}\n`)

    for (const item of result.items) {
      console.log(`    - ${item.reportTitle} (${item.reportId})`)
    }
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

async function filterByCreation() {
  const creationId = 'crt_example_001'
  console.log(`  获取指定 Creation 的公开报告: ${creationId}\n`)

  try {
    const sdk = createSdk()
    const result = await sdk.getPublicReports({ creationId })

    console.log(`  ✓ total: ${result.total}`)
    console.log(`  ✓ items: ${result.items.length}\n`)

    for (const item of result.items) {
      console.log(`    [${item.reportId}]`)
      console.log(`      title:   ${item.reportTitle}`)
      console.log(`      url:     ${item.reportUrl}`)
      console.log()
    }
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

runExamples('get_public_reports', [
  { name: '获取所有公开报告（默认参数）', run: listPublicReports },
  { name: '获取公开报告（自定义 topN）', run: listWithTopN },
  { name: '按 Creation ID 筛选公开报告', run: filterByCreation },
])
