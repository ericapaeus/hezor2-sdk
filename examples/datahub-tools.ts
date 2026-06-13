/**
 * datahub_search_tools / datahub_execute_tool 使用示例
 *
 * Usage:
 *   npx tsx examples/datahub-tools.ts        # 运行所有
 *   npx tsx examples/datahub-tools.ts 1      # 运行指定
 *   npx tsx examples/datahub-tools.ts --list # 列出可用
 */

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Hezor2SDK, loadEnv, type MetaInfoData } from '../src/index.js'
import { runExamples } from './_runner.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const config = loadEnv(join(__dirname, '.env'))

function createSdk(): Hezor2SDK {
  const metaInfo: MetaInfoData = {
    caller_id: 'example/datahub_tools',
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

// ---------------------------------------------------------------------------
// 示例 1：语义搜索工具列表
// ---------------------------------------------------------------------------

async function searchTools() {
  const query = '门店收入统计'
  const topK = 5

  console.log(`  query: ${query}`)
  console.log(`  topK:  ${topK}\n`)

  try {
    const sdk = createSdk()
    const result = await sdk.datahubSearchTools(query, { topK })

    console.log(`  ✓ 找到 ${result.tools.length} 个工具\n`)

    for (const tool of result.tools) {
      console.log(`  ── ${tool.name} ──`)
      if (tool.desc) console.log(`  desc:  ${tool.desc.slice(0, 100)}`)
      if (tool.group) console.log(`  group: ${tool.group}`)
      const paramKeys = tool.params ? Object.keys(tool.params) : []
      if (paramKeys.length > 0) {
        console.log(`  params: ${paramKeys.join(', ')}`)
      }
      console.log()
    }
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

// ---------------------------------------------------------------------------
// 示例 2：先搜索再执行（discover → execute）
// ---------------------------------------------------------------------------

async function discoverAndExecute() {
  const query = '鮨大山月度销售数据'
  console.log(`  1. 搜索工具: "${query}"\n`)

  try {
    const sdk = createSdk()

    // 搜索最匹配的工具
    const searchResult = await sdk.datahubSearchTools(query, { topK: 1 })

    if (searchResult.tools.length === 0) {
      console.log('  ✗ 未找到匹配工具')
      return
    }

    const tool = searchResult.tools[0]
    console.log(`  ✓ 匹配工具: ${tool.name}`)
    if (tool.desc) console.log(`    desc: ${tool.desc.slice(0, 100)}`)

    // 从 params schema 中提取必填参数名
    const paramKeys = tool.params ? Object.keys(tool.params) : []
    console.log(`  params: ${paramKeys.join(', ')}\n`)

    // 2. 直接执行（示例用空参数，实际应填写正确参数值）
    console.log(`  2. 执行工具: ${tool.name}`)
    const execResult = await sdk.datahubExecuteTool(tool.name, {})

    const flag = execResult.success ? '✓' : '✗'
    console.log(`  ${flag} success=${execResult.success}  count=${execResult.count}`)
    if (execResult.desc) console.log(`    desc: ${execResult.desc.slice(0, 120)}`)
    if (!execResult.success && execResult.error) {
      console.log(`    error: ${execResult.error}`)
    }
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

// ---------------------------------------------------------------------------
// 示例 3：直接执行已知工具（工具名已知，跳过搜索）
// ---------------------------------------------------------------------------

async function executeKnownTool() {
  // 将 toolName 替换为实际存在的工具名
  const toolName = 'get_monthly_sales'
  const args = { month: '2024-06' }

  console.log(`  tool:  ${toolName}`)
  console.log(`  args:  ${JSON.stringify(args)}\n`)

  try {
    const sdk = createSdk()
    const result = await sdk.datahubExecuteTool(toolName, args)

    const flag = result.success ? '✓' : '✗'
    console.log(`  ${flag} success=${result.success}  count=${result.count}`)
    if (result.desc) console.log(`    desc: ${result.desc.slice(0, 120)}`)

    if (result.success) {
      const { data } = result
      if (Array.isArray(data)) {
        console.log(`  data:  Array[${data.length}]`)
        data.slice(0, 3).forEach((item, i) =>
          console.log(`    [${i}] ${JSON.stringify(item).slice(0, 120)}`),
        )
        if (data.length > 3) console.log(`    … ${data.length} total`)
      } else if (data && typeof data === 'object') {
        const entries = Object.entries(data as Record<string, unknown>)
        console.log(`  data:  Object { ${entries.length} keys }`)
        for (const [k, v] of entries) {
          const str = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)
          console.log(`    ${k}: ${str.slice(0, 120)}${str.length > 120 ? '…' : ''}`)
        }
      }
    } else {
      // success=false 不抛出，可直接访问错误信息
      console.log(`    error: ${result.error}`)
    }
  } catch (err) {
    // 只有 HTTP 错误才会走到这里
    console.log(`  ✗ HTTP error: ${err}`)
  }
}

runExamples('datahub-tools', [
  { name: '语义搜索工具列表', run: searchTools },
  { name: '先搜索再执行（discover → execute）', run: discoverAndExecute },
  { name: '直接执行已知工具', run: executeKnownTool },
])
