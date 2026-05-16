/**
 * OAuth 2.0 客户端封装。
 *
 * 覆盖 hezor2 后端 `/oauth/*` 端点的两类用法：
 *
 * 1. **Authorization Code + PKCE（第三方应用）**
 *    浏览器 / 服务器跳转用户到 hezor2 `/oauth/authorize` → 用户同意后 302
 *    回调到应用的 `redirect_uri?code=...&state=...` → 应用以 code 换 token。
 *    适合"代表用户访问 hezor2"的标准 OAuth 场景。
 *
 * 2. **Device Authorization Grant / RFC 8628（代理进程 / starship 类）**
 *    设备（无浏览器）申请 device_code + user_code，提示用户在浏览器输入
 *    user_code 完成授权，设备端轮询 `/oauth/token` 拿 token。
 *    适合 starship / CLI / 嵌入式 runtime 等无浏览器环境。
 *
 * 两种流程都支持 `refresh_token` 续期与 RFC 7009 `revoke`。
 *
 * 协议端点（hezor2 后端）
 * ----------------------
 * - `GET  /oauth/authorize`            浏览器跳转入口（Auth Code 模式）
 * - `POST /oauth/device/code`          设备申请 device_code（Device Flow 模式）
 * - `POST /oauth/token`                code/refresh/device_code 三种 grant_type 换 token
 * - `POST /oauth/revoke`               撤销 refresh_token（RFC 7009）
 *
 * Examples
 * --------
 * 见 `examples/oauth-auth-code.ts` 与 `examples/oauth-device-flow.ts`。
 */

import { OAuthError, OAuthInvalidGrantError } from './errors.js'
import { normalizeBaseUrl } from './utils/base-url.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RFC 8628 device_code grant_type URN。 */
export const DEVICE_CODE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code'

/** RFC 8628 §3.5 设备端轮询时的可重试错误码。 */
const DEVICE_FLOW_RETRYABLE_ERRORS = new Set(['authorization_pending', 'slow_down'])

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** OAuth 2.0 token 响应（与后端 `TokenResponse` 对齐）。 */
export interface OAuthTokenResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  refresh_token?: string
  scope: string
}

/** RFC 8628 device_code 响应（与后端 `DeviceCodeResponse` 对齐）。 */
export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete: string
  expires_in: number
  interval: number
}

/** PKCE code_verifier / code_challenge 对（S256）。 */
export interface PKCEPair {
  code_verifier: string
  code_challenge: string
  code_challenge_method: 'S256'
}

/** OAuth 客户端构造参数。 */
export interface OAuthClientOptions {
  /**
   * hezor2 API base URL，**必须包含 `/api/v1` 前缀**（例如
   * `https://hezor.ai/api/v1` 或 `http://localhost:8000/api/v1`，不含末尾 `/`）。
   * SDK 内部按 `${baseUrl}/oauth/authorize` 等方式拼接，不会再补 `/api/v1`。
   */
  baseUrl: string
  /** 当前应用的 client_id（Casdoor Application.client_id）。 */
  clientId: string
  /** Auth Code 模式默认 redirect_uri；可在调用时覆盖。 */
  redirectUri?: string
  /** 单次请求超时毫秒数（默认 30s）。 */
  timeout?: number
  /** 自定义 fetch（便于注入代理 / mock）。 */
  fetch?: typeof globalThis.fetch
}

/** `buildAuthorizeUrl` 参数。 */
export interface BuildAuthorizeUrlOptions {
  /** 防 CSRF 随机串；调用方负责生成与会话绑定校验。 */
  state: string
  /** PKCE code_challenge（S256）。 */
  codeChallenge: string
  /** 空格分隔 scope；可选。 */
  scope?: string
  /** 覆盖默认 redirect_uri。 */
  redirectUri?: string
}

/** `exchangeAuthorizationCode` 参数。 */
export interface ExchangeAuthorizationCodeOptions {
  code: string
  codeVerifier: string
  redirectUri?: string
}

/** `requestDeviceCode` 参数（Hezor 在 RFC 8628 上的扩展字段）。 */
export interface RequestDeviceCodeOptions {
  /** 设备唯一指纹，与 `silicon_runtime.device_id` 同来源。 */
  deviceId: string
  /** 空格分隔 scope；不传时后端回退应用 default_scopes。 */
  scope?: string
  hostname?: string
  os?: string
  runtimeKind?: string
  vendor?: string
}

/** `pollDeviceToken` 参数。 */
export interface PollDeviceTokenOptions {
  deviceCode: string
  /**
   * 轮询间隔（秒）。**调用方应显式传入 `requestDeviceCode()` 返回的 `interval`**；
   * 未传时退化为 `5` 秒。遇 `slow_down` 自动 +5s（RFC 8628 §3.5）。
   */
  interval?: number
  /** 最长轮询时间（秒），通常传 device_code 响应里的 `expires_in`。 */
  expiresIn: number
  /** 每次轮询前回调，便于调用方打印进度或主动中止（返回 `false` 终止）。 */
  onPoll?: (info: { elapsed: number; nextInterval: number }) => boolean | void
}

// ---------------------------------------------------------------------------
// PKCE helpers（S256）
// ---------------------------------------------------------------------------

const PKCE_VERIFIER_LENGTH = 64

function base64UrlEncode(bytes: Uint8Array): string {
  // 浏览器优先走 globalThis.btoa；Node 18+ 用 Buffer 兜底。
  // 避免 ESLint no-undef 误报：通过 globalThis 显式访问 btoa。
  let b64: string
  const g = globalThis as { btoa?: (s: string) => string }
  if (typeof g.btoa === 'function') {
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]!)
    }
    b64 = g.btoa(binary)
  } else {
    b64 = Buffer.from(bytes).toString('base64')
  }
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * 生成 PKCE code_verifier / code_challenge 对。
 *
 * `code_verifier`：43–128 字符的 URL-safe 随机串（按 RFC 7636 §4.1）；
 * `code_challenge`：`BASE64URL(SHA256(code_verifier))`，固定 S256 method。
 */
export async function generatePKCEPair(): Promise<PKCEPair> {
  const cryptoObj = globalThis.crypto
  if (!cryptoObj?.subtle) {
    throw new Error('Web Crypto API unavailable; require Node >=18 or modern browser')
  }
  const verifierBytes = new Uint8Array(PKCE_VERIFIER_LENGTH)
  cryptoObj.getRandomValues(verifierBytes)
  const code_verifier = base64UrlEncode(verifierBytes)

  const digest = await cryptoObj.subtle.digest('SHA-256', new TextEncoder().encode(code_verifier))
  const code_challenge = base64UrlEncode(new Uint8Array(digest))

  return { code_verifier, code_challenge, code_challenge_method: 'S256' }
}

/** 生成防 CSRF `state` 串（22 字符 URL-safe）。 */
export function generateState(): string {
  const cryptoObj = globalThis.crypto
  if (!cryptoObj) {
    throw new Error('crypto unavailable')
  }
  const bytes = new Uint8Array(16)
  cryptoObj.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

// ---------------------------------------------------------------------------
// OAuthClient
// ---------------------------------------------------------------------------

/**
 * Hezor OAuth 2.0 客户端封装。
 *
 * 同一实例可同时承载 Auth Code 与 Device Flow 两套流程；按调用方法区分。
 */
export class OAuthClient {
  readonly baseUrl: string
  readonly clientId: string
  readonly redirectUri: string | undefined
  readonly timeout: number
  private readonly fetchImpl: typeof globalThis.fetch

  constructor(options: OAuthClientOptions) {
    if (!options.clientId) throw new Error('clientId required')
    this.baseUrl = normalizeBaseUrl(options.baseUrl)
    this.clientId = options.clientId
    this.redirectUri = options.redirectUri
    this.timeout = options.timeout ?? 30_000
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis)
  }

  // -------------------------------------------------------------------------
  // Authorization Code + PKCE（第三方应用）
  // -------------------------------------------------------------------------

  /**
   * 拼接 `/oauth/authorize` URL，调用方将用户重定向到此 URL 即可。
   *
   * 调用方必须先 `generatePKCEPair()`，将 `code_verifier` 缓存于自己的 session
   * （后续换 token 时使用），将 `code_challenge` 传入本方法。
   */
  buildAuthorizeUrl(options: BuildAuthorizeUrlOptions): string {
    const redirectUri = options.redirectUri ?? this.redirectUri
    if (!redirectUri) {
      throw new Error('redirectUri required (constructor or per-call)')
    }
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      state: options.state,
      redirect_uri: redirectUri,
      code_challenge: options.codeChallenge,
      code_challenge_method: 'S256',
    })
    if (options.scope) params.set('scope', options.scope)
    return `${this.baseUrl}/oauth/authorize?${params.toString()}`
  }

  /**
   * 用授权码换 token（grant_type=authorization_code）。
   *
   * @throws {OAuthInvalidGrantError} code 已过期或已使用。
   * @throws {OAuthError}             其它 OAuth 错误（按 `error` 字段映射）。
   */
  async exchangeAuthorizationCode(
    options: ExchangeAuthorizationCodeOptions,
  ): Promise<OAuthTokenResponse> {
    const redirectUri = options.redirectUri ?? this.redirectUri
    if (!redirectUri) {
      throw new Error('redirectUri required (constructor or per-call)')
    }
    return this.tokenRequest({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      code: options.code,
      redirect_uri: redirectUri,
      code_verifier: options.codeVerifier,
    })
  }

  // -------------------------------------------------------------------------
  // Device Authorization Grant（代理进程 / starship 类）
  // -------------------------------------------------------------------------

  /**
   * 申请 device_code + user_code（RFC 8628 §3.1）。
   *
   * 拿到响应后，应将 `verification_uri_complete` 显示给用户（终端打印 / 二维码），
   * 并立即调用 `pollDeviceToken({ deviceCode })` 等待用户授权。
   */
  async requestDeviceCode(options: RequestDeviceCodeOptions): Promise<DeviceCodeResponse> {
    const body: Record<string, unknown> = {
      client_id: this.clientId,
      device_id: options.deviceId,
    }
    // 仅在显式传入时下发 scope；空串与未传在后端语义不同，前者会跳过
    // application.default_scopes 兜底，后者不会。
    if (options.scope) body['scope'] = options.scope
    if (options.hostname) body['hostname'] = options.hostname
    if (options.os) body['os'] = options.os
    if (options.runtimeKind) body['runtime_kind'] = options.runtimeKind
    if (options.vendor) body['vendor'] = options.vendor

    const resp = await this.fetchWithTimeout(`${this.baseUrl}/oauth/device/code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return this.parseJsonOrThrow<DeviceCodeResponse>(resp)
  }

  /**
   * 轮询 `/oauth/token` 直到用户授权 / 拒绝 / device_code 过期。
   *
   * - `authorization_pending` → 等待 `interval` 后重试。
   * - `slow_down` → `interval += 5`，再等待重试（RFC 8628 §3.5）。
   * - 其它 OAuth 错误 → 抛 `OAuthError`（含 `access_denied` / `expired_token`）。
   * - 成功 → 返回 `OAuthTokenResponse`。
   */
  async pollDeviceToken(options: PollDeviceTokenOptions): Promise<OAuthTokenResponse> {
    let interval = options.interval ?? 5
    const start = Date.now()
    const deadlineMs = start + options.expiresIn * 1000

    while (true) {
      const elapsed = Math.floor((Date.now() - start) / 1000)
      const cont = options.onPoll?.({ elapsed, nextInterval: interval })
      if (cont === false) {
        // 用独立 code 区分"调用方主动中止" vs RFC 6749 的 access_denied
        // （后者代表用户在浏览器上点了拒绝）。
        throw new OAuthError({
          code: 'polling_aborted',
          detail: 'polling aborted by caller',
          statusCode: 499,
        })
      }
      if (Date.now() >= deadlineMs) {
        throw new OAuthError({
          code: 'expired_token',
          detail: 'device_code expired before user approval',
          statusCode: 400,
        })
      }
      try {
        return await this.tokenRequest({
          grant_type: DEVICE_CODE_GRANT_TYPE,
          client_id: this.clientId,
          device_code: options.deviceCode,
        })
      } catch (e) {
        // OAuth 协议层可重试错误（authorization_pending / slow_down）。
        if (e instanceof OAuthError && DEVICE_FLOW_RETRYABLE_ERRORS.has(e.code)) {
          if (e.code === 'slow_down') interval += 5
        } else if (isTransientNetworkError(e)) {
          // 网络抖动 / 单次请求超时（AbortError）按 RFC 8628 容错预期：继续轮询。
          // 不调整 interval，沿用当前值。
        } else {
          throw e
        }
        // sleep 不超过剩余 deadline，避免超时判定滞后一个 interval。
        const remainingMs = deadlineMs - Date.now()
        if (remainingMs <= 0) continue
        await sleep(Math.min(interval * 1000, remainingMs))
        continue
      }
    }
  }

  // -------------------------------------------------------------------------
  // refresh / revoke（两类流程通用）
  // -------------------------------------------------------------------------

  /** 用 refresh_token 续期（grant_type=refresh_token）。 */
  async refreshToken(refreshToken: string): Promise<OAuthTokenResponse> {
    return this.tokenRequest({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      refresh_token: refreshToken,
    })
  }

  /**
   * 撤销 refresh_token（RFC 7009）。
   *
   * 后端始终返回 200（除非 `invalid_client`），无需关心是否实际命中。
   */
  async revokeToken(
    token: string,
    tokenTypeHint?: 'refresh_token' | 'access_token',
  ): Promise<void> {
    const form = new URLSearchParams({ token, client_id: this.clientId })
    if (tokenTypeHint) form.set('token_type_hint', tokenTypeHint)
    const resp = await this.fetchWithTimeout(`${this.baseUrl}/oauth/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    if (!resp.ok) {
      await this.throwFromErrorResponse(resp)
    }
  }

  // -------------------------------------------------------------------------
  // 内部
  // -------------------------------------------------------------------------

  private async tokenRequest(fields: Record<string, string>): Promise<OAuthTokenResponse> {
    const form = new URLSearchParams(fields)
    const resp = await this.fetchWithTimeout(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    return this.parseJsonOrThrow<OAuthTokenResponse>(resp)
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)
    try {
      return await this.fetchImpl(url, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }
  }

  private async parseJsonOrThrow<T>(resp: Response): Promise<T> {
    if (!resp.ok) {
      await this.throwFromErrorResponse(resp)
    }
    return (await resp.json()) as T
  }

  private async throwFromErrorResponse(resp: Response): Promise<never> {
    let code = 'oauth_error'
    let detail = `HTTP ${resp.status}`
    try {
      const body = (await resp.json()) as {
        error?: string
        error_description?: string
        detail?: { error?: string; error_description?: string } | string
      }
      // FastAPI 默认把 HTTPException(detail=...) 包成 { detail: ... }；
      // 后端在 oauth.py 里 detail = {"error": ..., "error_description": ...}。
      if (typeof body?.detail === 'object' && body.detail) {
        code = body.detail.error ?? code
        detail = body.detail.error_description ?? detail
      } else if (body?.error) {
        code = body.error
        detail = body.error_description ?? detail
      } else if (typeof body?.detail === 'string') {
        detail = body.detail
      }
    } catch {
      // 非 JSON 响应，沿用 HTTP 状态。
    }
    if (code === 'invalid_grant') {
      throw new OAuthInvalidGrantError(detail)
    }
    throw new OAuthError({ code, detail, statusCode: resp.status })
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 判定一个异常是否为"瞬时网络错误"（应在 device flow 轮询里被吞掉重试）。
 *
 * 覆盖：
 * - `AbortError`（fetchWithTimeout 单次超时触发的 AbortController）
 * - `TypeError`（fetch API 在网络层失败时的标准抛出，例如 DNS / 连接重置）
 * - 节点 `FetchError` / `undici` 错误的常见 `code`（ECONNRESET / ETIMEDOUT / ENOTFOUND 等）
 */
function isTransientNetworkError(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  if (e.name === 'AbortError' || e.name === 'TimeoutError') return true
  if (e.name === 'TypeError' && /fetch|network/i.test(e.message)) return true
  const code = (e as Error & { code?: string }).code
  if (code && /^(ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|UND_ERR)/.test(code)) {
    return true
  }
  return false
}
