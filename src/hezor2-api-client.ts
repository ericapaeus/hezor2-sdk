/**
 * Hezor2 API Client — HTTP client with webhook-specific operations.
 *
 * Mirrors hezor_common.transfer.hezor2_sdk.base.hezor2_api_client.Hezor2APIClient.
 */

import { BaseAPIClient, type BaseAPIClientOptions } from './base-api-client.js'
import { REQ_HEADER_META_INFO_KEY } from './constants.js'
import { DEFAULT_API_BASE_URL, DEFAULT_API_KEY } from './env-config.js'
import type {
  ConnectRefreshResponse,
  ConnectVerifyResponse,
  CreationGenerateResult,
  CreationGenerateResultV2,
  DataRetrieveResult,
  GenerateReportIdResponseData,
  GraphQueryResult,
  KnowledgeSearchResult,
  PublicReportsResponseData,
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

  /**
   * Get public reports.
   *
   * This action supports anonymous access (no API key required).
   *
   * @param options.topN - Max number of reports to return (default: 5)
   * @param options.creationId - Filter by specific creation ID (optional)
   */
  async getPublicReports(options?: {
    topN?: number
    creationId?: string
  }): Promise<PublicReportsResponseData> {
    const payload: Record<string, unknown> = {
      top_n: options?.topN ?? 5,
    }
    if (options?.creationId != null) payload['creation_id'] = options.creationId

    const resp = await this.webhookRequest<PublicReportsResponseData>(
      'get_public_reports',
      payload,
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

  /**
   * Execute single-collection knowledge search.
   *
   * Targets a specific collection (chunks, entities, communities, pictures,
   * relationships) with collection-specific filter parameters.
   */
  async knowledgeSearch(
    query: string,
    collection: string,
    options?: {
      topK?: number
      scoreThreshold?: number
      metadataFilter?: Record<string, unknown>
      dateRange?: [string, string]
      searchMode?: 'semantic' | 'hybrid'
      vectorWeight?: number
      textWeight?: number
      entityType?: string
      docId?: string
    },
  ): Promise<KnowledgeSearchResult> {
    const payload: Record<string, unknown> = {
      query,
      collection,
      top_k: options?.topK ?? 5,
      score_threshold: options?.scoreThreshold ?? 0.5,
      search_mode: options?.searchMode ?? 'semantic',
      vector_weight: options?.vectorWeight ?? 0.7,
      text_weight: options?.textWeight ?? 0.3,
    }
    if (options?.metadataFilter != null) payload['metadata_filter'] = options.metadataFilter
    if (options?.dateRange != null) payload['date_range'] = options.dateRange
    if (options?.entityType != null) payload['entity_type'] = options.entityType
    if (options?.docId != null) payload['doc_id'] = options.docId

    const resp = await this.webhookRequest<KnowledgeSearchResult>(
      'knowledge_search',
      payload,
    )
    return resp.data!
  }

  /**
   * Execute knowledge graph topology query.
   *
   * Supports multiple query types: graph_statistics, entity_search,
   * entity_relationships, entity_subgraph, find_paths,
   * entity_co_occurrence, entity_communities, community_subgraph,
   * related_communities.
   */
  async knowledgeGraphQuery(
    queryType: string,
    options?: {
      keyword?: string
      entityName?: string
      entityType?: string
      relationshipType?: string
      direction?: 'in' | 'out' | 'both'
      targetName?: string
      maxDepth?: number
      maxPaths?: number
      communityId?: string
      limit?: number
    },
  ): Promise<GraphQueryResult> {
    const payload: Record<string, unknown> = {
      query_type: queryType,
      direction: options?.direction ?? 'both',
      max_depth: options?.maxDepth ?? 2,
      max_paths: options?.maxPaths ?? 3,
      limit: options?.limit ?? 20,
    }
    if (options?.keyword != null) payload['keyword'] = options.keyword
    if (options?.entityName != null) payload['entity_name'] = options.entityName
    if (options?.entityType != null) payload['entity_type'] = options.entityType
    if (options?.relationshipType != null) payload['relationship_type'] = options.relationshipType
    if (options?.targetName != null) payload['target_name'] = options.targetName
    if (options?.communityId != null) payload['community_id'] = options.communityId

    const resp = await this.webhookRequest<GraphQueryResult>(
      'knowledge_graph_query',
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

  // ── Connect login ─────────────────────────────────────────────────────────

  /**
   * Sign a fresh meta_info JWT using the client's configured key material.
   * Returns the raw JWT string.
   */
  private async signMetaInfoJwt(): Promise<string> {
    const headers = await this.getHeaders()
    const jwt = headers[REQ_HEADER_META_INFO_KEY]
    if (!jwt) {
      throw new Error(
        'Cannot sign meta_info JWT: metaInfo or private key not configured on this client',
      )
    }
    return jwt
  }

  /**
   * Verify a Connect app identity.
   *
   * Calls `POST /auth/connect/verify` with `app_name`, signed `meta_info` JWT,
   * and `callback_url`. The meta_info JWT is signed using the client's
   * configured private key.
   *
   * @param callbackUrl - The callback URL to verify (must be in the app's redirect_uris)
   */
  async connectVerify(callbackUrl: string): Promise<ConnectVerifyResponse> {
    if (!this.appName) {
      throw new Error('appName is required for Connect verify')
    }

    const metaInfoJwt = await this.signMetaInfoJwt()

    const response = await this.post('/auth/connect/verify', {
      json: {
        app_name: this.appName,
        meta_info: metaInfoJwt,
        callback_url: callbackUrl,
      },
      skipAuth: true,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Connect verify failed: ${response.status} ${text}`)
    }

    return (await response.json()) as ConnectVerifyResponse
  }

  /**
   * Refresh a Connect token.
   *
   * Calls `POST /auth/connect/refresh` with `app_name`, a freshly signed
   * `meta_info` JWT, and the `refresh_token`. Returns new tokens.
   *
   * @param refreshToken - The refresh token obtained from Connect login callback
   */
  async connectRefresh(refreshToken: string): Promise<ConnectRefreshResponse> {
    if (!this.appName) {
      throw new Error('appName is required for Connect refresh')
    }

    const metaInfoJwt = await this.signMetaInfoJwt()

    const response = await this.post('/auth/connect/refresh', {
      json: {
        app_name: this.appName,
        meta_info: metaInfoJwt,
        refresh_token: refreshToken,
      },
      skipAuth: true,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Connect refresh failed: ${response.status} ${text}`)
    }

    return (await response.json()) as ConnectRefreshResponse
  }

  /**
   * Build a Connect login URL.
   *
   * Signs the MetaInfo JWT and constructs the full URL that a user should be
   * redirected to in order to begin the Connect login flow.
   *
   * @param frontendUrl - The Hezor frontend base URL (e.g. "https://your-hezor-domain.com")
   * @param callbackUrl - The callback URL to redirect to after login
   */
  async buildConnectUrl(frontendUrl: string, callbackUrl: string): Promise<string> {
    if (!this.appName) {
      throw new Error('appName is required for Connect URL')
    }

    const metaInfoJwt = await this.signMetaInfoJwt()

    const params = new URLSearchParams({
      app_name: this.appName,
      meta_info: metaInfoJwt,
      callback_url: callbackUrl,
    })

    return `${frontendUrl.replace(/\/+$/, '')}/connect?${params}`
  }
}
