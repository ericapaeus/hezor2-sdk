import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hezor2APIClient, ConnectInvalidGrantError } from '@hezor/hezor2-sdk'

describe('Hezor2APIClient - Connect exchange', () => {
  let client: Hezor2APIClient
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    client = new Hezor2APIClient({
      baseUrl: 'http://localhost:8000/api/v1',
      apiKey: 'test-key',
      appName: 'demo_app',
    })
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
  })

  it('should exchange a connect code for tokens', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'at_xxx',
          refresh_token: 'rt_xxx',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
        { status: 200 },
      ),
    )

    const result = await client.connectExchange('one-time-code')

    expect(result.access_token).toBe('at_xxx')
    expect(result.refresh_token).toBe('rt_xxx')
    expect(result.expires_in).toBe(3600)

    const [url, options] = fetchSpy.mock.calls[0]!
    expect(url).toBe('http://localhost:8000/api/v1/auth/connect/exchange')
    expect(JSON.parse(options.body)).toEqual({
      connect_code: 'one-time-code',
      app_name: 'demo_app',
    })
  })

  it('should throw ConnectInvalidGrantError on 400 invalid_grant', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: { code: 'invalid_grant', message: 'invalid or expired connect_code' },
        }),
        { status: 400 },
      ),
    )

    await expect(client.connectExchange('expired-code')).rejects.toBeInstanceOf(
      ConnectInvalidGrantError,
    )
  })

  it('should throw ConnectInvalidGrantError on 400 app_mismatch (same wire code as invalid_grant)', async () => {
    // 服务端 InvalidGrantError/AppMismatchError 在 wire 层共用同一个
    // code="invalid_grant"，客户端无法可靠区分，故统一映射为
    // ConnectInvalidGrantError（详见 hezor2 PR #622 说明）。
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: { code: 'invalid_grant', message: 'app_name mismatch with issued code' },
        }),
        { status: 400 },
      ),
    )

    let error: unknown
    try {
      await client.connectExchange('mismatched-code')
    } catch (err) {
      error = err
    }

    expect(error).toBeInstanceOf(ConnectInvalidGrantError)
    expect((error as ConnectInvalidGrantError).detail).toBe('app_name mismatch with issued code')
  })

  it('should throw when appName is not configured', async () => {
    const anonymousClient = new Hezor2APIClient({ baseUrl: 'http://localhost:8000/api/v1' })

    await expect(anonymousClient.connectExchange('one-time-code')).rejects.toThrow('appName')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('should include state in the Connect login URL when provided', async () => {
    const url = await client.buildConnectUrl(
      'https://hezor.example.com',
      'https://third-party.example.com/callback',
      'csrf-token-abc',
    )

    expect(url).toContain('state=csrf-token-abc')
  })

  it('should omit state from the Connect login URL when not provided', async () => {
    const url = await client.buildConnectUrl(
      'https://hezor.example.com',
      'https://third-party.example.com/callback',
    )

    expect(url).not.toContain('state=')
  })
})
