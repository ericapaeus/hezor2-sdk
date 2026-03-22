/**
 * Hezor2 API Client — HTTP client with webhook-specific operations.
 *
 * Mirrors hezor_common.transfer.hezor2_sdk.base.hezor2_api_client.Hezor2APIClient.
 */

import { BaseAPIClient, type BaseAPIClientOptions } from './base-api-client.js'
import { DEFAULT_API_BASE_URL, DEFAULT_API_KEY } from './env-config.js'
import type {
  CreationGenerateResult,
  CreationGenerateResultV2,
  DataRetrieveResult,
  GenerateReportIdResponseData,
  KnowledgeSearchResult,
  PublishCreationResponseData,
  PullConfigsResponse,
  ReportMetadata,
  WebhookActionHelp,
  WebhookResponse,
} from './types.js'

export interface Hezor2APIClientOptions
  extends Omit<BaseAPIClientOptions, 'baseUrl'> {
  baseUrl?: string | undefined
}

export class Hezor2APIClient extends BaseAPIClient {
  constructor(options: Hezor2APIClientOptions = {}) {
    super({
      ...options,
      baseUrl: options.baseUrl ?? DEFAULT_API_BASE_URL,
      apiKey: options.apiKey ?? DEFAULT_API_KEY,
    })
  }

  /**
   * Send a request to the unified webhook endpoint.
   * @throws {Error} if response status is "error" or HTTP error
   */
  private async webhookRequest<T = unknown>(
    action: string,
    payload: Record<string, unknown>,
  ): Promise<WebhookResponse<T>> {
    const body = { action, payload }

    const response = await this.post('/webhook/', { json: body })
    if (!response.ok) {
      throw new Error(
        `Webhook HTTP error: ${response.status} ${response.statusText}`,
      )
    }

    const resp = (await response.json()) as WebhookResponse<T>
    if (resp.status === 'error') {
      throw new Error(
        `Webhook action '${action}' failed: ${resp.message || 'unknown error'}`,
      )
    }
    return resp
  }

  /** Generate unique report IDs with `rpt_` prefix. */
  async generateReportId(count: number = 1): Promise<string[]> {
    const resp = await this.webhookRequest<GenerateReportIdResponseData>(
      'generate_report_id',
      { count },
    )
    return resp.data!.report_ids
  }

  /**
   * Publish a creation report.
   * Accepts both V1 (CreationGenerateResult) and V2 (CreationGenerateResultV2).
   * V2 is recommended — SDK auto-selects the `publish_creation_report_v2` action.
   */
  async publishCreationReport(
    payload: CreationGenerateResult | CreationGenerateResultV2,
    options?: { taskId?: string; executionId?: string },
  ): Promise<PublishCreationResponseData> {
    const isV2 = 'slug' in payload && !('creation' in payload)
    const action = isV2
      ? 'publish_creation_report_v2'
      : 'publish_creation_report'

    const webhookPayload: Record<string, unknown> = {
      creation_result: payload,
    }
    if (options?.taskId != null) webhookPayload['task_id'] = options.taskId
    if (options?.executionId != null)
      webhookPayload['execution_id'] = options.executionId

    const resp = await this.webhookRequest<PublishCreationResponseData>(
      action,
      webhookPayload,
    )
    return resp.data!
  }

  /** Query report status and metadata. */
  async getReportStatus(
    creationId: string,
    reportId: string,
  ): Promise<ReportMetadata> {
    const resp = await this.webhookRequest<ReportMetadata>(
      'get_report_status',
      { creation_id: creationId, report_id: reportId },
    )
    return resp.data!
  }

  /** Check service health via GET /health. */
  async healthCheck(): Promise<[boolean, Record<string, unknown>]> {
    const response = await this.get('/health')
    if (!response.ok) {
      throw new Error(
        `Health check HTTP error: ${response.status} ${response.statusText}`,
      )
    }

    const data = (await response.json()) as Record<string, unknown>
    const isHealthy = data['status'] === 'healthy'
    return [isHealthy, data]
  }

  /** Retrieve webhook action documentation. */
  async webhookHelp(action: string): Promise<WebhookActionHelp> {
    const response = await this.get('/webhook/help', {
      params: { action },
    })
    if (!response.ok) {
      throw new Error(
        `Webhook help HTTP error: ${response.status} ${response.statusText}`,
      )
    }
    return (await response.json()) as WebhookActionHelp
  }

  /** Execute knowledge_retrieve webhook. */
  async knowledgeRetrieve(
    query: string,
    options?: { topK?: number; scoreThreshold?: number },
  ): Promise<KnowledgeSearchResult> {
    const payload: Record<string, unknown> = {
      query,
      top_k: options?.topK ?? 3,
      score_threshold: options?.scoreThreshold ?? 0.5,
    }
    const resp = await this.webhookRequest<KnowledgeSearchResult>(
      'knowledge_retrieve',
      payload,
    )
    return resp.data!
  }

  /** Execute data_retrieve webhook. */
  async dataRetrieve(
    query: string,
    options?: { topK?: number },
  ): Promise<DataRetrieveResult> {
    const payload: Record<string, unknown> = {
      query,
      top_k: options?.topK ?? 1,
    }
    const resp = await this.webhookRequest<DataRetrieveResult>(
      'data_retrieve',
      payload,
    )
    return resp.data!
  }

  /** Pull configs from configuration center. */
  async pullConfigs(options?: {
    keys?: string[]
    globalBaseUrl?: string
  }): Promise<PullConfigsResponse> {
    const webhookPayload: Record<string, unknown> = {}
    if (options?.keys != null) webhookPayload['keys'] = options.keys
    if (options?.globalBaseUrl != null) {
      webhookPayload['context_variables'] = {
        global_base_url: options.globalBaseUrl,
      }
    }

    const resp = await this.webhookRequest<PullConfigsResponse>(
      'pull_configs',
      webhookPayload,
    )
    return resp.data!
  }
}
