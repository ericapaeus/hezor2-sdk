import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hezor2APIClient, DEFAULT_API_BASE_URL, DEFAULT_API_KEY } from '@hezor/hezor2-sdk'
import type { WebhookResponse } from '@hezor/hezor2-sdk'

describe('Hezor2APIClient', () => {
  let client: Hezor2APIClient
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    client = new Hezor2APIClient({
      baseUrl: 'http://localhost:8000',
      apiKey: 'test-key',
    })
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
  })

  it('should use default base URL and API key when no options provided', () => {
    const defaultClient = new Hezor2APIClient()
    expect(defaultClient.baseUrl).toBe(DEFAULT_API_BASE_URL)
    expect(defaultClient.apiKey).toBe(DEFAULT_API_KEY)
  })

  // --- generateReportId ---

  it('should call generate_report_id webhook', async () => {
    const mockResponse: WebhookResponse = {
      action: 'generate_report_id',
      status: 'ok',
      data: { report_ids: ['rpt_abc', 'rpt_def'] },
      message: 'Generated 2 report IDs',
    }
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    const ids = await client.generateReportId(2)
    expect(ids).toEqual(['rpt_abc', 'rpt_def'])
    expect(fetchSpy).toHaveBeenCalledOnce()

    const [url, options] = fetchSpy.mock.calls[0]!
    expect(url).toBe('http://localhost:8000/webhook/')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({
      action: 'generate_report_id',
      payload: { count: 2 },
    })
  })

  it('should default count to 1 for generateReportId', async () => {
    const mockResponse: WebhookResponse = {
      action: 'generate_report_id',
      status: 'ok',
      data: { report_ids: ['rpt_abc'] },
      message: '',
    }
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    await client.generateReportId()
    const body = JSON.parse(fetchSpy.mock.calls[0]![1].body)
    expect(body.payload.count).toBe(1)
  })

  // --- publishCreationReport ---

  it('should call publish_creation_report_v2 for V2 payload', async () => {
    const mockResponse: WebhookResponse = {
      action: 'publish_creation_report_v2',
      status: 'ok',
      data: {
        report_id: 'rpt_abc',
        task_id: 'task_001',
        execution_id: 'exec_001',
        status: 'accepted',
        message: '',
      },
      message: '',
    }
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    const result = await client.publishCreationReport(
      {
        creation_id: 'rpt_abc',
        title: 'Test Report',
        full_content: '# Content',
        subject: 'Test',
        slug: 'test_report',
      },
      { taskId: 'task_001' },
    )

    expect(result.report_id).toBe('rpt_abc')
    const body = JSON.parse(fetchSpy.mock.calls[0]![1].body)
    expect(body.action).toBe('publish_creation_report_v2')
    expect(body.payload.task_id).toBe('task_001')
  })

  it('should include execution_id in publish payload', async () => {
    const mockResponse: WebhookResponse = {
      action: 'publish_creation_report_v2',
      status: 'ok',
      data: {
        report_id: 'rpt_abc',
        task_id: 'task_001',
        execution_id: 'exec_001',
        status: 'accepted',
        message: '',
      },
      message: '',
    }
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    await client.publishCreationReport(
      {
        creation_id: 'rpt_abc',
        title: 'Test',
        full_content: '',
        subject: 'Test',
        slug: 'test',
      },
      { taskId: 'task_001', executionId: 'exec_001' },
    )

    const body = JSON.parse(fetchSpy.mock.calls[0]![1].body)
    expect(body.payload.execution_id).toBe('exec_001')
  })

  it('should call publish_creation_report for V1 payload', async () => {
    const mockResponse: WebhookResponse = {
      action: 'publish_creation_report',
      status: 'ok',
      data: {
        report_id: 'rpt_abc',
        task_id: 'task_001',
        execution_id: 'exec_001',
        status: 'accepted',
        message: '',
      },
      message: '',
    }
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    await client.publishCreationReport({
      original_query: 'test',
      creation: {},
      params: {},
      chapter_results: [],
      summary: '',
      title: 'Test',
      data_coverage: '',
      full_content: '',
      creation_id: 'rpt_abc',
      prefix: '',
      postfix: '',
      file_path: '',
    })

    const body = JSON.parse(fetchSpy.mock.calls[0]![1].body)
    expect(body.action).toBe('publish_creation_report')
  })

  // --- Error handling ---

  it('should throw on webhook error response', async () => {
    const mockResponse: WebhookResponse = {
      action: 'generate_report_id',
      status: 'error',
      data: null,
      message: 'Invalid count',
    }
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    await expect(client.generateReportId(-1)).rejects.toThrow(
      "Webhook action 'generate_report_id' failed: Invalid count",
    )
  })

  it('should throw "unknown error" for error status with empty message', async () => {
    const mockResponse: WebhookResponse = {
      action: 'generate_report_id',
      status: 'error',
      data: null,
      message: '',
    }
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    await expect(client.generateReportId(1)).rejects.toThrow('unknown error')
  })

  it('should throw on HTTP error', async () => {
    fetchSpy.mockResolvedValue(
      new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' }),
    )

    await expect(client.generateReportId(1)).rejects.toThrow(
      'Webhook HTTP error: 500',
    )
  })

  // --- healthCheck ---

  it('should call health_check and return healthy', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ status: 'healthy', version: '1.0' }), {
        status: 200,
      }),
    )

    const [isHealthy, data] = await client.healthCheck()
    expect(isHealthy).toBe(true)
    expect(data['status']).toBe('healthy')
  })

  it('should return not healthy when status is not "healthy"', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ status: 'degraded', version: '1.0' }), {
        status: 200,
      }),
    )

    const [isHealthy, data] = await client.healthCheck()
    expect(isHealthy).toBe(false)
    expect(data['status']).toBe('degraded')
  })

  it('should throw on health check HTTP error', async () => {
    fetchSpy.mockResolvedValue(
      new Response('Service Unavailable', { status: 503, statusText: 'Service Unavailable' }),
    )

    await expect(client.healthCheck()).rejects.toThrow('Health check HTTP error: 503')
  })

  // --- knowledgeRetrieve ---

  it('should call knowledge_retrieve with custom params', async () => {
    const mockResponse: WebhookResponse = {
      action: 'knowledge_retrieve',
      status: 'ok',
      data: {
        chunks: { items: [], collection: '', query: 'test', total: 0 },
        entities: { items: [], collection: '', query: 'test', total: 0 },
        communities: { items: [], collection: '', query: 'test', total: 0 },
        pictures: { items: [], collection: '', query: 'test', total: 0 },
        query: 'test',
      },
      message: '',
    }
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    const result = await client.knowledgeRetrieve('test', {
      topK: 5,
      scoreThreshold: 0.6,
    })
    expect(result.query).toBe('test')
    const body = JSON.parse(fetchSpy.mock.calls[0]![1].body)
    expect(body.payload.top_k).toBe(5)
    expect(body.payload.score_threshold).toBe(0.6)
  })

  it('should use default params for knowledge_retrieve', async () => {
    const mockResponse: WebhookResponse = {
      action: 'knowledge_retrieve',
      status: 'ok',
      data: {
        chunks: { items: [], collection: '', query: 'q', total: 0 },
        entities: { items: [], collection: '', query: 'q', total: 0 },
        communities: { items: [], collection: '', query: 'q', total: 0 },
        pictures: { items: [], collection: '', query: 'q', total: 0 },
        query: 'q',
      },
      message: '',
    }
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    await client.knowledgeRetrieve('q')
    const body = JSON.parse(fetchSpy.mock.calls[0]![1].body)
    expect(body.payload.top_k).toBe(3)
    expect(body.payload.score_threshold).toBe(0.5)
  })

  // --- dataRetrieve ---

  it('should call data_retrieve', async () => {
    const mockResponse: WebhookResponse = {
      action: 'data_retrieve',
      status: 'ok',
      data: { query: 'test query', results: {} },
      message: '',
    }
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    const result = await client.dataRetrieve('test query')
    expect(result.query).toBe('test query')
  })

  it('should use default top_k=1 for data_retrieve', async () => {
    const mockResponse: WebhookResponse = {
      action: 'data_retrieve',
      status: 'ok',
      data: { query: 'q', results: {} },
      message: '',
    }
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    await client.dataRetrieve('q')
    const body = JSON.parse(fetchSpy.mock.calls[0]![1].body)
    expect(body.payload.top_k).toBe(1)
  })

  it('should pass custom top_k for data_retrieve', async () => {
    const mockResponse: WebhookResponse = {
      action: 'data_retrieve',
      status: 'ok',
      data: { query: 'q', results: {} },
      message: '',
    }
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    await client.dataRetrieve('q', { topK: 5 })
    const body = JSON.parse(fetchSpy.mock.calls[0]![1].body)
    expect(body.payload.top_k).toBe(5)
  })

  // --- pullConfigs ---

  it('should call pull_configs', async () => {
    const mockResponse: WebhookResponse = {
      action: 'pull_configs',
      status: 'ok',
      data: {
        public: { API_BASE: 'https://api.hezor.ai' },
        user: { MY_KEY: 'user_value' },
      },
      message: '',
    }
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    const result = await client.pullConfigs({ keys: ['API_BASE', 'MY_KEY'] })
    expect(result.public['API_BASE']).toBe('https://api.hezor.ai')
    expect(result.user['MY_KEY']).toBe('user_value')
  })

  it('should call pull_configs with globalBaseUrl', async () => {
    const mockResponse: WebhookResponse = {
      action: 'pull_configs',
      status: 'ok',
      data: { public: {}, user: {} },
      message: '',
    }
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    await client.pullConfigs({ globalBaseUrl: 'https://custom.domain.com' })
    const body = JSON.parse(fetchSpy.mock.calls[0]![1].body)
    expect(body.payload.context_variables.global_base_url).toBe('https://custom.domain.com')
  })

  it('should call pull_configs without options', async () => {
    const mockResponse: WebhookResponse = {
      action: 'pull_configs',
      status: 'ok',
      data: { public: {}, user: {} },
      message: '',
    }
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    await client.pullConfigs()
    const body = JSON.parse(fetchSpy.mock.calls[0]![1].body)
    expect(body.payload).toEqual({})
  })

  // --- webhookHelp ---

  it('should call webhook_help', async () => {
    const mockHelp = {
      action: 'generate_report_id',
      description: '生成报告 ID',
      usage: { method: 'POST', url: '/webhook/', headers: {}, body: {} },
      payload_schema: {},
      response_data_schema: {},
    }
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(mockHelp), { status: 200 }),
    )

    const help = await client.webhookHelp('generate_report_id')
    expect(help.action).toBe('generate_report_id')
    expect(help.description).toBe('生成报告 ID')
  })

  it('should throw on webhook_help HTTP error', async () => {
    fetchSpy.mockResolvedValue(
      new Response('Not Found', { status: 404, statusText: 'Not Found' }),
    )

    await expect(client.webhookHelp('nonexistent')).rejects.toThrow(
      'Webhook help HTTP error: 404',
    )
  })

  // --- getReportStatus ---

  it('should call get_report_status', async () => {
    const mockResponse: WebhookResponse = {
      action: 'get_report_status',
      status: 'ok',
      data: {
        reportId: 'rpt_001',
        reportTitle: 'Test Report',
        description: '',
        generatedAt: '2026-01-27T00:00:00Z',
        verificationCode: '',
        statusMessage: '',
        summary: '',
      },
      message: '',
    }
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    const meta = await client.getReportStatus('crt_001', 'rpt_001')
    expect(meta.reportTitle).toBe('Test Report')
    expect(meta.reportId).toBe('rpt_001')

    const body = JSON.parse(fetchSpy.mock.calls[0]![1].body)
    expect(body.payload.creation_id).toBe('crt_001')
    expect(body.payload.report_id).toBe('rpt_001')
  })
})
