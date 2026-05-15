/**
 * OAuth 2.0 Device Authorization Grant 示例（代理进程 / starship 类场景）
 *
 * 演示一个无浏览器环境（CLI / 守护进程 / 嵌入式 runtime）如何走 RFC 8628
 * device flow 接入 hezor2，把自己绑定为某个用户的 silicon_runtime。
 *
 * 完整流程
 * --------
 *  1. 设备调 `requestDeviceCode({ deviceId, ... })` 拿 device_code / user_code。
 *  2. 设备把 `verification_uri_complete` 显示给用户（终端 / QR / 屏幕）。
 *  3. 用户在浏览器打开 URL → 登录 → 同意 → 设备就被绑定到用户的 silicon_runtime。
 *  4. 设备同时调用 `pollDeviceToken({ deviceCode, expiresIn })`，
 *     直到拿到 access_token / refresh_token。
 *  5. 后续业务调用使用 access_token；过期前调 `refreshToken()` 续期。
 *
 * 与 starship 实际行为的对应
 * --------------------------
 * starship/internal/config/provision.go + tunnel.go 在没有 HEZOR_API_KEY 的情况下，
 * 走的就是这套流程；本 demo 用 SDK 在 Node 端复刻同一行为，便于第三方厂商
 * 用 TypeScript 自己实现 starship-like agent。
 *
 * Usage
 * -----
 *   npx tsx examples/oauth-device-flow.ts            # 完整跑（要交互）
 *   npx tsx examples/oauth-device-flow.ts --list
 *
 * 环境变量 (.env)
 * --------------
 *   HEZOR2_API_BASE_URL    后端地址
 *   OAUTH_CLIENT_ID        Casdoor Application.client_id（必填）
 *   OAUTH_DEVICE_ID        设备唯一指纹（必填，与 silicon_runtime.device_id 同来源）
 *   OAUTH_SCOPE            空格分隔 scope，可选
 *   OAUTH_HOSTNAME / OAUTH_OS / OAUTH_RUNTIME_KIND / OAUTH_VENDOR  可选元信息
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hostname as osHostname } from 'node:os'

import { OAuthClient, loadEnv } from '../src/index.js'
import { runExamples } from './_runner.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const config = loadEnv(join(__dirname, '.env'))

const CLIENT_ID = process.env['OAUTH_CLIENT_ID'] ?? ''
const DEVICE_ID =
  process.env['OAUTH_DEVICE_ID'] ?? `demo-${osHostname()}-${process.pid}`
const SCOPE =
  process.env['OAUTH_SCOPE'] ?? 'device:bind silicon:proxy base:llm-invoke'

function createClient(): OAuthClient {
  if (!CLIENT_ID) {
    throw new Error('OAUTH_CLIENT_ID not set')
  }
  return new OAuthClient({
    baseUrl: config.hezor2ApiBaseUrl,
    clientId: CLIENT_ID,
  })
}

// ── Examples ─────────────────────────────────────────────────────────────

async function fullDeviceFlow() {
  const client = createClient()

  console.log(`  client_id:  ${CLIENT_ID}`)
  console.log(`  device_id:  ${DEVICE_ID}`)
  console.log(`  scope:      ${SCOPE}\n`)

  console.log('  步骤 1：申请 device_code …')
  const deviceCodeResp = await client.requestDeviceCode({
    deviceId: DEVICE_ID,
    scope: SCOPE,
    hostname: process.env['OAUTH_HOSTNAME'] ?? osHostname(),
    os: process.env['OAUTH_OS'] ?? `${process.platform}/${process.arch}`,
    runtimeKind: process.env['OAUTH_RUNTIME_KIND'] ?? 'demo-cli',
    vendor: process.env['OAUTH_VENDOR'] ?? 'hezor2-sdk-demo',
  })

  console.log('  ✓ 已申请 device_code\n')
  console.log(`    user_code:                  ${deviceCodeResp.user_code}`)
  console.log(`    verification_uri:           ${deviceCodeResp.verification_uri}`)
  console.log(`    verification_uri_complete:  ${deviceCodeResp.verification_uri_complete}`)
  console.log(`    expires_in:                 ${deviceCodeResp.expires_in}s`)
  console.log(`    interval:                   ${deviceCodeResp.interval}s`)

  console.log('\n  ┌─────────────────────────────────────────────────────────┐')
  console.log('  │  请在浏览器打开下列 URL 完成授权：                       │')
  console.log('  │                                                          │')
  console.log(`  │  ${deviceCodeResp.verification_uri_complete.padEnd(56)}│`)
  console.log('  │                                                          │')
  console.log(`  │  或访问 ${deviceCodeResp.verification_uri.padEnd(34)}手动输入：    │`)
  console.log(`  │  ${deviceCodeResp.user_code.padEnd(56)}│`)
  console.log('  └─────────────────────────────────────────────────────────┘\n')

  console.log('  步骤 2：开始轮询 /oauth/token …（用户授权后立即返回）')
  try {
    const token = await client.pollDeviceToken({
      deviceCode: deviceCodeResp.device_code,
      interval: deviceCodeResp.interval,
      expiresIn: deviceCodeResp.expires_in,
      onPoll: ({ elapsed }) => {
        if (elapsed > 0 && elapsed % 15 === 0) {
          console.log(`    … 已等待 ${elapsed}s（最长 ${deviceCodeResp.expires_in}s）`)
        }
      },
    })
    console.log('\n  ✓ 用户已授权，拿到 token\n')
    console.log(`    access_token:  ${token.access_token.slice(0, 24)}…`)
    console.log(`    expires_in:    ${token.expires_in}s`)
    console.log(`    scope:         ${token.scope}`)
    if (token.refresh_token) {
      console.log(`    refresh_token: ${token.refresh_token.slice(0, 12)}…`)
      console.log('\n  保存 refresh_token，过期前用 client.refreshToken(rt) 续期；')
      console.log('  注销时调 client.revokeToken(rt, "refresh_token")。')
    }
  } catch (e) {
    if (e instanceof Error) {
      console.log(`\n  ✗ 失败：${e.name}: ${e.message}`)
    } else {
      console.log(`\n  ✗ 失败：${String(e)}`)
    }
  }
}

// ── Run ──────────────────────────────────────────────────────────────────

runExamples('oauth-device-flow', [
  { name: '完整 RFC 8628 device flow（申请 + 轮询 + 返回 token）', run: fullDeviceFlow },
])
