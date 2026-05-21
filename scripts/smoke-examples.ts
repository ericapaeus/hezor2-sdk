#!/usr/bin/env tsx
/**
 * Examples smoke test
 *
 * 验证非交互示例能正常运行，不会因 import 错误或核心逻辑崩溃而退出。
 * 所有场景在 CI 中零网络依赖可跑通。
 *
 * 运行方式：
 *   pnpm test:examples
 */

import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

interface Scenario {
  label: string
  file: string
  args?: string[]
  env?: Record<string, string>
}

const scenarios: Scenario[] = [
  {
    label: 'jwt — 使用匿名密钥生成 MetaInfo JWT（纯 crypto，无网络）',
    file: 'examples/jwt.ts',
    args: ['1'],
  },
  {
    label: 'oauth-auth-code — 生成 PKCE 与 /oauth/authorize URL（纯 URL 拼接，无网络）',
    file: 'examples/oauth-auth-code.ts',
    args: ['1'],
    env: { OAUTH_CLIENT_ID: 'smoke-test-client' },
  },
  {
    label: 'connect — 列出可用示例',
    file: 'examples/connect.ts',
    args: ['--list'],
  },
  {
    label: 'oauth-auth-code — 列出可用示例',
    file: 'examples/oauth-auth-code.ts',
    args: ['--list'],
    env: { OAUTH_CLIENT_ID: 'smoke-test-client' },
  },
  {
    label: 'oauth-device-flow — 列出可用示例',
    file: 'examples/oauth-device-flow.ts',
    args: ['--list'],
  },
]

let passed = 0
let failed = 0

console.log('─'.repeat(60))
console.log('  Examples Smoke Test')
console.log('─'.repeat(60))
console.log()

for (const scenario of scenarios) {
  const filePath = resolve(root, scenario.file)
  const result = spawnSync(
    'node',
    ['--import', 'tsx/esm', filePath, ...(scenario.args ?? [])],
    {
      cwd: root,
      encoding: 'utf-8',
      env: {
        ...process.env,
        ...(scenario.env ?? {}),
      },
      timeout: 15_000,
    },
  )

  const ok = result.status === 0 && !result.error
  if (ok) {
    console.log(`  ✓ ${scenario.label}`)
    passed++
  } else {
    console.log(`  ✗ ${scenario.label}`)
    if (result.stderr) {
      console.log()
      console.log(
        result.stderr
          .split('\n')
          .map((l) => `      ${l}`)
          .join('\n'),
      )
    }
    failed++
  }
}

console.log()
console.log('─'.repeat(60))
console.log(`  结果：${passed} passed, ${failed} failed`)
console.log('─'.repeat(60))

if (failed > 0) {
  process.exit(1)
}
