/**
 * Hezor2 API Client — HTTP client with webhook-specific operations.
 *
 * Mirrors hezor_common.transfer.hezor2_sdk.base.hezor2_api_client.Hezor2APIClient.
 */

import { BaseAPIClient, type BaseAPIClientOptions } from './base-api-client.js'
import { REQ_HEADER_META_INFO_KEY } from './constants.js'
import { DEFAULT_API_BASE_URL, DEFAULT_API_KEY } from './env-config.js'
import type {
  AppCertInfo,
  ConnectRefreshResponse,
  ConnectVerifyResponse,
  CreationGenerateResult,
  CreationGenerateResultV2,
  DatahubSearchToolsResult,
  DataRetrieveResult,
  ExecuteResponse,
  GenerateReportIdResponseData,
  PublicReportsResponseData,
  PublishCreationResponseData,
  PullConfigsResponse,
  ReportMetadata,
  UserAppBindingInfo,
  WebhookActionHelp,
  WebhookResponse,
  WechatLoginUrlResponse,
  WechatPollOpenidResponse,
} from './types.js'

export interface Hezor2APIClientOptions extends Omit<BaseAPIClientOptions, 'baseUrl'> {
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
      throw new Error(`Webhook HTTP error: ${response.status} ${response.statusText}`)
    }

    const resp = (await response.json()) as WebhookResponse<T>
    if (resp.status === 'error') {
      throw new Error(`Webhook action '${action}' failed: ${resp.message || 'unknown error'}`)
    }
    return resp
  }

  /** Generate unique report IDs with `rpt_` prefix. */
  async generateReportId(count: number = 1): Promise<string[]> {
    const resp = await this.webhookRequest<GenerateReportIdResponseData>('generate_report_id', {
      count,
    })
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
    const action = isV2 ? 'publish_creation_report_v2' : 'publish_creation_report'

    const webhookPayload: Record<string, unknown> = {
      creation_result: payload,
    }
    if (options?.taskId != null) webhookPayload['task_id'] = options.taskId
    if (options?.executionId != null) webhookPayload['execution_id'] = options.executionId

    const resp = await this.webhookRequest<PublishCreationResponseData>(action, webhookPayload)
    return resp.data!
  }

  /** Query report status and metadata. */
  async getReportStatus(creationId: string, reportId: string): Promise<ReportMetadata> {
    const resp = await this.webhookRequest<ReportMetadata>('get_report_status', {
      creation_id: creationId,
      report_id: reportId,
    })
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

    const resp = await this.webhookRequest<PublicReportsResponseData>('get_public_reports', payload)
    return resp.data!
  }

  /** Check service health via GET /health. */
  async healthCheck(): Promise<[boolean, Record<string, unknown>]> {
    const response = await this.get('/health')
    if (!response.ok) {
      throw new Error(`Health check HTTP error: ${response.status} ${response.statusText}`)
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
      throw new Error(`Webhook help HTTP error: ${response.status} ${response.statusText}`)
    }
    return (await response.json()) as WebhookActionHelp
  }

  /**
   * Execute data_retrieve webhook.
   *
   * @remarks **Breaking change (v1.6.x → v1.7.x)**: default `topK` changed
   * from `1` to `20` to align with the backend DataFetchFlowV2 default.
   * Callers that rely on the old default must pass `{ topK: 1 }` explicitly.
   */
  async dataRetrieve(query: string, options?: { topK?: number }): Promise<DataRetrieveResult> {
    const payload: Record<string, unknown> = {
      query,
      top_k: options?.topK ?? 20,
    }
    const resp = await this.webhookRequest<DataRetrieveResult>('data_retrieve', payload)
    return resp.data!
  }

  /**
   * Search DataHub tools by semantic query.
   *
   * Calls `datahub_search_tools` webhook action. Returns matching tools with
   * their names, descriptions and parameter schemas.
   *
   * @param query - Natural-language search query
   * @param options.topK - Max number of tools to return (default: 20)
   */
  async datahubSearchTools(
    query: string,
    options?: { topK?: number },
  ): Promise<DatahubSearchToolsResult> {
    const payload: Record<string, unknown> = {
      query,
      top_k: options?.topK ?? 20,
    }
    const resp = await this.webhookRequest<DatahubSearchToolsResult>('datahub_search_tools', payload)
    return resp.data!
  }

  /**
   * Execute a specific DataHub tool directly.
   *
   * Calls `datahub_execute_tool` webhook action. Use `datahubSearchTools` to
   * discover available tools and their parameter schemas.
   *
   * Unlike other webhook methods, this **does not throw** when the tool itself
   * fails (i.e. `success=false`). It returns the `ExecuteResponse` so callers
   * can inspect `error` and `desc`. HTTP errors and auth failures still throw.
   *
   * @param toolName - Tool name (from `datahubSearchTools`)
   * @param args - Tool execution arguments (key-value pairs)
   */
  async datahubExecuteTool(
    toolName: string,
    args?: Record<string, unknown>,
  ): Promise<ExecuteResponse> {
    const payload: Record<string, unknown> = {
      tool_name: toolName,
      args: args ?? {},
    }
    const body = { action: 'datahub_execute_tool', payload }
    const response = await this.post('/webhook/', { json: body })
    if (!response.ok) {
      throw new Error(`Webhook HTTP error: ${response.status} ${response.statusText}`)
    }
    const resp = (await response.json()) as WebhookResponse<ExecuteResponse>
    // status=error means the tool execution failed (not an HTTP error);
    // return the ExecuteResponse so callers can inspect .error / .desc.
    if (resp.status === 'error') {
      return (
        resp.data ?? {
          success: false,
          data: {},
          count: 0,
          error: resp.message ?? 'Tool execution failed',
          desc: '',
        }
      )
    }
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

    const resp = await this.webhookRequest<PullConfigsResponse>('pull_configs', webhookPayload)
    return resp.data!
  }

  // ── WeChat anonymous OAuth ────────────────────────────────────────────────

  /**
   * Get WeChat OAuth login QR code URL.
   *
   * Calls `POST /auth/wechat/login-url`. Returns a QR code URL and a key
   * for subsequent polling. No authentication required.
   *
   * @param redirect - Redirect URL after WeChat OAuth login completes (optional)
   * @param options.timeout - Per-request timeout in ms (default: 15 000)
   */
  async wechatLoginUrl(
    redirect: string = '',
    options?: { timeout?: number },
  ): Promise<WechatLoginUrlResponse> {
    const response = await this.post('/auth/wechat/login-url', {
      json: { redirect },
      skipAuth: true,
      timeout: options?.timeout ?? 15_000,
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`wechatLoginUrl failed: ${response.status} ${text}`)
    }
    const json = (await response.json()) as Record<string, unknown>
    const data = (json['data'] ?? json) as WechatLoginUrlResponse
    return data
  }

  /**
   * Poll WeChat scan status and retrieve OpenID.
   *
   * Calls `GET /auth/wechat/poll-openid`. Each call queries the WeChat auth
   * server at most once. The client should call repeatedly until `status`
   * is `"success"` (with `openid`) or `"expired"` / `"error"`.
   *
   * No authentication required.
   *
   * @param key - The key obtained from `wechatLoginUrl()`
   * @param options.timeout - Per-request timeout in ms (default: 15 000)
   */
  async wechatPollOpenid(
    key: string,
    options?: { timeout?: number },
  ): Promise<WechatPollOpenidResponse> {
    const response = await this.get('/auth/wechat/poll-openid', {
      params: { key },
      skipAuth: true,
      timeout: options?.timeout ?? 15_000,
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`wechatPollOpenid failed: ${response.status} ${text}`)
    }
    return (await response.json()) as WechatPollOpenidResponse
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

  // ── App certs ──────────────────────────────────────────────────────────

  /**
   * Get application credentials.
   *
   * Uses API Key auth to fetch client_id, client_secret, and certificate
   * for the specified app. The current user must be bound to the app.
   *
   * @param appName - Casdoor application name
   */
  async getAppCerts(appName: string): Promise<AppCertInfo> {
    const response = await this.get('/app-certs', {
      headers: { 'X-APP-NAME': appName },
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Get app certs failed: ${response.status} ${text}`)
    }

    return (await response.json()) as AppCertInfo
  }

  // ── My apps ────────────────────────────────────────────────────────────

  /**
   * Get current user's bound applications with credentials.
   *
   * Requires JWT authentication. Returns all apps bound to the
   * current user with their client_id, client_secret, and certificate.
   */
  async getMyApps(): Promise<UserAppBindingInfo[]> {
    const response = await this.get('/user/my-apps')

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Get my apps failed: ${response.status} ${text}`)
    }

    return (await response.json()) as UserAppBindingInfo[]
  }
}
