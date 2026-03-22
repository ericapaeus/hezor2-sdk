/**
 * pull_configs 使用示例
 *
 * Usage:
 *   npx tsx examples/pull-configs.ts        # 运行所有
 *   npx tsx examples/pull-configs.ts 1      # 运行指定
 *   npx tsx examples/pull-configs.ts --list # 列出可用
 */

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  Hezor2SDK,
  loadEnv,
  mergedConfigs,
  type MetaInfoData,
} from '../src/index.js'
import { runExamples } from './_runner.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const config = loadEnv(join(__dirname, '.env'))

function createSdk(): Hezor2SDK {
  const metaInfo: MetaInfoData = {
    caller_id: 'example/pull_configs',
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

async function pullAll() {
  try {
    const sdk = createSdk()
    const data = await sdk.pullConfigs()

    console.log(`  ✓ public:  ${Object.keys(data.public).length} entries`)
    for (const [k, v] of Object.entries(data.public)) console.log(`    ${k} = ${v}`)

    console.log(`\n  ✓ user:    ${Object.keys(data.user).length} entries`)
    for (const [k, v] of Object.entries(data.user)) console.log(`    ${k} = ${v}`)

    const merged = mergedConfigs(data)
    console.log(`\n  ✓ merged:  ${Object.keys(merged).length} entries (user overrides public)`)
    for (const [k, v] of Object.entries(merged)) {
      const source = k in data.user ? 'user' : 'public'
      console.log(`    [${source}] ${k} = ${v}`)
    }
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

async function filterByKeys() {
  const keys = ['EMBEDDING_BASE_URL_INNER', 'MY_APP_URL', 'DATABASE_HOST']
  console.log(`  keys: ${JSON.stringify(keys)}\n`)

  try {
    const sdk = createSdk()
    const data = await sdk.pullConfigs({ keys })
    const merged = mergedConfigs(data)

    console.log(`  ✓ returned ${Object.keys(merged).length} entries\n`)

    for (const key of keys) {
      if (key in merged) {
        const source = key in data.user ? 'user' : 'public'
        console.log(`  ✓ [${source}] ${key} = ${merged[key]}`)
      } else {
        console.log(`  - ${key} (not found)`)
      }
    }
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

async function injectToProcessEnv() {
  console.log('  Scenario: pull configs at startup and inject into process.env\n')

  try {
    const sdk = createSdk()
    const data = await sdk.pullConfigs({ globalBaseUrl: config.hezor2ApiBaseUrl })
    const configs = mergedConfigs(data)

    const prev: Record<string, string | undefined> = {}
    for (const key of Object.keys(configs)) prev[key] = process.env[key]

    Object.assign(process.env, configs)
    console.log(`  ✓ injected ${Object.keys(configs).length} entries into process.env\n`)

    for (const [key, value] of Object.entries(configs)) {
      const old = prev[key]
      const tag = old == null ? '+' : old !== value ? '~' : '='
      console.log(`  ${tag} ${key} = ${value}`)
    }

    const sample = Object.keys(configs).slice(0, 3)
    console.log('\n  Verification:')
    for (const key of sample) console.log(`    process.env["${key}"] → ${JSON.stringify(process.env[key])}`)
    if (Object.keys(configs).length > 3) console.log(`    … ${Object.keys(configs).length} total`)
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

runExamples('pull-configs', [
  { name: '拉取全量配置 (public + user)', run: pullAll },
  { name: '按 key 列表过滤', run: filterByKeys },
  { name: '拉取配置并注入 process.env', run: injectToProcessEnv },
])
