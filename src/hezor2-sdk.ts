/**
 * Hezor2SDK — unified async SDK interface.
 *
 * Mirrors hezor_common.transfer.hezor2_sdk.sdk.Hezor2SDK.
 *
 * TypeScript doesn't have Python's async context managers, so we provide
 * explicit `create()` / `close()` and a static `with()` helper for
 * scoped usage.
 */

import { DEFAULT_API_BASE_URL, DEFAULT_API_KEY } from './env-config.js'
import { Hezor2APIClient } from './hezor2-api-client.js'
import type { MetaInfoData } from './meta-info.js'
import type {
  AppCertInfo,
  ConnectRefreshResponse,
  ConnectVerifyResponse,
  CreationGenerateResult,
  CreationGenerateResultV2,
  DatahubSearchToolsResult,
  DataRetrieveResult,
  ExecuteResponse,
  PublicReportsResponseData,
  PublishCreationResponseData,
  PullConfigsResponse,
  ReportMetadata,
  UserAppBindingInfo,
  WebhookActionHelp,
} from './types.js'

export interface Hezor2SDKOptions {
  /** API base URL — must include `/api/v1` prefix (e.g. `https://hezor.ai/api/v1`).
   *  Defaults to `https://hezor.ai/api/v1` (or `HEZOR2_API_BASE_URL` env var if set).
   *  Override for private/self-hosted deployments. */
  baseUrl?: string | undefined
  /** Request timeout in milliseconds (default: 120000) */
  timeout?: number | undefined
  /** API key for Bearer token authentication */
  apiKey?: string | undefined
  /** Meta information for JWT header generation */
  metaInfo?: MetaInfoData | undefined
  /** Path to PEM-encoded private key file for JWT signing */
  privateKeyPath?: string | undefined
  /** PEM-encoded private key for JWT signing */
  privateKeyPem?: string | undefined
  /** Password for encrypted private key */
  password?: string | undefined
  /** JWT token expiration in seconds (default: 3600) */
  metaInfoExpiresIn?: number | undefined
  /** Application name for X-APP-NAME header */
  appName?: string | undefined
}

export class Hezor2SDK {
  private readonly client: Hezor2APIClient

  constructor(options: Hezor2SDKOptions = {}) {
    this.client = new Hezor2APIClient({
      baseUrl: options.baseUrl ?? DEFAULT_API_BASE_URL,
      timeout: options.timeout,
      apiKey: options.apiKey ?? DEFAULT_API_KEY,
      metaInfo: options.metaInfo,
      privateKeyPath: options.privateKeyPath,
      privateKeyPem: options.privateKeyPem,
      password: options.password,
      metaInfoExpiresIn: options.metaInfoExpiresIn,
      appName: options.appName,
    })
  }

  /**
   * Scoped usage helper — similar to Python's `async with Hezor2SDK() as sdk:`.
   *
   * @example
   * ```ts
   * const result = await Hezor2SDK.with({ apiKey: 'xxx' }, async (sdk) => {
   *   return sdk.generateReportId(3)
   * })
   * ```
   */
  static async with<T>(options: Hezor2SDKOptions, fn: (sdk: Hezor2SDK) => Promise<T>): Promise<T> {
    const sdk = new Hezor2SDK(options)
    return fn(sdk)
  }

  /**
   * Fetch application credentials without creating a full SDK instance.
   *
   * Only requires `apiKey` and `appName` — `baseUrl` defaults to
   * `https://hezor.ai/api/v1` and can be omitted for SaaS deployments.
   * For private deployments, pass your instance URL (must include `/api/v1`).
   *
   * @example
   * ```ts
   * // SaaS (hezor.ai) — baseUrl can be omitted
   * const cert = await Hezor2SDK.getAppCerts('my_app', { apiKey: 'your-api-key' })
   *
   * // Private deployment
   * const cert = await Hezor2SDK.getAppCerts('my_app', {
   *   baseUrl: 'https://your-domain.com/api/v1',
   *   apiKey: 'your-api-key',
   * })
   * const sdk = new Hezor2SDK({
   *   baseUrl: 'https://your-domain.com/api/v1',
   *   apiKey: 'your-api-key',
   *   appName: 'my_app',
   *   privateKeyPem: cert.cert_content,
   *   password: cert.client_secret,
   *   metaInfo: { caller_id: 'my_system', subject: 'org', subject_code: 'org_001' },
   * })
   * ```
   */
  static async getAppCerts(
    appName: string,
    options: Pick<Hezor2SDKOptions, 'baseUrl' | 'apiKey'> = {},
  ): Promise<AppCertInfo> {
    const client = new Hezor2APIClient({
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      appName,
    })
    return client.getAppCerts(appName)
  }

  /** Generate unique report IDs with `rpt_` prefix. */
  async generateReportId(count: number = 1): Promise<string[]> {
    return this.client.generateReportId(count)
  }

  /**
   * Publish a creation report.
   *
   * Recommended: pass a `CreationGenerateResultV2` (flat structure).
   * The SDK automatically uses `publish_creation_report_v2` action.
   *
   * Passing `CreationGenerateResult` (V1) still works but will be
   * deprecated in future versions.
   */
  async publishCreationReport(
    creationResult: CreationGenerateResult | CreationGenerateResultV2,
    options?: { taskId?: string; executionId?: string },
  ): Promise<PublishCreationResponseData> {
    return this.client.publishCreationReport(creationResult, options)
  }

  /** Query report status and metadata. */
  async getReportStatus(creationId: string, reportId: string): Promise<ReportMetadata> {
    return this.client.getReportStatus(creationId, reportId)
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
    return this.client.getPublicReports(options)
  }

  /**
   * Check service health via GET /health.
   * @returns [isHealthy, responseData]
   */
  async healthCheck(): Promise<[boolean, Record<string, unknown>]> {
    try {
      return await this.client.healthCheck()
    } catch {
      return [false, { error: 'HTTP request failed' }]
    }
  }

  /** Retrieve webhook action documentation. */
  async webhookHelp(action: string): Promise<WebhookActionHelp> {
    return this.client.webhookHelp(action)
  }

  /**
   * Execute data retrieval.
   *
   * @remarks **Breaking change (v1.6.x → v1.7.x)**: default `topK` changed
   * from `1` to `20`. Pass `{ topK: 1 }` explicitly to restore the old behaviour.
   */
  async dataRetrieve(query: string, options?: { topK?: number }): Promise<DataRetrieveResult> {
    return this.client.dataRetrieve(query, options)
  }

  /**
   * Search DataHub tools by semantic query.
   *
   * @param query - Natural-language search query
   * @param options.topK - Max number of tools to return (default: 20)
   */
  async datahubSearchTools(
    query: string,
    options?: { topK?: number },
  ): Promise<DatahubSearchToolsResult> {
    return this.client.datahubSearchTools(query, options)
  }

  /**
   * Execute a specific DataHub tool directly.
   *
   * Does **not** throw when the tool itself fails (`success=false`).
   * Returns the `ExecuteResponse` so callers can inspect `error` / `desc`.
   * HTTP-level errors still throw.
   *
   * @param toolName - Tool name (from `datahubSearchTools`)
   * @param args - Tool execution arguments
   */
  async datahubExecuteTool(
    toolName: string,
    args?: Record<string, unknown>,
  ): Promise<ExecuteResponse> {
    return this.client.datahubExecuteTool(toolName, args)
  }

  /** Pull configs from configuration center. */
  async pullConfigs(options?: {
    keys?: string[]
    globalBaseUrl?: string
  }): Promise<PullConfigsResponse> {
    return this.client.pullConfigs(options)
  }

  // ── Connect login ─────────────────────────────────────────────────────────

  /**
   * Verify a Connect app identity.
   *
   * @param callbackUrl - The callback URL to verify
   */
  async connectVerify(callbackUrl: string): Promise<ConnectVerifyResponse> {
    return this.client.connectVerify(callbackUrl)
  }

  /**
   * Refresh a Connect token.
   *
   * @param refreshToken - The refresh token from Connect login
   */
  async connectRefresh(refreshToken: string): Promise<ConnectRefreshResponse> {
    return this.client.connectRefresh(refreshToken)
  }

  /**
   * Build a Connect login URL.
   *
   * @param frontendUrl - The Hezor frontend base URL
   * @param callbackUrl - The callback URL to redirect to after login
   */
  async buildConnectUrl(frontendUrl: string, callbackUrl: string): Promise<string> {
    return this.client.buildConnectUrl(frontendUrl, callbackUrl)
  }

  // ── App certs ──────────────────────────────────────────────────────────

  /**
   * Get application credentials.
   *
   * @param appName - Casdoor application name
   */
  async getAppCerts(appName: string): Promise<AppCertInfo> {
    return this.client.getAppCerts(appName)
  }

  // ── My apps ────────────────────────────────────────────────────────────

  /**
   * Get current user's bound applications with credentials.
   *
   * Requires JWT authentication.
   */
  async getMyApps(): Promise<UserAppBindingInfo[]> {
    return this.client.getMyApps()
  }
}
