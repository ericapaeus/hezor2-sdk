/**
 * OAuth 端到端集成测试（mock-server 方案）
 *
 * 覆盖目标：
 *  - Auth Code + PKCE 完整链路：buildAuthorizeUrl → exchangeAuthorizationCode
 *    → refreshToken → revokeToken
 *  - Device Flow 完整链路：requestDeviceCode → pollDeviceToken（pending → success）
 *  - 主要错误码映射：invalid_client / invalid_grant / invalid_scope / expired_token
 *  - hezor2 HTTP_ERROR envelope 拆包
 *
 * 实现策略：
 *  - 不引入额外依赖；使用 vi.fn() 构建按顺序返回响应的 mock fetch。
 *  - 每个 test 拥有独立的 mock 实例，互不干扰。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  OAuthClient,
  OAuthError,
  OAuthInvalidGrantError,
  generatePKCEPair,
  generateState,
  type OAuthTokenResponse,
  type DeviceCodeResponse,
} from '@hezor/hezor2-sdk'

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

const BASE_URL = 'http://hezor2.e2e/api/v1'
const CLIENT_ID = 'e2e-client'
const REDIRECT_URI = 'http://app.e2e/callback'

const TOKEN_RESP: OAuthTokenResponse = {
  access_token: 'at_e2e_access',
  token_type: 'Bearer',
  expires_in: 3600,
  refresh_token: 'rt_e2e_refresh',
  scope: 'base:user-info',
}

const REFRESHED_TOKEN_RESP: OAuthTokenResponse = {
  access_token: 'at_e2e_refreshed',
  token_type: 'Bearer',
  expires_in: 3600,
  refresh_token: 'rt_e2e_new',
  scope: 'base:user-info',
}

const DEVICE_CODE_RESP: DeviceCodeResponse = {
  device_code: 'dc_e2e_device',
  user_code: 'E2E1-TEST',
  verification_uri: `${BASE_URL}/oauth/device`,
  verification_uri_complete: `${BASE_URL}/oauth/device?user_code=E2E1-TEST`,
  expires_in: 600,
  interval: 5,
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function oauthErrorResp(
  status: number,
  error: string,
  description?: string,
): Response {
  return jsonResp({ detail: { error, error_description: description } }, status)
}

/** 依次返回 responses 数组中的每个元素；超出时抛出错误，防止掩盖意外的额外 fetch 调用。 */
function sequentialFetch(responses: Response[]): typeof globalThis.fetch {
  let idx = 0
  return vi.fn().mockImplementation(() => {
    const resp = responses[idx++]
    if (!resp) {
      throw new Error(
        `sequentialFetch: unexpected call #${idx} — only ${responses.length} response(s) configured`,
      )
    }
    return Promise.resolve(resp)
  }) as unknown as typeof globalThis.fetch
}

function newClient(fetchImpl: typeof globalThis.fetch): OAuthClient {
  return new OAuthClient({
    baseUrl: BASE_URL,
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    fetch: fetchImpl,
  })
}

// ---------------------------------------------------------------------------
// 1. Auth Code + PKCE — 完整链路
// ---------------------------------------------------------------------------

describe('E2E: Auth Code + PKCE 完整链路', () => {
  it('buildAuthorizeUrl → exchangeAuthorizationCode → refreshToken → revokeToken', async () => {
    const fetchMock = sequentialFetch([
      jsonResp(TOKEN_RESP),          // exchangeAuthorizationCode
      jsonResp(REFRESHED_TOKEN_RESP), // refreshToken
      new Response(null, { status: 200 }), // revokeToken
    ])
    const client = newClient(fetchMock)

    // 步骤 1：生成 PKCE + state（纯计算，不走网络）
    const pkce = await generatePKCEPair()
    const state = generateState()
    expect(pkce.code_challenge_method).toBe('S256')
    expect(state).toMatch(/^[A-Za-z0-9_-]{20,24}$/)

    // 步骤 2：buildAuthorizeUrl（纯 URL 拼接，不走网络）
    const authUrl = client.buildAuthorizeUrl({
      state,
      codeChallenge: pkce.code_challenge,
      scope: 'base:user-info',
    })
    const parsed = new URL(authUrl)
    expect(parsed.pathname).toContain('/oauth/authorize')
    expect(parsed.searchParams.get('client_id')).toBe(CLIENT_ID)
    expect(parsed.searchParams.get('state')).toBe(state)
    expect(parsed.searchParams.get('code_challenge')).toBe(pkce.code_challenge)

    // 步骤 3：exchangeAuthorizationCode（POST /oauth/token）
    const token = await client.exchangeAuthorizationCode({
      code: 'auth_code_from_redirect',
      codeVerifier: pkce.code_verifier,
    })
    expect(token.access_token).toBe(TOKEN_RESP.access_token)
    expect(token.refresh_token).toBe(TOKEN_RESP.refresh_token)

    // 步骤 4：refreshToken（POST /oauth/token，grant_type=refresh_token）
    const refreshed = await client.refreshToken(token.refresh_token!)
    expect(refreshed.access_token).toBe(REFRESHED_TOKEN_RESP.access_token)

    // 步骤 5：revokeToken（POST /oauth/revoke）
    await expect(
      client.revokeToken(refreshed.refresh_token!, 'refresh_token'),
    ).resolves.toBeUndefined()

    // 确认所有 3 次网络请求均被触发
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const calls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls
    expect(calls[0]![0]).toContain('/oauth/token')
    expect(calls[1]![0]).toContain('/oauth/token')
    expect(calls[2]![0]).toContain('/oauth/revoke')
  })
})

// ---------------------------------------------------------------------------
// 2. Device Flow — 完整链路
// ---------------------------------------------------------------------------

describe('E2E: Device Flow 完整链路', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('requestDeviceCode → pollDeviceToken（pending × 1 → success）', async () => {
    const fetchMock = sequentialFetch([
      jsonResp(DEVICE_CODE_RESP),                               // requestDeviceCode
      oauthErrorResp(400, 'authorization_pending', 'waiting'),  // pollDeviceToken 第 1 次
      jsonResp(TOKEN_RESP),                                      // pollDeviceToken 第 2 次（成功）
    ])
    const client = newClient(fetchMock)

    // 步骤 1：申请 device_code
    const deviceResp = await client.requestDeviceCode({
      deviceId: 'e2e-device-001',
      scope: 'device:bind',
      hostname: 'e2e-host',
      os: 'linux/amd64',
      runtimeKind: 'starship',
      vendor: 'hezor',
    })
    expect(deviceResp.device_code).toBe(DEVICE_CODE_RESP.device_code)
    expect(deviceResp.user_code).toBe(DEVICE_CODE_RESP.user_code)
    expect(deviceResp.verification_uri).toContain('/oauth/device')

    // 步骤 2：轮询直到授权完成
    const pollPromise = client.pollDeviceToken({
      deviceCode: deviceResp.device_code,
      expiresIn: 600,
      interval: 5,
    })

    // poll #1 立即执行 → authorization_pending → sleep 5s → poll #2 → success
    await vi.advanceTimersByTimeAsync(5_000)

    const finalToken = await pollPromise
    expect(finalToken.access_token).toBe(TOKEN_RESP.access_token)

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('slow_down → interval 增加 5s 后重试，最终成功', async () => {
    const fetchMock = sequentialFetch([
      jsonResp(DEVICE_CODE_RESP),                      // requestDeviceCode
      oauthErrorResp(400, 'slow_down', 'too fast'),   // poll #1 → slow_down（interval: 5→10）
      jsonResp(TOKEN_RESP),                             // poll #2 → success
    ])
    const client = newClient(fetchMock)

    await client.requestDeviceCode({ deviceId: 'dev', scope: 'device:bind' })

    const pollPromise = client.pollDeviceToken({
      deviceCode: DEVICE_CODE_RESP.device_code,
      expiresIn: 600,
      interval: 5,
    })

    // poll #1 立即执行 → slow_down → interval 变为 10s → sleep 10s → poll #2 → success
    await vi.advanceTimersByTimeAsync(10_000)

    const token = await pollPromise
    expect(token.access_token).toBe(TOKEN_RESP.access_token)
    expect(fetchMock).toHaveBeenCalledTimes(3) // requestDeviceCode + poll ×2
  })

  it('access_denied → OAuthError { code: "access_denied" }（用户在浏览器拒绝）', async () => {
    const fetchMock = sequentialFetch([
      oauthErrorResp(400, 'access_denied', 'user denied access'),
    ])
    const client = newClient(fetchMock)

    // poll #1 立即执行，返回 access_denied，属于不可重试错误，直接抛出
    await expect(
      client.pollDeviceToken({
        deviceCode: 'dc_denied',
        expiresIn: 600,
        interval: 5,
      }),
    ).rejects.toMatchObject({ name: 'OAuthError', code: 'access_denied' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('onPoll 返回 false → polling_aborted（调用方主动中止）', async () => {
    // onPoll 在每次迭代开始时（fetch 之前）被调用；首次返回 false 即中止，不发任何请求
    const fetchMock = sequentialFetch([])
    const client = newClient(fetchMock)

    await expect(
      client.pollDeviceToken({
        deviceCode: 'dc_abort',
        expiresIn: 600,
        interval: 5,
        onPoll: () => false,
      }),
    ).rejects.toMatchObject({
      name: 'OAuthError',
      code: 'polling_aborted',
      statusCode: 499,
    })

    expect(fetchMock).toHaveBeenCalledTimes(0)
  })
})

// ---------------------------------------------------------------------------
// 3. 错误码映射 — invalid_client
// ---------------------------------------------------------------------------

describe('E2E: 错误码映射', () => {
  it('invalid_client → OAuthError { code: "invalid_client" }', async () => {
    const client = newClient(
      sequentialFetch([oauthErrorResp(400, 'invalid_client', 'client disabled')]),
    )
    await expect(
      client.exchangeAuthorizationCode({ code: 'x', codeVerifier: 'y' }),
    ).rejects.toMatchObject({ name: 'OAuthError', code: 'invalid_client' })
  })

  it('invalid_grant → OAuthInvalidGrantError', async () => {
    const client = newClient(
      sequentialFetch([oauthErrorResp(400, 'invalid_grant', 'code expired')]),
    )
    await expect(
      client.exchangeAuthorizationCode({ code: 'stale', codeVerifier: 'v' }),
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
  })

  it('invalid_scope → OAuthError { code: "invalid_scope" }', async () => {
    const client = newClient(
      sequentialFetch([oauthErrorResp(400, 'invalid_scope', 'scope not allowed')]),
    )
    await expect(
      client.exchangeAuthorizationCode({ code: 'c', codeVerifier: 'v' }),
    ).rejects.toMatchObject({ name: 'OAuthError', code: 'invalid_scope' })
  })

  it('device flow expired_token → OAuthError { code: "expired_token" }', async () => {
    vi.useFakeTimers()
    try {
      // expiresIn=0 使 pollDeviceToken 在首次 loop 前就超时
      const client = newClient(sequentialFetch([]))
      await expect(
        client.pollDeviceToken({ deviceCode: 'dc', expiresIn: 0, interval: 5 }),
      ).rejects.toMatchObject({ name: 'OAuthError', code: 'expired_token' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('hezor2 HTTP_ERROR envelope 拆包', async () => {
    const envelope = {
      error: 'HTTP_ERROR',
      status_code: 400,
      path: '/api/v1/oauth/token',
      message: { error: 'invalid_client', error_description: 'oauth disabled' },
    }
    const client = newClient(
      sequentialFetch([
        new Response(JSON.stringify(envelope), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      ]),
    )
    await expect(
      client.exchangeAuthorizationCode({ code: 'x', codeVerifier: 'y' }),
    ).rejects.toMatchObject({
      name: 'OAuthError',
      code: 'invalid_client',
      detail: 'oauth disabled',
    })
  })
})

// ---------------------------------------------------------------------------
// 4. refresh + revoke 独立场景
// ---------------------------------------------------------------------------

describe('E2E: refreshToken + revokeToken', () => {
  it('refresh → revoke 两步完成 token 轮换与撤销', async () => {
    const fetchMock = sequentialFetch([
      jsonResp(REFRESHED_TOKEN_RESP),
      new Response(null, { status: 200 }),
    ])
    const client = newClient(fetchMock)

    const refreshed = await client.refreshToken('rt_old')
    expect(refreshed.access_token).toBe(REFRESHED_TOKEN_RESP.access_token)

    await client.revokeToken(refreshed.refresh_token!, 'refresh_token')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const calls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls
    const refreshBody = new URLSearchParams(calls[0]![1].body as string)
    expect(refreshBody.get('grant_type')).toBe('refresh_token')
    expect(refreshBody.get('refresh_token')).toBe('rt_old')

    const revokeBody = new URLSearchParams(calls[1]![1].body as string)
    expect(revokeBody.get('token')).toBe(REFRESHED_TOKEN_RESP.refresh_token)
    expect(revokeBody.get('token_type_hint')).toBe('refresh_token')
  })

  it('refresh_token 已过期（invalid_grant）→ OAuthInvalidGrantError', async () => {
    const client = newClient(
      sequentialFetch([oauthErrorResp(400, 'invalid_grant', 'refresh token expired')]),
    )
    await expect(client.refreshToken('rt_expired')).rejects.toBeInstanceOf(
      OAuthInvalidGrantError,
    )
  })
})

// ---------------------------------------------------------------------------
// 5. OAuthError 字段完整性
// ---------------------------------------------------------------------------

describe('E2E: OAuthError 字段', () => {
  it('携带 code / detail / statusCode', async () => {
    const client = newClient(
      sequentialFetch([oauthErrorResp(403, 'access_denied', 'user denied')]),
    )
    let caught: unknown
    try {
      await client.exchangeAuthorizationCode({ code: 'c', codeVerifier: 'v' })
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(OAuthError)
    const err = caught as OAuthError
    expect(err.code).toBe('access_denied')
    expect(err.detail).toBe('user denied')
    expect(err.statusCode).toBe(403)
    expect(err.message).toContain('user denied') // message = detail
  })
})
