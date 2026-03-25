/**
 * 微信 OAuth 扫码登录使用示例
 *
 * 演示通过 SDK 发起微信 OAuth 扫码登录的完整流程：
 * 1. 获取登录二维码 URL 和轮询 key
 * 2. 轮询扫码状态获取 OpenID
 *
 * 注意：WeChat 相关接口不需要 API Key 认证。
 *
 * Usage:
 *   npx tsx examples/wechat-login.ts        # 运行所有
 *   npx tsx examples/wechat-login.ts 1      # 运行指定
 *   npx tsx examples/wechat-login.ts --list # 列出可用
 */

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Hezor2APIClient, loadEnv } from '../src/index.js'
import { runExamples } from './_runner.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const config = loadEnv(join(__dirname, '.env'))

/**
 * 创建无需认证的 API 客户端（WeChat 接口为公开接口）。
 */
function createClient(): Hezor2APIClient {
  return new Hezor2APIClient({
    baseUrl: config.hezor2ApiBaseUrl,
  })
}

/**
 * 示例 1：获取微信扫码登录 URL
 *
 * 调用 wechatLoginUrl 获取用于展示二维码的 URL 和轮询用的 key。
 */
async function getLoginUrl() {
  const client = createClient()
  const redirect = 'https://example.com/callback'

  console.log(`  redirect: ${redirect}\n`)

  try {
    const result = await client.wechatLoginUrl(redirect)

    console.log(`  ✓ url: ${result.url}`)
    console.log(`  ✓ key: ${result.key}`)
    console.log()
    console.log('  用浏览器打开 url 可以看到微信扫码二维码，')
    console.log('  用 key 轮询 poll-openid 直到获取 openid。')
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

/**
 * 示例 2：获取登录 URL（不传 redirect）
 *
 * redirect 参数是可选的，不传时由服务端使用默认回调地址。
 */
async function getLoginUrlNoRedirect() {
  const client = createClient()

  console.log('  redirect: (不传，使用服务端默认值)\n')

  try {
    const result = await client.wechatLoginUrl()

    console.log(`  ✓ url: ${result.url}`)
    console.log(`  ✓ key: ${result.key}`)
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

/**
 * 示例 3：轮询扫码状态
 *
 * 先获取 login URL 和 key，然后用 key 轮询一次获取当前状态。
 * 实际使用中应循环轮询直到 status 为 "success" 或 "expired"。
 */
async function pollOpenid() {
  const client = createClient()

  try {
    // 第一步：获取 key
    const loginResult = await client.wechatLoginUrl()
    console.log(`  ✓ 获取 key: ${loginResult.key}\n`)

    // 第二步：用 key 轮询
    console.log('  正在轮询扫码状态...\n')
    const pollResult = await client.wechatPollOpenid(loginResult.key)

    console.log(`  ✓ status:  ${pollResult.status}`)
    if (pollResult.openid) {
      console.log(`  ✓ openid:  ${pollResult.openid}`)
    }
    if (pollResult.message) {
      console.log(`  ✓ message: ${pollResult.message}`)
    }

    console.log()
    console.log('  status 说明：')
    console.log('    waiting — 等待扫码')
    console.log('    success — 扫码成功，openid 已返回')
    console.log('    expired — key 已过期，需重新获取')
    console.log('    error   — 发生错误')
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

/**
 * 示例 4：完整的轮询循环（带超时）
 *
 * 演示实际业务中的轮询逻辑：每 2 秒查询一次，最多等待 60 秒。
 */
async function pollLoop() {
  const client = createClient()
  const POLL_INTERVAL_MS = 2000
  const TIMEOUT_MS = 60000
  const PER_REQUEST_TIMEOUT_MS = 10000

  try {
    const loginResult = await client.wechatLoginUrl()
    console.log(`  ✓ url: ${loginResult.url}`)
    console.log(`  ✓ key: ${loginResult.key}`)
    console.log()
    console.log(`  开始轮询（间隔 ${POLL_INTERVAL_MS / 1000}s，超时 ${TIMEOUT_MS / 1000}s，单次请求超时 ${PER_REQUEST_TIMEOUT_MS / 1000}s）...`)
    console.log('  （在实际应用中，此时应展示二维码供用户扫描）\n')

    const start = Date.now()

    while (Date.now() - start < TIMEOUT_MS) {
      const result = await client.wechatPollOpenid(loginResult.key, {
        timeout: PER_REQUEST_TIMEOUT_MS,
      })
      const elapsed = ((Date.now() - start) / 1000).toFixed(1)

      if (result.status === 'success') {
        console.log(`  ✓ [${elapsed}s] 扫码成功！openid: ${result.openid}`)
        return
      }

      if (result.status === 'expired' || result.status === 'error') {
        console.log(`  ✗ [${elapsed}s] ${result.status}: ${result.message ?? '(无消息)'}`)
        return
      }

      console.log(`  … [${elapsed}s] ${result.status}`)
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }

    console.log('  ⚠ 轮询超时（客户端超时，非 key 过期）')
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

runExamples('wechat-login', [
  { name: '获取微信扫码登录 URL（带 redirect）', run: getLoginUrl },
  { name: '获取微信扫码登录 URL（不传 redirect）', run: getLoginUrlNoRedirect },
  { name: '单次轮询扫码状态', run: pollOpenid },
  { name: '完整轮询循环（带超时退出）', run: pollLoop },
])
