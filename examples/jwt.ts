/**
 * JWT 模块使用示例
 *
 * Usage:
 *   npx tsx examples/jwt.ts        # 运行所有
 *   npx tsx examples/jwt.ts 1      # 运行指定
 *   npx tsx examples/jwt.ts --list # 列出可用
 */

import {
  metaInfoToRequestHeader,
  type MetaInfoData,
  ANONYMOUS_HEADER_PUBLIC_KEY,
  REQ_HEADER_META_INFO_KEY,
} from '../src/index.js'
import { runExamples } from './_runner.js'

async function anonymousKey() {
  const metaInfo: MetaInfoData = {
    subject: '鮨大山',
    subject_code: 'wdyl_001',
    caller_id: 'user_123',
    data_coverage: '202401-202412',
    creation_slug: 'single_store_profit_model',
    creation_name: '单店盈利模型',
  }

  console.log('  MetaInfo:')
  for (const [k, v] of Object.entries(metaInfo)) console.log(`    ${k}: ${v}`)

  const header = await metaInfoToRequestHeader(metaInfo)
  const token = header[REQ_HEADER_META_INFO_KEY]!

  console.log(`\n  ✓ JWT (anonymous key): ${token.slice(0, 50)}…`)
  console.log(`    length: ${token.length}`)
  console.log(`\n  Public key:\n${ANONYMOUS_HEADER_PUBLIC_KEY}`)
}

async function customKeyFile() {
  const metaInfo: MetaInfoData = {
    subject: '测试主体',
    subject_code: 'test_001',
    caller_id: 'example_caller',
    data_coverage: '202501-202512',
    creation_slug: 'test_creation',
    creation_name: '测试创建',
  }

  console.log('  MetaInfo:')
  for (const [k, v] of Object.entries(metaInfo)) console.log(`    ${k}: ${v}`)
  console.log()

  const keyPath = process.env['HEZOR2_HEADER_PK_FILEPATH']
  const keyPassword = process.env['HEZOR2_HEADER_PK_PASSWORD']

  if (!keyPath) {
    console.log('  ⚠ HEZOR2_HEADER_PK_FILEPATH not set — skipped.')
    console.log('  Run with:')
    console.log('    HEZOR2_HEADER_PK_FILEPATH=./key.pem npx tsx examples/jwt.ts 2')
    return
  }

  console.log(`  Using key: ${keyPath}`)
  try {
    const header = await metaInfoToRequestHeader(metaInfo, {
      privateKeyPath: keyPath,
      password: keyPassword,
      expiresIn: 3600,
    })
    const token = header[REQ_HEADER_META_INFO_KEY]!
    console.log(`  ✓ JWT (custom key): ${token.slice(0, 50)}…`)
    console.log(`    length: ${token.length}`)
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

runExamples('jwt', [
  { name: '使用匿名密钥生成 MetaInfo JWT', run: anonymousKey },
  { name: '使用自定义密钥文件', run: customKeyFile },
])
