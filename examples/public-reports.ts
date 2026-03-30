/**
 * get_public_reports 使用示例
 *
 * 该 webhook 支持匿名访问（无需 API Key），只需提供 MetaInfo。
 * 示例 1-2 演示匿名调用（不携带 API Key）。
 * 示例 3 演示半认证调用（携带 API Key 但使用公共应用）。
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

/** 匿名 SDK：不携带 API Key，仅提供 MetaInfo。 */
function createAnonymousSdk(): Hezor2SDK {
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
    metaInfo,
    privateKeyPath: config.hezor2HeaderPkFilepath,
    password: config.hezor2HeaderPkPassword,
  })
}

async function listPublicReports() {
  console.log('  匿名调用：获取所有公开报告（默认 top_n=5）\n')

  try {
    const sdk = createAnonymousSdk()
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
  console.log(`  匿名调用：获取公开报告（top_n=${topN}）\n`)

  try {
    const sdk = createAnonymousSdk()
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
  console.log('  半认证调用：携带 API Key + 默认应用\n')

  try {
    const sdk = new Hezor2SDK({
      baseUrl: config.hezor2ApiBaseUrl,
      apiKey: config.hezor2ApiKey,
      metaInfo: {
        caller_id: 'example/public_reports',
        subject: 'example',
        subject_code: 'example_001',
      },
      privateKeyPath: config.hezor2HeaderPkFilepath,
      password: config.hezor2HeaderPkPassword,
    })
    const result = await sdk.getPublicReports({ topN: 5 })

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
  { name: '匿名调用（默认参数）', run: listPublicReports },
  { name: '匿名调用（自定义 topN）', run: listWithTopN },
  { name: '半认证调用（API Key + 默认应用）', run: filterByCreation },
])
