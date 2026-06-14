import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hezor2APIClient } from '@hezor/hezor2-sdk'
import type { WebhookResponse, DataRetrieveResult, DatahubSearchToolsResult, ExecuteResponse } from '@hezor/hezor2-sdk'

describe('Hezor2APIClient — 用户 token webhook 方法（/webhook/user/）', () => {
  let client: Hezor2APIClient
  let fetchSpy: ReturnType<typeof vi.fn>
  const USER_TOKEN = 'test-user-oauth-token'
  const BASE_URL = 'http://localhost:8000/api/v1'

  beforeEach(() => {
    client = new Hezor2APIClient({ baseUrl: BASE_URL, apiKey: 'test-key' })
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
  })

  // ── dataRetrieveAsUser ────────────────────────────────────────────────────

  describe('dataRetrieveAsUser', () => {
    it('happy path — 发送正确请求并返回结果', async () => {
      const mockData: DataRetrieveResult = {
        query: '测试查询',
        results: {},
      }
      const mockResponse: WebhookResponse<DataRetrieveResult> = {
        action: 'data_retrieve',
        status: 'ok',
        data: mockData,
        message: '',
      }
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      )

      const result = await client.dataRetrieveAsUser('测试查询', { userToken: USER_TOKEN })

      expect(result).toEqual(mockData)
      expect(fetchSpy).toHaveBeenCalledOnce()

      const [url, options] = fetchSpy.mock.calls[0]!
      expect(url).toBe(`${BASE_URL}/webhook/user/`)
      expect(options.method).toBe('POST')
      // skipAuth: true → Authorization 由调用方传入，不应带 apiKey 头
      expect(options.headers['Authorization']).toBe(`Bearer ${USER_TOKEN}`)
      const body = JSON.parse(options.body)
      expect(body.action).toBe('data_retrieve')
      expect(body.payload.query).toBe('测试查询')
      expect(body.payload.top_k).toBe(20)
    })

    it('topK 参数透传', async () => {
      const mockResponse: WebhookResponse<DataRetrieveResult> = {
        action: 'data_retrieve',
        status: 'ok',
        data: { query: '', results: {} },
        message: '',
      }
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      )

      await client.dataRetrieveAsUser('q', { topK: 5, userToken: USER_TOKEN })
      const body = JSON.parse(fetchSpy.mock.calls[0]![1].body)
      expect(body.payload.top_k).toBe(5)
    })

    it('401 — 抛出 Error', async () => {
      fetchSpy.mockResolvedValue(new Response('Unauthorized', { status: 401 }))
      await expect(
        client.dataRetrieveAsUser('q', { userToken: USER_TOKEN }),
      ).rejects.toThrow(/401/)
    })
  })

  // ── datahubSearchToolsAsUser ──────────────────────────────────────────────

  describe('datahubSearchToolsAsUser', () => {
    it('happy path — 走 /webhook/user/ 并返回工具列表', async () => {
      const mockData: DatahubSearchToolsResult = {
        tools: [{ name: 'weather', desc: '天气查询' }],
      }
      const mockResponse: WebhookResponse<DatahubSearchToolsResult> = {
        action: 'datahub_search_tools',
        status: 'ok',
        data: mockData,
        message: '',
      }
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      )

      const result = await client.datahubSearchToolsAsUser('weather', {
        topK: 3,
        userToken: USER_TOKEN,
      })

      expect(result).toEqual(mockData)
      const [url, options] = fetchSpy.mock.calls[0]!
      expect(url).toBe(`${BASE_URL}/webhook/user/`)
      expect(options.headers['Authorization']).toBe(`Bearer ${USER_TOKEN}`)
      const body = JSON.parse(options.body)
      expect(body.payload.top_k).toBe(3)
    })

    it('401 — 抛出 Error', async () => {
      fetchSpy.mockResolvedValue(new Response('Unauthorized', { status: 401 }))
      await expect(
        client.datahubSearchToolsAsUser('q', { userToken: USER_TOKEN }),
      ).rejects.toThrow(/401/)
    })
  })

  // ── datahubExecuteToolAsUser ──────────────────────────────────────────────

  describe('datahubExecuteToolAsUser', () => {
    it('happy path — 工具执行成功', async () => {
      const mockExecResult: ExecuteResponse = {
        success: true,
        data: { result: 'ok' },
        count: 1,
        error: '',
        desc: '',
      }
      const mockResponse: WebhookResponse<ExecuteResponse> = {
        action: 'datahub_execute_tool',
        status: 'ok',
        data: mockExecResult,
        message: '',
      }
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      )

      const result = await client.datahubExecuteToolAsUser(
        'weather',
        { city: '北京' },
        { userToken: USER_TOKEN },
      )

      expect(result).toEqual(mockExecResult)
      const [url, options] = fetchSpy.mock.calls[0]!
      expect(url).toBe(`${BASE_URL}/webhook/user/`)
      expect(options.headers['Authorization']).toBe(`Bearer ${USER_TOKEN}`)
      const body = JSON.parse(options.body)
      expect(body.payload.tool_name).toBe('weather')
      expect(body.payload.args).toEqual({ city: '北京' })
    })

    it('工具执行失败（status=error）— 不抛出，透传 ExecuteResponse', async () => {
      const mockResponse: WebhookResponse<ExecuteResponse> = {
        action: 'datahub_execute_tool',
        status: 'error',
        data: { success: false, data: {}, count: 0, error: '工具执行失败', desc: '' },
        message: '工具执行失败',
      }
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      )

      const result = await client.datahubExecuteToolAsUser(
        'broken-tool',
        {},
        { userToken: USER_TOKEN },
      )
      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })

    it('401 — 抛出 Error', async () => {
      fetchSpy.mockResolvedValue(new Response('Unauthorized', { status: 401 }))
      await expect(
        client.datahubExecuteToolAsUser('t', {}, { userToken: USER_TOKEN }),
      ).rejects.toThrow(/401/)
    })
  })
})
