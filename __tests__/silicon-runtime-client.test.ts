import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SiliconRuntimeClient, SiliconOwnerBoundError } from '@hezor/hezor2-sdk'
import type { AutoProvisionResponse, SiliconRuntime, RefreshTunnelTokenResponse } from '@hezor/hezor2-sdk'

const BASE_URL = 'http://localhost:8000/api/v1'
const USER_TOKEN = 'test-user-token'
const TUNNEL_TOKEN = 'test-tunnel-token'
const RUNTIME_ID = 'rid_abc123'

describe('SiliconRuntimeClient', () => {
  let client: SiliconRuntimeClient
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    client = new SiliconRuntimeClient({ baseUrl: BASE_URL })
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
  })

  // ── autoProvision ─────────────────────────────────────────────────────────

  describe('autoProvision', () => {
    it('happy path — 返回 AutoProvisionResponse', async () => {
      const mockResp: AutoProvisionResponse = {
        runtime_id: RUNTIME_ID,
        config_key: 'cfg_key',
        app_name: 'hezor-local',
        tunnel_endpoint: 'wss://tunnel.hezor.ai',
        tunnel_token: TUNNEL_TOKEN,
        tunnel_token_expires_at: '2026-12-31T00:00:00Z',
      }
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(mockResp), { status: 200 }),
      )

      const result = await client.autoProvision({ device_id: 'dev_001' }, USER_TOKEN)

      expect(result).toEqual(mockResp)
      expect(fetchSpy).toHaveBeenCalledOnce()

      const [url, options] = fetchSpy.mock.calls[0]!
      expect(url).toBe(`${BASE_URL}/silicon/runtimes/auto-provision`)
      expect(options.method).toBe('POST')
      expect(options.headers['Authorization']).toBe(`Bearer ${USER_TOKEN}`)
      expect(JSON.parse(options.body)).toEqual({ device_id: 'dev_001' })
    })

    it('SILICON_RUNTIME_OWNER_BOUND — 抛出 SiliconOwnerBoundError', async () => {
      const errorBody = { detail: { code: 'SILICON_RUNTIME_OWNER_BOUND' } }
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(errorBody), { status: 409 }),
      )

      await expect(
        client.autoProvision({ device_id: 'dev_bound' }, USER_TOKEN),
      ).rejects.toBeInstanceOf(SiliconOwnerBoundError)
    })

    it('SILICON_RUNTIME_OWNER_BOUND（顶层 code 字段）— 抛出 SiliconOwnerBoundError', async () => {
      const errorBody = { code: 'SILICON_RUNTIME_OWNER_BOUND', message: 'bound' }
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(errorBody), { status: 409 }),
      )

      await expect(
        client.autoProvision({ device_id: 'dev_bound' }, USER_TOKEN),
      ).rejects.toBeInstanceOf(SiliconOwnerBoundError)
    })

    it('其他 4xx/5xx — 抛出 Error', async () => {
      fetchSpy.mockResolvedValue(new Response('Internal Server Error', { status: 500 }))

      await expect(
        client.autoProvision({ device_id: 'dev_001' }, USER_TOKEN),
      ).rejects.toThrow(/auto-provision failed: HTTP 500/)
    })
  })

  // ── listRuntimes ──────────────────────────────────────────────────────────

  describe('listRuntimes', () => {
    it('happy path — 返回 runtime 列表', async () => {
      const mockList: SiliconRuntime[] = [
        { runtime_id: RUNTIME_ID, app_name: 'hezor-local' },
      ]
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(mockList), { status: 200 }),
      )

      const result = await client.listRuntimes(USER_TOKEN)

      expect(result).toEqual(mockList)
      const [url, options] = fetchSpy.mock.calls[0]!
      expect(url).toBe(`${BASE_URL}/silicon/runtimes`)
      expect(options.headers['Authorization']).toBe(`Bearer ${USER_TOKEN}`)
    })

    it('401 — 抛出包含状态码信息的 Error', async () => {
      fetchSpy.mockResolvedValue(new Response('Unauthorized', { status: 401 }))
      await expect(client.listRuntimes(USER_TOKEN)).rejects.toThrow(/401/)
    })

    it('403 — 抛出包含状态码信息的 Error', async () => {
      fetchSpy.mockResolvedValue(new Response('Forbidden', { status: 403 }))
      await expect(client.listRuntimes(USER_TOKEN)).rejects.toThrow(/403/)
    })
  })

  // ── deregisterRuntime ─────────────────────────────────────────────────────

  describe('deregisterRuntime', () => {
    it('204 — 幂等成功，不抛出', async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 204 }))
      await expect(
        client.deregisterRuntime(RUNTIME_ID, USER_TOKEN),
      ).resolves.toBeUndefined()

      const [url, options] = fetchSpy.mock.calls[0]!
      expect(url).toBe(`${BASE_URL}/silicon/runtimes/${RUNTIME_ID}`)
      expect(options.method).toBe('DELETE')
    })

    it('404 — runtime 已不存在，幂等成功', async () => {
      fetchSpy.mockResolvedValue(new Response('Not Found', { status: 404 }))
      await expect(
        client.deregisterRuntime(RUNTIME_ID, USER_TOKEN),
      ).resolves.toBeUndefined()
    })

    it('500 — 抛出 Error', async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ detail: 'server error' }), { status: 500 }),
      )
      await expect(
        client.deregisterRuntime(RUNTIME_ID, USER_TOKEN),
      ).rejects.toThrow(/deregisterRuntime: HTTP 500/)
    })

    it('runtime ID 包含特殊字符时自动 encodeURIComponent', async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 204 }))
      await client.deregisterRuntime('rid/with/slash', USER_TOKEN)
      const [url] = fetchSpy.mock.calls[0]!
      expect(url).toContain('rid%2Fwith%2Fslash')
    })
  })

  // ── refreshTunnelToken ────────────────────────────────────────────────────

  describe('refreshTunnelToken', () => {
    it('happy path — 返回新 token', async () => {
      const mockResp: RefreshTunnelTokenResponse = {
        runtime_id: RUNTIME_ID,
        tunnel_token: 'new-tunnel-token',
        expires_at: '2026-12-31T00:00:00Z',
      }
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(mockResp), { status: 200 }),
      )

      const result = await client.refreshTunnelToken(RUNTIME_ID, TUNNEL_TOKEN)

      expect(result).toEqual(mockResp)
      const [url, options] = fetchSpy.mock.calls[0]!
      expect(url).toBe(`${BASE_URL}/silicon/runtimes/${RUNTIME_ID}/refresh-tunnel-token`)
      expect(options.method).toBe('POST')
      expect(options.headers['Authorization']).toBe(`Bearer ${TUNNEL_TOKEN}`)
    })

    it('4xx — 抛出 Error', async () => {
      fetchSpy.mockResolvedValue(new Response('Unauthorized', { status: 401 }))
      await expect(
        client.refreshTunnelToken(RUNTIME_ID, TUNNEL_TOKEN),
      ).rejects.toThrow(/refreshTunnelToken: HTTP 401/)
    })
  })
})
