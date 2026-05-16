import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  OAuthClient,
  OAuthError,
  OAuthInvalidGrantError,
  generatePKCEPair,
  generateState,
  DEVICE_CODE_GRANT_TYPE,
  type DeviceCodeResponse,
  type OAuthTokenResponse,
} from '@hezor/hezor2-sdk'

const BASE_URL = 'http://hezor2.test/api/v1'
const CLIENT_ID = 'test-client'

function makeJsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

function makeErrorResponse(
  status: number,
  detail: { error: string; error_description?: string },
): Response {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function newClient(fetchImpl: typeof globalThis.fetch): OAuthClient {
  return new OAuthClient({
    baseUrl: BASE_URL,
    clientId: CLIENT_ID,
    redirectUri: 'http://app.test/callback',
    fetch: fetchImpl,
  })
}

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

describe('generatePKCEPair', () => {
  it('produces a valid S256 challenge from the verifier', async () => {
    const pair = await generatePKCEPair()
    expect(pair.code_challenge_method).toBe('S256')
    expect(pair.code_verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/)
    expect(pair.code_challenge).toMatch(/^[A-Za-z0-9_-]+$/)

    // 验证 challenge = base64url(sha256(verifier))
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(pair.code_verifier),
    )
    const expected = Buffer.from(new Uint8Array(digest))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(pair.code_challenge).toBe(expected)
  })
})

describe('generateState', () => {
  it('returns 22-char URL-safe string', () => {
    const s1 = generateState()
    const s2 = generateState()
    expect(s1).toMatch(/^[A-Za-z0-9_-]{20,24}$/)
    expect(s1).not.toBe(s2)
  })
})

// ---------------------------------------------------------------------------
// buildAuthorizeUrl
// ---------------------------------------------------------------------------

describe('OAuthClient.buildAuthorizeUrl', () => {
  it('assembles full /oauth/authorize URL with required params', () => {
    const client = newClient(vi.fn())
    const url = client.buildAuthorizeUrl({
      state: 'state-1',
      codeChallenge: 'challenge-1',
      scope: 'base:user-info',
    })
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe(`${BASE_URL}/oauth/authorize`)
    expect(parsed.searchParams.get('response_type')).toBe('code')
    expect(parsed.searchParams.get('client_id')).toBe(CLIENT_ID)
    expect(parsed.searchParams.get('state')).toBe('state-1')
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://app.test/callback')
    expect(parsed.searchParams.get('code_challenge')).toBe('challenge-1')
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256')
    expect(parsed.searchParams.get('scope')).toBe('base:user-info')
  })

  it('omits scope when not provided', () => {
    const client = newClient(vi.fn())
    const url = client.buildAuthorizeUrl({
      state: 's',
      codeChallenge: 'c',
    })
    expect(new URL(url).searchParams.has('scope')).toBe(false)
  })

  it('throws when redirect_uri missing both in ctor and call', () => {
    const client = new OAuthClient({
      baseUrl: BASE_URL,
      clientId: CLIENT_ID,
      fetch: vi.fn(),
    })
    expect(() =>
      client.buildAuthorizeUrl({ state: 's', codeChallenge: 'c' }),
    ).toThrow(/redirectUri required/)
  })
})

// ---------------------------------------------------------------------------
// exchangeAuthorizationCode
// ---------------------------------------------------------------------------

describe('OAuthClient.exchangeAuthorizationCode', () => {
  it('POSTs form-encoded body to /oauth/token and returns parsed token', async () => {
    const tokenResp: OAuthTokenResponse = {
      access_token: 'at_xxx',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'rt_xxx',
      scope: 'base:user-info',
    }
    const fetchImpl = vi.fn().mockResolvedValue(makeJsonResponse(tokenResp))
    const client = newClient(fetchImpl)

    const result = await client.exchangeAuthorizationCode({
      code: 'code123',
      codeVerifier: 'verifier123',
    })

    expect(result).toEqual(tokenResp)
    expect(fetchImpl).toHaveBeenCalledOnce()
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe(`${BASE_URL}/oauth/token`)
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    const sent = new URLSearchParams(init.body as string)
    expect(sent.get('grant_type')).toBe('authorization_code')
    expect(sent.get('client_id')).toBe(CLIENT_ID)
    expect(sent.get('code')).toBe('code123')
    expect(sent.get('redirect_uri')).toBe('http://app.test/callback')
    expect(sent.get('code_verifier')).toBe('verifier123')
  })

  it('maps invalid_grant detail to OAuthInvalidGrantError', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      makeErrorResponse(400, { error: 'invalid_grant', error_description: 'expired' }),
    )
    const client = newClient(fetchImpl)
    await expect(
      client.exchangeAuthorizationCode({ code: 'x', codeVerifier: 'y' }),
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
  })

  it('maps generic OAuth error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      makeErrorResponse(400, { error: 'invalid_client', error_description: 'oops' }),
    )
    const client = newClient(fetchImpl)
    await expect(
      client.exchangeAuthorizationCode({ code: 'x', codeVerifier: 'y' }),
    ).rejects.toMatchObject({
      name: 'OAuthError',
      code: 'invalid_client',
      detail: 'oops',
    })
  })

  it('unwraps hezor2 HTTP_ERROR envelope (message=OAuth error object)', async () => {
    // hezor2 app/web/main.py 的顶层 http_exception_handler 会把 OAuth 错误包成
    // { error: "HTTP_ERROR", status_code, path, message: { error, error_description } }
    // SDK 应识别这个 envelope 并拆出内层错误码 / 描述。
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'HTTP_ERROR',
          status_code: 400,
          path: '/api/v1/oauth/token',
          message: {
            error: 'invalid_client',
            error_description: 'oauth disabled',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const client = newClient(fetchImpl)
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
// refreshToken / revokeToken
// ---------------------------------------------------------------------------

describe('OAuthClient.refreshToken', () => {
  it('POSTs refresh_token grant', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      makeJsonResponse({
        access_token: 'at2',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: '',
      }),
    )
    const client = newClient(fetchImpl)
    await client.refreshToken('rt_old')
    const sent = new URLSearchParams(fetchImpl.mock.calls[0]![1].body as string)
    expect(sent.get('grant_type')).toBe('refresh_token')
    expect(sent.get('refresh_token')).toBe('rt_old')
    expect(sent.get('client_id')).toBe(CLIENT_ID)
  })
})

describe('OAuthClient.revokeToken', () => {
  it('POSTs to /oauth/revoke and ignores empty 200 body', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }))
    const client = newClient(fetchImpl)
    await client.revokeToken('rt_xxx', 'refresh_token')
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe(`${BASE_URL}/oauth/revoke`)
    const sent = new URLSearchParams(init.body as string)
    expect(sent.get('token')).toBe('rt_xxx')
    expect(sent.get('token_type_hint')).toBe('refresh_token')
    expect(sent.get('client_id')).toBe(CLIENT_ID)
  })
})

// ---------------------------------------------------------------------------
// Device Flow
// ---------------------------------------------------------------------------

describe('OAuthClient.requestDeviceCode', () => {
  it('POSTs JSON body with extension fields', async () => {
    const dcResp: DeviceCodeResponse = {
      device_code: 'dc_xxx',
      user_code: 'ABCD-EFGH',
      verification_uri: 'http://hezor2.test/oauth/device',
      verification_uri_complete: 'http://hezor2.test/oauth/device?user_code=ABCD-EFGH',
      expires_in: 600,
      interval: 5,
    }
    const fetchImpl = vi.fn().mockResolvedValue(makeJsonResponse(dcResp))
    const client = newClient(fetchImpl)
    const out = await client.requestDeviceCode({
      deviceId: 'dev-1',
      scope: 'device:bind',
      hostname: 'host-a',
      os: 'darwin/arm64',
      runtimeKind: 'starship',
      vendor: 'hezor',
    })
    expect(out).toEqual(dcResp)
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe(`${BASE_URL}/oauth/device/code`)
    expect(init.headers['Content-Type']).toBe('application/json')
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({
      client_id: CLIENT_ID,
      device_id: 'dev-1',
      scope: 'device:bind',
      hostname: 'host-a',
      os: 'darwin/arm64',
      runtime_kind: 'starship',
      vendor: 'hezor',
    })
  })
})

describe('OAuthClient.pollDeviceToken', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('retries on authorization_pending then returns token', async () => {
    const tokenResp: OAuthTokenResponse = {
      access_token: 'at_yes',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'device:bind',
    }
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        makeErrorResponse(400, { error: 'authorization_pending' }),
      )
      .mockResolvedValueOnce(
        makeErrorResponse(400, { error: 'authorization_pending' }),
      )
      .mockResolvedValueOnce(makeJsonResponse(tokenResp))
    const client = newClient(fetchImpl)

    const promise = client.pollDeviceToken({
      deviceCode: 'dc_xxx',
      interval: 1,
      expiresIn: 60,
    })
    // 推进 fake timers 跨过两次 sleep。
    await vi.advanceTimersByTimeAsync(2_500)
    const out = await promise

    expect(out).toEqual(tokenResp)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    const sent = new URLSearchParams(fetchImpl.mock.calls[0]![1].body as string)
    expect(sent.get('grant_type')).toBe(DEVICE_CODE_GRANT_TYPE)
    expect(sent.get('device_code')).toBe('dc_xxx')
  })

  it('increases interval on slow_down', async () => {
    const tokenResp: OAuthTokenResponse = {
      access_token: 'at_yes',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: '',
    }
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(makeErrorResponse(400, { error: 'slow_down' }))
      .mockResolvedValueOnce(makeJsonResponse(tokenResp))
    const client = newClient(fetchImpl)

    const intervals: number[] = []
    const promise = client.pollDeviceToken({
      deviceCode: 'dc',
      interval: 1,
      expiresIn: 60,
      onPoll: ({ nextInterval }) => {
        intervals.push(nextInterval)
      },
    })
    await vi.advanceTimersByTimeAsync(7_000)
    await promise

    // 第一次轮询 interval=1，slow_down 后下一次应为 1+5=6。
    expect(intervals[0]).toBe(1)
    expect(intervals[1]).toBe(6)
  })

  it('throws OAuthError on access_denied without retry', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(makeErrorResponse(400, { error: 'access_denied' }))
    const client = newClient(fetchImpl)
    await expect(
      client.pollDeviceToken({ deviceCode: 'dc', interval: 5, expiresIn: 60 }),
    ).rejects.toMatchObject({ name: 'OAuthError', code: 'access_denied' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('aborts when onPoll returns false', async () => {
    const fetchImpl = vi.fn()
    const client = newClient(fetchImpl)
    await expect(
      client.pollDeviceToken({
        deviceCode: 'dc',
        interval: 5,
        expiresIn: 60,
        onPoll: () => false,
      }),
    ).rejects.toMatchObject({ name: 'OAuthError', code: 'polling_aborted' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('retries on transient network errors (AbortError) instead of bubbling out', async () => {
    const tokenResp: OAuthTokenResponse = {
      access_token: 'at_yes',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: '',
    }
    const abortErr = new Error('The operation was aborted')
    abortErr.name = 'AbortError'
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(abortErr)
      .mockResolvedValueOnce(makeJsonResponse(tokenResp))
    const client = newClient(fetchImpl)

    const promise = client.pollDeviceToken({
      deviceCode: 'dc',
      interval: 1,
      expiresIn: 60,
    })
    await vi.advanceTimersByTimeAsync(1_500)
    const out = await promise

    expect(out).toEqual(tokenResp)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
