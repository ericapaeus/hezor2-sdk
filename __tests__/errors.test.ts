import { describe, it, expect, vi } from 'vitest'

import {
  BaseAPIClient,
  HezorError,
  SubscriptionRequiredError,
  OAuthError,
  ScopeNotAllowedError,
  ToolkitSubscriptionRequiredError,
  InvalidRedirectUriError,
  ClientNotFoundError,
  OAuthInvalidGrantError,
  ConnectError,
  ConnectInvalidGrantError,
  ConnectAppMismatchError,
  META_AUTH_MODE_OAUTH,
  META_AUTH_MODE_PRIVATE_KEY,
} from '@hezor/hezor2-sdk'
import type { MetaInfoData } from '@hezor/hezor2-sdk'

describe('errors', () => {
  describe('HezorError', () => {
    it('exposes code/detail/statusCode', () => {
      const err = new HezorError({ code: 'invalid_request', detail: 'missing client_id' })
      expect(err.code).toBe('invalid_request')
      expect(err.detail).toBe('missing client_id')
      expect(err.statusCode).toBe(400)
      expect(err.message).toBe('missing client_id')
    })

    it('accepts custom statusCode', () => {
      const err = new HezorError({ code: 'server_error', detail: 'boom', statusCode: 500 })
      expect(err.statusCode).toBe(500)
    })
  })

  describe('SubscriptionRequiredError', () => {
    it('defaults to 402 / subscription_required', () => {
      const err = new SubscriptionRequiredError()
      expect(err.code).toBe('subscription_required')
      expect(err.statusCode).toBe(402)
      expect(err).toBeInstanceOf(HezorError)
    })

    it('accepts custom detail', () => {
      const err = new SubscriptionRequiredError('toolkit weather not subscribed')
      expect(err.detail).toBe('toolkit weather not subscribed')
    })
  })

  describe('OAuth errors', () => {
    it.each([
      [ScopeNotAllowedError, 'invalid_scope', 400],
      [ToolkitSubscriptionRequiredError, 'toolkit_subscription_required', 403],
      [InvalidRedirectUriError, 'invalid_redirect_uri', 400],
      [ClientNotFoundError, 'invalid_client', 400],
      [OAuthInvalidGrantError, 'invalid_grant', 400],
    ] as const)(
      'maps %s -> code %s / status %i',
      (Cls, expectedCode, expectedStatus) => {
        const err = new Cls()
        expect(err.code).toBe(expectedCode)
        expect(err.statusCode).toBe(expectedStatus)
        expect(err).toBeInstanceOf(OAuthError)
        expect(err).toBeInstanceOf(HezorError)
      },
    )
  })

  describe('Connect errors', () => {
    it.each([
      [ConnectInvalidGrantError, 'invalid_grant', 400],
      [ConnectAppMismatchError, 'invalid_grant', 400],
    ] as const)(
      'maps %s -> code %s / status %i',
      (Cls, expectedCode, expectedStatus) => {
        const err = new Cls()
        expect(err.code).toBe(expectedCode)
        expect(err.statusCode).toBe(expectedStatus)
        expect(err).toBeInstanceOf(ConnectError)
        expect(err).toBeInstanceOf(HezorError)
      },
    )
  })
})

describe('MetaInfoData auth_mode / grant_version', () => {
  it('accepts oauth + grant_version', () => {
    const meta: MetaInfoData = {
      subject: 's',
      subject_code: 'sc',
      caller_id: 'c',
      auth_mode: META_AUTH_MODE_OAUTH,
      grant_version: 3,
    }
    expect(meta.auth_mode).toBe('oauth')
    expect(meta.grant_version).toBe(3)
  })

  it('accepts private_key constant', () => {
    const meta: MetaInfoData = {
      subject: 's',
      subject_code: 'sc',
      caller_id: 'c',
      auth_mode: META_AUTH_MODE_PRIVATE_KEY,
    }
    expect(meta.auth_mode).toBe('private_key')
    expect(meta.grant_version).toBeUndefined()
  })

  it('legacy MetaInfo (no new fields) still typechecks', () => {
    const meta: MetaInfoData = {
      subject: 's',
      subject_code: 'sc',
      caller_id: 'c',
    }
    expect(meta.auth_mode).toBeUndefined()
    expect(meta.grant_version).toBeUndefined()
  })
})

describe('BaseAPIClient onSubscriptionRequired (402 interception)', () => {
  it('calls hook with SubscriptionRequiredError on 402 GET', async () => {
    const onSub = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'toolkit not subscribed' }), {
        status: 402,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const client = new BaseAPIClient({
      baseUrl: 'http://x',
      onSubscriptionRequired: onSub,
    })
    const resp = await client.get('/anything', { skipAuth: true })
    expect(resp.status).toBe(402)
    expect(onSub).toHaveBeenCalledTimes(1)
    const [err, response] = onSub.mock.calls[0]!
    expect(err).toBeInstanceOf(SubscriptionRequiredError)
    expect(err.detail).toBe('toolkit not subscribed')
    expect(response).toBeInstanceOf(Response)
    fetchSpy.mockRestore()
  })

  it('does not call hook for non-402 responses', async () => {
    const onSub = vi.fn()
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    const client = new BaseAPIClient({
      baseUrl: 'http://x',
      onSubscriptionRequired: onSub,
    })
    await client.get('/ok', { skipAuth: true })
    expect(onSub).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('falls back to default detail when 402 body is not JSON', async () => {
    const onSub = vi.fn()
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('not json', { status: 402 }))
    const client = new BaseAPIClient({
      baseUrl: 'http://x',
      onSubscriptionRequired: onSub,
    })
    await client.post('/x', { json: {}, skipAuth: true })
    expect(onSub).toHaveBeenCalledTimes(1)
    const [err] = onSub.mock.calls[0]!
    expect(err.detail).toBe('subscription required')
    fetchSpy.mockRestore()
  })

  it('does not throw if hook throws', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 402 }))
    const client = new BaseAPIClient({
      baseUrl: 'http://x',
      onSubscriptionRequired: () => {
        throw new Error('hook failure')
      },
    })
    await expect(client.delete('/x', { skipAuth: true })).resolves.toBeInstanceOf(Response)
    fetchSpy.mockRestore()
  })

  it('still returns Response when hook is absent on 402', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 402 }))
    const client = new BaseAPIClient({ baseUrl: 'http://x' })
    const resp = await client.put('/x', { json: {}, skipAuth: true })
    expect(resp.status).toBe(402)
    fetchSpy.mockRestore()
  })

  it('intercepts 402 across all HTTP methods', async () => {
    const onSub = vi.fn()
    const client = new BaseAPIClient({
      baseUrl: 'http://x',
      onSubscriptionRequired: onSub,
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    for (const _ of [0, 1, 2, 3]) {
      fetchSpy.mockResolvedValueOnce(new Response('{}', { status: 402 }))
    }
    await client.post('/p', { skipAuth: true })
    await client.put('/p', { skipAuth: true })
    await client.patch('/p', { skipAuth: true })
    await client.delete('/p', { skipAuth: true })
    expect(onSub).toHaveBeenCalledTimes(4)
    fetchSpy.mockRestore()
  })
})
