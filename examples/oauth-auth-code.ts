/**
 * OAuth 2.0 Authorization Code + PKCE 流程示例（第三方应用场景）
 *
 * 演示一个独立的"第三方应用"如何走标准 OAuth Auth Code + PKCE 流程
 * 接入 hezor2，代表用户访问 hezor2 资源。
 *
 * 完整流程（典型 Web 应用）
 * --------------------------
 *  1. 应用生成 PKCE pair + state，state/verifier 存到自己的 session。
 *  2. 应用把用户重定向到 hezor2 `/oauth/authorize?...`。
 *  3. 用户登录 + 同意，hezor2 302 回调到应用 `redirect_uri?code=...&state=...`。
 *  4. 应用校验 state，用 code + verifier 调 `OAuthClient.exchangeAuthorizationCode()`。
 *  5. 拿到 access_token / refresh_token，调用 hezor2 业务 API。
 *  6. access_token 过期前用 `refreshToken()` 续期；登出时调 `revokeToken()`。
 *
 * 本示例
 * ------
 * 由于 demo 跑在终端里没有真正的浏览器回跳，示例仅打印步骤 1–2 的产物
 * （PKCE pair + 跳转 URL），后续步骤需要在真实 Web 应用中接管。
 *
 * Usage
 * -----
 *   npx tsx examples/oauth-auth-code.ts            # 运行所有
 *   npx tsx examples/oauth-auth-code.ts 1          # 运行指定
 *   npx tsx examples/oauth-auth-code.ts --list     # 列出可用
 *
 * 环境变量 (.env)
 * --------------
 *   HEZOR2_API_BASE_URL    后端地址，必须含 /api/v1（默认 http://localhost:8000/api/v1）
 *   OAUTH_CLIENT_ID        Casdoor Application.client_id（必填）
 *   OAUTH_REDIRECT_URI     回调 URL，需在 application 的 redirect_uris 白名单内
 *   OAUTH_SCOPE            空格分隔 scope（可选）
 *   OAUTH_AUTH_CODE        步骤 4 用：从回调 URL 取的 code（可选，无则跳过）
 *   OAUTH_CODE_VERIFIER    步骤 4 用：步骤 1 生成并保存的 verifier（可选）
 *   OAUTH_REFRESH_TOKEN    步骤 6 用：refresh / revoke 测试（可选）
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  OAuthClient,
  generatePKCEPair,
  generateState,
  loadEnv,
} from '../src/index.js'
import { runExamples } from './_runner.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const config = loadEnv(join(__dirname, '.env'))

const CLIENT_ID = process.env['OAUTH_CLIENT_ID'] ?? ''
const REDIRECT_URI =
  process.env['OAUTH_REDIRECT_URI'] ?? 'http://localhost:3003/callback'
const SCOPE = process.env['OAUTH_SCOPE'] ?? 'base:user-info base:llm-invoke'

function createClient(): OAuthClient {
  if (!CLIENT_ID) {
    throw new Error('OAUTH_CLIENT_ID not set')
  }
  return new OAuthClient({
    baseUrl: config.hezor2ApiBaseUrl,
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
  })
}

// ── Examples ─────────────────────────────────────────────────────────────

async function buildAuthorizeUrl() {
  const client = createClient()
  const pkce = await generatePKCEPair()
  const state = generateState()
  const url = client.buildAuthorizeUrl({
    state,
    codeChallenge: pkce.code_challenge,
    scope: SCOPE,
  })

  console.log('  ✓ 生成 PKCE 与跳转 URL\n')
  console.log(`  client_id:      ${CLIENT_ID}`)
  console.log(`  redirect_uri:   ${REDIRECT_URI}`)
  console.log(`  scope:          ${SCOPE}`)
  console.log(`  state:          ${state}`)
  console.log(`  code_challenge: ${pkce.code_challenge}`)
  console.log(`  code_verifier:  ${pkce.code_verifier}  ← 务必妥善保存`)
  console.log(`\n  跳转 URL:\n  ${url}`)
  console.log('\n  ↑ 在浏览器中打开此 URL 完成授权；同意后回跳到 redirect_uri?code=...&state=...')
  console.log('  应用应校验 state 与本次会话一致，再用 code + code_verifier 走 example 2。')
}

async function exchangeCodeForToken() {
  const code = process.env['OAUTH_AUTH_CODE']
  const verifier = process.env['OAUTH_CODE_VERIFIER']
  if (!code || !verifier) {
    console.log('  跳过：未设置 OAUTH_AUTH_CODE / OAUTH_CODE_VERIFIER。')
    console.log('  完成 example 1 跳转 + 用户授权后，从回调 URL 取 code 再跑：')
    console.log('    OAUTH_AUTH_CODE=xxx OAUTH_CODE_VERIFIER=yyy npx tsx examples/oauth-auth-code.ts 2')
    return
  }
  const client = createClient()
  try {
    const token = await client.exchangeAuthorizationCode({
      code,
      codeVerifier: verifier,
    })
    console.log('  ✓ 换 token 成功\n')
    console.log(`    access_token:  ${token.access_token.slice(0, 24)}…`)
    console.log(`    token_type:    ${token.token_type}`)
    console.log(`    expires_in:    ${token.expires_in}s`)
    console.log(`    scope:         ${token.scope}`)
    if (token.refresh_token) {
      console.log(`    refresh_token: ${token.refresh_token.slice(0, 12)}…`)
    }
  } catch (e) {
    console.log(`  ✗ 失败: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`)
  }
}

async function refreshAndRevoke() {
  const refresh = process.env['OAUTH_REFRESH_TOKEN']
  if (!refresh) {
    console.log('  跳过：未设置 OAUTH_REFRESH_TOKEN。')
    return
  }
  const client = createClient()
  try {
    const refreshed = await client.refreshToken(refresh)
    console.log('  ✓ 刷新成功')
    console.log(`    access_token: ${refreshed.access_token.slice(0, 24)}…`)
    console.log(`    new refresh:  ${refreshed.refresh_token?.slice(0, 12) ?? '(unchanged)'}…`)

    await client.revokeToken(refreshed.refresh_token ?? refresh, 'refresh_token')
    console.log('  ✓ 已调用 /oauth/revoke（RFC 7009 始终 200）')
  } catch (e) {
    console.log(`  ✗ 失败: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`)
  }
}

// ── Run ──────────────────────────────────────────────────────────────────

runExamples('oauth-auth-code', [
  { name: '步骤 1–2：生成 PKCE 与 /oauth/authorize 跳转 URL', run: buildAuthorizeUrl },
  { name: '步骤 4：用 code + code_verifier 换 token', run: exchangeCodeForToken },
  { name: '步骤 6：refresh + revoke', run: refreshAndRevoke },
])
