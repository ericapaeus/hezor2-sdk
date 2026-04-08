/**
 * Connect 第三方登录流程示例
 *
 * 演示如何使用 SDK 构建 Connect 登录 URL、验证应用身份、
 * 以及刷新 Connect Token。
 *
 * Usage:
 *   npx tsx examples/connect.ts        # 运行所有
 *   npx tsx examples/connect.ts 1      # 运行指定
 *   npx tsx examples/connect.ts --list # 列出可用
 *
 * 环境变量 (.env):
 *   HEZOR2_API_BASE_URL    — API 后端地址
 *   HEZOR2_API_KEY         — API Key
 *   HEZOR2_APP_NAME        — 应用名称（Casdoor 中注册的 app name）
 *   HEZOR2_HEADER_PK_FILEPATH — Ed25519 私钥文件路径
 *   HEZOR2_HEADER_PK_PASSWORD — 私钥密码
 *   HEZOR2_FRONTEND_URL    — 前端地址（可选，默认 http://localhost:3000）
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Hezor2SDK, loadEnv } from '../src/index.js'
import { runExamples } from './_runner.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const config = loadEnv(join(__dirname, '.env'))

const FRONTEND_URL = process.env['HEZOR2_FRONTEND_URL'] ?? 'http://localhost:3000'
const CALLBACK_URL = 'http://localhost:3003/'

function createSdk(): Hezor2SDK {
  if (!config.hezor2AppName) {
    throw new Error('HEZOR2_APP_NAME not set in .env')
  }

  return new Hezor2SDK({
    baseUrl: config.hezor2ApiBaseUrl,
    apiKey: config.hezor2ApiKey,
    appName: config.hezor2AppName,
    privateKeyPath: config.hezor2HeaderPkFilepath
      ? join(__dirname, config.hezor2HeaderPkFilepath)
      : undefined,
    password: config.hezor2HeaderPkPassword,
    metaInfo: {
      caller_id: 'example/connect',
      subject: 'example',
      subject_code: 'example_connect',
    },
  })
}

// ── Examples ─────────────────────────────────────────────────────────────

async function buildConnectUrl() {
  const sdk = createSdk()

  console.log(`  app_name:     ${config.hezor2AppName}`)
  console.log(`  frontend_url: ${FRONTEND_URL}`)
  console.log(`  callback_url: ${CALLBACK_URL}\n`)

  const url = await sdk.buildConnectUrl(FRONTEND_URL, CALLBACK_URL)

  console.log('  ✓ Connect URL 构建成功\n')
  console.log(`  ${url}\n`)
  console.log('  ↑ 在浏览器中打开此 URL 即可预览 Connect 登录页面')

  // 解析 URL 参数以便查看
  const parsed = new URL(url)
  console.log('\n  URL 参数解析:')
  console.log(`    app_name:     ${parsed.searchParams.get('app_name')}`)
  console.log(`    callback_url: ${parsed.searchParams.get('callback_url')}`)
  const jwt = parsed.searchParams.get('meta_info') ?? ''
  console.log(`    meta_info:    ${jwt.slice(0, 40)}…  (JWT, ${jwt.length} chars)`)

  // 解码 JWT payload（不验签，仅展示）
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString())
    console.log('\n  meta_info JWT payload:')
    for (const [key, value] of Object.entries(payload)) {
      const display = key === 'exp' || key === 'iat'
        ? `${value} (${new Date((value as number) * 1000).toISOString()})`
        : String(value)
      console.log(`    ${key}: ${display}`)
    }
  } catch {
    // JWT 解码失败不影响主流程
  }
}

async function verifyConnectApp() {
  const sdk = createSdk()

  console.log(`  app_name:     ${config.hezor2AppName}`)
  console.log(`  callback_url: ${CALLBACK_URL}\n`)

  try {
    const result = await sdk.connectVerify(CALLBACK_URL)
    console.log('  ✓ Connect 验证成功\n')
    console.log(`    valid:        ${result.valid}`)
    console.log(`    app_name:     ${result.app_name}`)
    console.log(`    callback_url: ${result.callback_url}`)
    console.log(`    meta_info:    ${JSON.stringify(result.meta_info, null, 2).split('\n').join('\n    ')}`)
  } catch (err) {
    console.log(`  ✗ 验证失败: ${err}`)
    console.log('\n  常见原因:')
    console.log('    - callback_url 不在应用的 redirect_uris 中')
    console.log('    - 私钥与应用证书不匹配')
    console.log('    - app_name 不存在')
  }
}

async function refreshConnectToken() {
  console.log('  ⚠ 此示例需要一个有效的 refresh_token。')
  console.log('  完成 Connect 登录流程后，回调 URL 会携带 refresh_token 参数。\n')

  const refreshToken = process.env['CONNECT_REFRESH_TOKEN']
  if (!refreshToken) {
    console.log('  跳过：未设置 CONNECT_REFRESH_TOKEN 环境变量。')
    console.log('  用法：CONNECT_REFRESH_TOKEN=xxx npx tsx examples/connect.ts 3')
    return
  }

  const sdk = createSdk()

  console.log(`  app_name:      ${config.hezor2AppName}`)
  console.log(`  refresh_token: ${refreshToken.slice(0, 12)}…\n`)

  try {
    const result = await sdk.connectRefresh(refreshToken)
    console.log('  ✓ Token 刷新成功\n')
    console.log(`    access_token:  ${result.access_token.slice(0, 20)}…`)
    console.log(`    token_type:    ${result.token_type}`)
    console.log(`    expires_in:    ${result.expires_in}s`)
    console.log(`    user:          ${result.user.display_name} (${result.user.name})`)
    if (result.refresh_token) {
      console.log(`    new refresh:   ${result.refresh_token.slice(0, 12)}…`)
    }
  } catch (err) {
    console.log(`  ✗ 刷新失败: ${err}`)
  }
}

// ── Run ──────────────────────────────────────────────────────────────────

runExamples('connect', [
  { name: '构建 Connect URL（预览登录页面）', run: buildConnectUrl },
  { name: '验证 Connect 应用身份', run: verifyConnectApp },
  { name: '刷新 Connect Token', run: refreshConnectToken },
])
