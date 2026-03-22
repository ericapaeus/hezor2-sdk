import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hezor2SDK } from '../src/index'
import type { WebhookResponse } from '../src/index'

describe('Hezor2SDK', () => {
  it('should instantiate with defaults', () => {
    const sdk = new Hezor2SDK()
    expect(sdk).toBeInstanceOf(Hezor2SDK)
  })

  it('should instantiate with custom options', () => {
    const sdk = new Hezor2SDK({
      baseUrl: 'https://api.hezor.ai',
      apiKey: 'custom-key',
      timeout: 30_000,
      appName: 'test-app',
    })
    expect(sdk).toBeInstanceOf(Hezor2SDK)
  })

  it('should instantiate with privateKeyPath option', () => {
    const sdk = new Hezor2SDK({
      privateKeyPath: '/path/to/key.pem',
      password: 'secret',
    })
    expect(sdk).toBeInstanceOf(Hezor2SDK)
  })

  it('should instantiate with metaInfo and metaInfoExpiresIn', () => {
    const sdk = new Hezor2SDK({
      metaInfo: {
        subject: 'test',
        subject_code: 'tc',
        caller_id: 'cid',
      },
      metaInfoExpiresIn: 7200,
    })
    expect(sdk).toBeInstanceOf(Hezor2SDK)
  })

  describe('Hezor2SDK.with()', () => {
    let fetchSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
      fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
    })

    it('should execute function with SDK instance', async () => {
      const mockResponse: WebhookResponse = {
        action: 'generate_report_id',
        status: 'ok',
        data: { report_ids: ['rpt_test'] },
        message: '',
      }
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      )

      const ids = await Hezor2SDK.with(
        { baseUrl: 'http://localhost:8000', apiKey: 'key' },
        async (sdk) => sdk.generateReportId(1),
      )
      expect(ids).toEqual(['rpt_test'])
    })

    it('should propagate errors from the callback', async () => {
      await expect(
        Hezor2SDK.with(
          { baseUrl: 'http://localhost:8000', apiKey: 'key' },
          async () => {
            throw new Error('callback error')
          },
        ),
      ).rejects.toThrow('callback error')
    })

    it('should return the callback result', async () => {
      const result = await Hezor2SDK.with(
        { baseUrl: 'http://localhost:8000', apiKey: 'key' },
        async () => 42,
      )
      expect(result).toBe(42)
    })
  })

  describe('health check error handling', () => {
    let fetchSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
      fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
    })

    it('should return false on network error', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'))
      const sdk = new Hezor2SDK({
        baseUrl: 'http://localhost:8000',
        apiKey: 'key',
      })
      const [isHealthy, data] = await sdk.healthCheck()
      expect(isHealthy).toBe(false)
      expect(data).toEqual({ error: 'HTTP request failed' })
    })
  })
})
